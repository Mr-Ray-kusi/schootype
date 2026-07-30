import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import { getPlan, getPlanFeatures, getPlansList, VALID_PLAN_IDS, hasPlanFeature } from './plans.js';
import {
  getSubscriptionInfo,
  initializeSubscription,
  toDateString,
  addMonths,
} from './subscription.js';
import {
  initSchoolPlanStore,
  mergeSchoolWithExtras,
  upsertSchoolExtras,
  deleteSchoolExtras,
  ensureScannerToken,
  regenerateScannerToken,
  getSchoolIdByScannerToken,
} from './schoolPlanStore.js';
import {
  getPaystackConfig,
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
  createPaymentReference,
  listTransferBanks,
  createTransferRecipient,
  initiateTransfer,
} from './paystack.js';
import {
  initPaystackStore,
  createPendingTransaction,
  getTransaction,
  claimTransactionForProcessing,
  markTransactionStatus,
} from './paystackStore.js';
import {
  initFeeStore,
  createFeeInvoice,
  getFeeInvoice,
  listFeeInvoices,
  getFeeSummary,
  applyFeePayment,
  deleteFeeInvoice,
} from './feeStore.js';
import {
  initWalletStore,
  getWallet,
  getPlatformWallet,
  PLATFORM_WALLET_ID,
  creditWalletTopup,
  creditWalletManual,
  creditPlatformRevenue,
  debitWalletForSubscription,
  debitForExternalTransfer,
  payPersonFromWallet,
  listLedger,
  listPayouts,
  getPlatformWalletRevenue,
} from './walletStore.js';
import { applySubscriptionPayment } from './billingHelpers.js';
import {
  initStudentPhotoStore,
  setStudentPhoto,
  deleteStudentPhoto,
  mergeStudentPhoto,
  mergeStudentPhotos,
  setPersonPhoto,
  deletePersonPhoto,
  mergePersonPhoto,
  mergePersonPhotos,
} from './studentPhotoStore.js';
import {
  initAuthSecurityStore,
  getClientIp,
  validatePasswordStrength,
  checkLoginAllowed,
  recordLoginFailure,
  clearLoginFailures,
  checkSignupAllowed,
  recordSignupAttempt,
  parseJwtExpiresInSeconds,
} from './authSecurity.js';

dotenv.config();

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('__login_timing_dummy__', 10);

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(
  express.json({
    limit: '5mb',
    verify: (req, _res, buf) => {
      // Paystack webhook HMAC must be computed over the raw body
      if (req.originalUrl === '/api/payments/webhook' || req.url === '/api/payments/webhook') {
        req.rawBody = buf;
      }
    },
  })
);

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
const BACKEND_PUBLIC_URL = (process.env.BACKEND_URL || '').replace(/\/$/, '');

const getBackendUrl = () =>
  BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB

const formatSchool = (school, { includeCredentials = false } = {}) => {
  const merged = mergeSchoolWithExtras(school);
  const paymentPlan = merged.payment_plan || null;
  const planStatus = paymentPlan ? (merged.plan_status || 'pending') : null;
  const planApproved = planStatus === 'approved';
  const plan = paymentPlan ? getPlan(paymentPlan) : null;
  const pendingPlanFeatures = paymentPlan ? getPlanFeatures(paymentPlan) : [];
  const subscription = getSubscriptionInfo(merged);
  const featuresUnlocked = planApproved && subscription.subscription_active;

  const formatted = {
    id: merged.id,
    name: merged.name,
    email: merged.email,
    logo_url: merged.logo_url || null,
    role: getSchoolRole(merged),
    payment_plan: paymentPlan,
    plan_status: planStatus,
    plan_approved: planApproved,
    plan_name: plan?.name || null,
    plan_features: featuresUnlocked ? pendingPlanFeatures : [],
    pending_plan_features: pendingPlanFeatures,
    plan_selected_at: merged.plan_selected_at || null,
    subscription_active: subscription.subscription_active,
    subscription_frozen: subscription.subscription_frozen,
    subscription_started_at: subscription.subscription_started_at,
    next_payment_due: subscription.next_payment_due,
    last_payment_at: subscription.last_payment_at,
    subscription_in_grace: subscription.in_grace_period,
    subscription_days_past_due: subscription.days_past_due,
    subscription_status: subscription.reason,
    subscription_grace_days: subscription.grace_days,
    plan_price: plan?.price ?? null,
    plan_currency: plan?.currency || getPaystackConfig().currency || 'GHS',
    total_paid: merged.total_paid || 0,
    payment_records: merged.payment_records || [],
    wallet_balance: null,
  };

  if (includeCredentials) {
    formatted.initial_password = merged.initial_password || null;
  }

  return formatted;
};

const formatSchoolWithWallet = async (school, options = {}) => {
  const formatted = formatSchool(school, options);
  if (!formatted?.id || formatted.role === 'super_admin') {
    return formatted;
  }
  try {
    const wallet = await getWallet(formatted.id);
    formatted.wallet_balance = wallet.balance;
    formatted.wallet_currency = wallet.currency;
  } catch {
    formatted.wallet_balance = 0;
  }
  return formatted;
};

const getSuperAdminEmails = () => {
  const emails = [
    process.env.DEV_SUPER_ADMIN_EMAIL,
    process.env.SUPER_ADMIN_EMAIL,
    ...(process.env.SUPER_ADMIN_EMAILS || '').split(','),
    'superadmin@school.com',
  ]
    .filter(Boolean)
    .map((e) => e.trim().toLowerCase());
  return [...new Set(emails)];
};

const isSuperAdminEmail = (email) => getSuperAdminEmails().includes(email?.toLowerCase());

const getSchoolRole = (school) => {
  if (school?.role === 'super_admin') return 'super_admin';
  if (isSuperAdminEmail(school?.email)) return 'super_admin';
  return school?.role || 'admin';
};

const isMissingColumnError = (error, column) => {
  const msg = error?.message || '';
  return (
    msg.includes(`'${column}'`) ||
    msg.includes(`"${column}"`) ||
    msg.includes(`.${column} does not exist`) ||
    msg.includes(`column ${column} does not exist`)
  );
};

const findSchoolByEmail = async (email) => {
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const insertSchoolRecord = async (record) => {
  const payload = { ...record };
  const optionalColumns = ['role', 'initial_password', 'payment_plan', 'plan_selected_at', 'plan_status', 'logo_url'];

  for (let attempt = 0; attempt <= optionalColumns.length; attempt++) {
    const { data, error } = await supabase.from('schools').insert([payload]).select().single();

    if (!error) {
      return { data, error: null };
    }

    if (error.code === '23505') {
      return { data: null, error: { ...error, duplicate: true } };
    }

    const missingColumn = optionalColumns.find(
      (column) => payload[column] !== undefined && isMissingColumnError(error, column)
    );

    if (missingColumn) {
      delete payload[missingColumn];
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: { message: 'Failed to create school record' } };
};

const updateSchoolRecord = async (id, updates) => {
  const payload = { ...updates };
  const optionalColumns = ['role', 'initial_password', 'payment_plan', 'plan_selected_at', 'plan_status', 'logo_url'];

  for (let attempt = 0; attempt <= optionalColumns.length; attempt++) {
    const { data, error } = await supabase
      .from('schools')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (!error) {
      return { data, error: null };
    }

    const missingColumn = optionalColumns.find(
      (column) => payload[column] !== undefined && isMissingColumnError(error, column)
    );

    if (missingColumn) {
      delete payload[missingColumn];
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: { message: 'Failed to update school record' } };
};

const SCHOOL_OPTIONAL_COLUMNS = ['role', 'initial_password', 'payment_plan', 'plan_selected_at', 'plan_status', 'logo_url'];

const fetchSchoolAccounts = async ({ orderBy = 'created_at', ascending = false } = {}) => {
  const baseColumns = ['id', 'name', 'email', 'created_at'];
  let columns = [...baseColumns, ...SCHOOL_OPTIONAL_COLUMNS];

  for (let attempt = 0; attempt <= SCHOOL_OPTIONAL_COLUMNS.length; attempt++) {
    let query = supabase.from('schools').select(columns.join(', '));
    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }

    const { data, error } = await query;

    if (!error) {
      const accounts = (data || []).filter((school) => getSchoolRole(school) !== 'super_admin');
      return { data: accounts, error: null };
    }

    const missingColumn = SCHOOL_OPTIONAL_COLUMNS.find(
      (column) => columns.includes(column) && isMissingColumnError(error, column)
    );

    if (missingColumn) {
      columns = columns.filter((col) => col !== missingColumn);
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: { message: 'Failed to fetch school accounts' } };
};

const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

const enforcePlanApproval = async (req, res, next) => {
  if (req.user.role === 'super_admin') {
    return next();
  }

  try {
    const { data: school, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.user.schoolId)
      .maybeSingle();

    if (error || !school) {
      return res.status(403).json({ error: 'School account not found' });
    }

    const merged = mergeSchoolWithExtras(school);

    if (!merged.payment_plan) {
      return res.status(403).json({ error: 'Please select a payment plan first' });
    }

    if ((merged.plan_status || 'pending') !== 'approved') {
      return res.status(403).json({ error: 'Your plan is awaiting admin approval' });
    }

    const subscription = getSubscriptionInfo(merged);
    if (!subscription.subscription_active) {
      if (subscription.reason === 'frozen') {
        return res.status(403).json({
          error: 'Your account has been frozen by the administrator. Contact support to restore access.',
          subscription,
        });
      }
      if (subscription.reason === 'overdue') {
        return res.status(403).json({
          error: `Subscription payment is ${subscription.days_past_due} days overdue. Features are locked until payment is recorded.`,
          subscription,
        });
      }
    }

    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify plan status' });
  }
};

const validateLogo = (logo) => {
  if (!logo) return null;
  if (typeof logo !== 'string' || !logo.startsWith('data:image/')) {
    return 'Logo must be a valid image file';
  }
  const base64Data = logo.split(',')[1];
  if (!base64Data) return 'Invalid logo format';
  const sizeInBytes = Buffer.byteLength(base64Data, 'base64');
  if (sizeInBytes > MAX_LOGO_SIZE) {
    return 'Logo must be smaller than 2MB';
  }
  return null;
};

const validateImage = validateLogo;

const insertStudentRecord = async (record) => {
  const payload = { ...record };
  const optionalColumns = ['photo_url'];

  for (let attempt = 0; attempt <= optionalColumns.length; attempt++) {
    const { data, error } = await supabase.from('students').insert([payload]).select().single();

    if (!error) {
      return { data, error: null };
    }

    const missingColumn = optionalColumns.find(
      (column) => payload[column] !== undefined && isMissingColumnError(error, column)
    );

    if (missingColumn) {
      delete payload[missingColumn];
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: { message: 'Failed to create student record' } };
};

const updateStudentRecord = async (id, schoolId, updates) => {
  const payload = { ...updates };
  const optionalColumns = ['photo_url'];

  for (let attempt = 0; attempt <= optionalColumns.length; attempt++) {
    const { data, error } = await supabase
      .from('students')
      .update(payload)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (!error) {
      return { data, error: null };
    }

    const missingColumn = optionalColumns.find(
      (column) => payload[column] !== undefined && isMissingColumnError(error, column)
    );

    if (missingColumn) {
      delete payload[missingColumn];
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: { message: 'Failed to update student record' } };
};

// Supabase initialization — service role required so RLS does not block plan/login writes
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim() ||
  (process.env.SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in backend/.env');
}

if (!(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()) {
  console.warn(
    'SUPABASE_SERVICE_ROLE_KEY is not set. Using SUPABASE_ANON_KEY — Supabase RLS may block login, signup, and plan saves. ' +
      'Add the service role key from Supabase → Project Settings → API, and run database/supabase_core_billing.sql then database/supabase_backend_access.sql.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

if (!process.env.JWT_SECRET || JWT_SECRET === 'your-secret-key-change-this') {
  console.warn('WARNING: Using default JWT_SECRET. Set JWT_SECRET in backend/.env for production.');
}

const signAuthToken = (school) => {
  const role = getSchoolRole(school);
  return jwt.sign({ schoolId: school.id, email: school.email, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

const authTokenPayload = () => ({
  expiresIn: parseJwtExpiresInSeconds(JWT_EXPIRES_IN),
});

// Email transporter configuration - uses Gmail SMTP or custom SMTP
let emailTransporter = null;
let emailReady = false;

const hasValidEmailConfig = () => {
  const emailUser = process.env.EMAIL_USER || '';
  const emailPass = process.env.EMAIL_PASSWORD || '';
  return emailUser && emailPass && 
         emailUser !== 'your-email@gmail.com' && 
         emailPass !== 'your-app-password';
};

if (hasValidEmailConfig()) {
  const emailTransportOptions = process.env.EMAIL_HOST
    ? {
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT || 587),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      }
    : {
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      };

  emailTransporter = nodemailer.createTransport(emailTransportOptions);

  // Test email transporter on startup with timeout
  const verifyTimeout = setTimeout(() => {
    console.warn('Email verification timeout - continuing without email service');
    emailReady = false;
  }, 5000);

  emailTransporter.verify((error, success) => {
    clearTimeout(verifyTimeout);
    if (error) {
      emailReady = false;
      console.warn('Email service is not ready:', error.message);
    } else {
      emailReady = true;
      console.log('Email service ready');
    }
  });
} else {
  console.warn('Email credentials not configured. Set EMAIL_USER and EMAIL_PASSWORD in .env to enable email delivery.');
  emailReady = false;
}

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ============ PAYMENT PLANS ============

app.get('/api/plans', (req, res) => {
  res.json(getPlansList());
});

// ============ AUTHENTICATION ROUTES ============

// Signup - Create new school
app.post('/api/auth/signup', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { schoolName, password, logo, paymentPlan } = req.body;
    const clientIp = getClientIp(req);

    if (!schoolName?.trim() || !email || !password) {
      return res.status(400).json({ error: 'School name, email, and password are required' });
    }

    const signupCheck = await checkSignupAllowed(clientIp);
    if (!signupCheck.allowed) {
      return res.status(429).json({ error: signupCheck.message });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    if (isSuperAdminEmail(email)) {
      return res.status(400).json({ error: 'This email is reserved. Please use Login instead.' });
    }

    const logoError = validateLogo(logo);
    if (logoError) {
      return res.status(400).json({ error: logoError });
    }

    if (paymentPlan && !VALID_PLAN_IDS.includes(paymentPlan)) {
      return res.status(400).json({ error: 'Invalid payment plan' });
    }

    const existingSchool = await findSchoolByEmail(email);
    if (existingSchool) {
      await recordSignupAttempt(clientIp);
      return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const schoolRecord = {
      name: schoolName.trim(),
      email,
      password_hash: hashedPassword,
      initial_password: password,
      role: 'admin',
      created_at: new Date(),
    };
    if (logo) {
      schoolRecord.logo_url = logo;
    }
    if (paymentPlan) {
      schoolRecord.payment_plan = paymentPlan;
      schoolRecord.plan_selected_at = new Date();
      schoolRecord.plan_status = 'pending';
    }

    const { data: school, error: schoolError } = await insertSchoolRecord(schoolRecord);

    if (schoolError?.duplicate) {
      await recordSignupAttempt(clientIp);
      return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
    }

    if (schoolError || !school) {
      console.error('School creation error:', schoolError);
      return res.status(500).json({ error: 'Failed to create school. Please try again.' });
    }

    await recordSignupAttempt(clientIp);

    await upsertSchoolExtras(school.id, {
      payment_plan: paymentPlan || null,
      plan_status: paymentPlan ? 'pending' : null,
      plan_selected_at: paymentPlan ? new Date().toISOString() : null,
      initial_password: password,
      logo_url: logo || null,
    });

    const token = signAuthToken(school);

    const formattedSchool = formatSchool(school);

    res.json({
      token,
      ...authTokenPayload(),
      school: formattedSchool,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { password } = req.body;
    const clientIp = getClientIp(req);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const loginCheck = await checkLoginAllowed(email, clientIp);
    if (!loginCheck.allowed) {
      return res.status(429).json({
        error: loginCheck.message,
        retryAfter: loginCheck.retryAfterSec,
      });
    }

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    const hashToVerify = school?.password_hash || DUMMY_PASSWORD_HASH;
    const isValidPassword = await bcrypt.compare(password, hashToVerify);

    if (schoolError || !school || !isValidPassword) {
      await recordLoginFailure(email, clientIp);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await clearLoginFailures(email);

    const token = signAuthToken(school);

    res.json({
      token,
      ...authTokenPayload(),
      school: await formatSchoolWithWallet(school),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token - check if token is still valid
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    // Token is valid if we reach here (authenticateToken middleware verified it)
    const { data: school, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.user.schoolId)
      .single();

    if (error || !school) {
      return res.status(401).json({ error: 'School not found' });
    }

    res.json({
      valid: true,
      school: await formatSchoolWithWallet(school),
      role: getSchoolRole(school),
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(403).json({ error: 'Invalid token' });
  }
});

// Select payment plan (school admin, after signup via login flow)
app.post('/api/school/select-plan', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      return res.status(400).json({ error: 'Super admin does not require a plan' });
    }

    const { paymentPlan } = req.body;
    if (!paymentPlan || !VALID_PLAN_IDS.includes(paymentPlan)) {
      return res.status(400).json({ error: 'Invalid payment plan' });
    }

    const { data: school, error } = await updateSchoolRecord(req.user.schoolId, {
      payment_plan: paymentPlan,
      plan_selected_at: new Date(),
      plan_status: 'pending',
    });

    if (error) {
      console.error('Select plan Supabase update error:', error);
      const msg = String(error.message || '');
      if (msg.includes('row-level security') || error.code === '42501') {
        return res.status(503).json({
          error:
            'Failed to save payment plan for approval. Run database/supabase_core_billing.sql then database/supabase_backend_access.sql in the Supabase SQL editor, and set SUPABASE_SERVICE_ROLE_KEY on the server.',
        });
      }
      if (msg.includes('column') || error.code === 'PGRST204') {
        return res.status(503).json({
          error:
            'Failed to save payment plan for approval. Run database/supabase_core_billing.sql then database/supabase_backend_access.sql in the Supabase SQL editor, and set SUPABASE_SERVICE_ROLE_KEY on the server.',
        });
      }
      return res.status(500).json({
        error:
          'Failed to save payment plan for approval. Run database/supabase_core_billing.sql then database/supabase_backend_access.sql in the Supabase SQL editor, and set SUPABASE_SERVICE_ROLE_KEY on the server.',
      });
    }

    await upsertSchoolExtras(req.user.schoolId, {
      payment_plan: paymentPlan,
      plan_status: 'pending',
      plan_selected_at: new Date().toISOString(),
    });

    const { data: currentSchool, error: fetchError } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.user.schoolId)
      .single();

    if (fetchError || !currentSchool) {
      return res.status(500).json({ error: 'Failed to load school after plan update' });
    }

    res.json({ school: await formatSchoolWithWallet(currentSchool) });
  } catch (error) {
    console.error('Select plan error:', error);
    res.status(500).json({
      error:
        'Failed to save payment plan for approval. Run database/supabase_core_billing.sql then database/supabase_backend_access.sql in the Supabase SQL editor, and set SUPABASE_SERVICE_ROLE_KEY on the server.',
    });
  }
});

// ============ PAYSTACK PAYMENTS ============

app.get('/api/payments/config', (_req, res) => {
  const { publicKey, configured, currency } = getPaystackConfig();
  res.json({
    publicKey: configured ? publicKey : null,
    configured,
    currency,
  });
});

async function fulfillPaystackTransaction(reference, verifiedPayload = null) {
  const claim = await claimTransactionForProcessing(reference);
  if (claim.error === 'not_found') {
    const err = new Error('Unknown payment reference');
    err.status = 404;
    throw err;
  }
  if (claim.error === 'in_progress') {
    const err = new Error('Payment is still being processed. Please retry shortly.');
    err.status = 409;
    throw err;
  }
  if (claim.error === 'not_claimable') {
    const err = new Error('Payment could not be processed');
    err.status = 409;
    throw err;
  }
  if (claim.alreadyProcessed) {
    return { alreadyProcessed: true, transaction: claim.transaction };
  }

  const transaction = claim.transaction;

  try {
    const verified = verifiedPayload || (await verifyTransaction(reference));
    if (verified.status !== 'success') {
      await markTransactionStatus(reference, 'failed');
      const err = new Error(`Payment not successful (${verified.status})`);
      err.status = 400;
      throw err;
    }

    const expectedKobo = Number(transaction.amount_kobo);
    if (Number(verified.amount) !== expectedKobo) {
      await markTransactionStatus(reference, 'failed');
      const err = new Error('Payment amount mismatch');
      err.status = 400;
      throw err;
    }

    const expectedCurrency = getPaystackConfig().currency;
    if (verified.currency && String(verified.currency).toUpperCase() !== expectedCurrency) {
      await markTransactionStatus(reference, 'failed');
      const err = new Error(`Payment currency mismatch (expected ${expectedCurrency})`);
      err.status = 400;
      throw err;
    }

    if (transaction.purpose === 'platform_wallet_topup') {
      await creditPlatformRevenue({
        amount: transaction.amount,
        note: 'Platform revenue top-up via Paystack',
        recordedBy: 'paystack',
        paystackReference: reference,
        entryType: 'topup',
        counterpartyName: 'Paystack',
      });
    } else {
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('*')
        .eq('id', transaction.school_id)
        .maybeSingle();

      if (schoolError || !school) {
        await markTransactionStatus(reference, 'failed');
        const err = new Error('School not found for payment');
        err.status = 404;
        throw err;
      }

      if (transaction.purpose === 'subscription') {
        const applied = await applySubscriptionPayment(transaction.school_id, school, {
          source: 'paystack',
          paystackReference: reference,
          updateSchoolRecord,
        });
        if (!applied.alreadyProcessed) {
          await creditPlatformRevenue({
            amount: applied.amount,
            note: `Subscription — ${school.name}`,
            recordedBy: 'paystack',
            paystackReference: `rev_${reference}`,
            entryType: 'revenue',
            counterpartyName: school.name,
          });
        }
      } else if (transaction.purpose === 'school_fee') {
        await applyFeePayment({
          invoiceId: transaction.invoice_id,
          schoolId: transaction.school_id,
          amount: transaction.amount,
          method: 'paystack',
          paystackReference: reference,
          note: 'Paid via Paystack',
          recordedBy: 'paystack',
        });
      } else if (transaction.purpose === 'wallet_topup') {
        await creditWalletTopup({
          schoolId: transaction.school_id,
          amount: transaction.amount,
          paystackReference: reference,
          note: 'Paystack wallet top-up',
          recordedBy: 'paystack',
        });
      } else {
        await markTransactionStatus(reference, 'failed');
        const err = new Error(`Unknown payment purpose: ${transaction.purpose}`);
        err.status = 400;
        throw err;
      }
    }

    const completed = await markTransactionStatus(reference, 'success');
    return { alreadyProcessed: false, transaction: completed };
  } catch (error) {
    const current = await getTransaction(reference);
    if (current?.status === 'processing') {
      await markTransactionStatus(reference, 'pending');
    }
    throw error;
  }
}

app.post('/api/school/subscription/pay', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      return res.status(400).json({ error: 'Super admin does not pay for a subscription' });
    }

    const { data: school, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.user.schoolId)
      .maybeSingle();

    if (error || !school) {
      return res.status(404).json({ error: 'School not found' });
    }

    const merged = mergeSchoolWithExtras(school);
    if (!merged.payment_plan || !VALID_PLAN_IDS.includes(merged.payment_plan)) {
      return res.status(400).json({ error: 'Select a payment plan before paying' });
    }

    if (merged.subscription_frozen === true || merged.subscription_frozen === 1) {
      return res.status(400).json({
        error: 'Account is frozen. Contact the platform admin to unfreeze before paying.',
      });
    }

    const plan = getPlan(merged.payment_plan);
    const amount = plan.price;
    const reference = createPaymentReference('sub');
    const callbackUrl = `${FRONTEND_URL}/payment/callback?purpose=subscription`;

    const init = await initializeTransaction({
      email: school.email,
      amount,
      reference,
      callbackUrl,
      metadata: {
        purpose: 'subscription',
        school_id: school.id,
        plan_id: plan.id,
        custom_fields: [
          { display_name: 'School', variable_name: 'school_name', value: school.name },
          { display_name: 'Plan', variable_name: 'plan_name', value: plan.name },
        ],
      },
    });

    await createPendingTransaction({
      reference: init.reference,
      purpose: 'subscription',
      schoolId: school.id,
      amountNgn: amount,
      amountKobo: init.amountMinor,
      metadata: { plan_id: plan.id, currency: init.currency },
    });

    res.json({
      authorizationUrl: init.authorizationUrl,
      reference: init.reference,
      amount,
      currency: init.currency,
      plan: { id: plan.id, name: plan.name, price: plan.price, currency: plan.currency },
    });
  } catch (error) {
    console.error('Subscription pay init error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to start payment' });
  }
});

app.get('/api/school/subscription/verify', authenticateToken, async (req, res) => {
  try {
    const reference = req.query.reference;
    if (!reference) {
      return res.status(400).json({ error: 'Missing reference' });
    }

    const pending = await getTransaction(reference);
    if (!pending || pending.school_id !== req.user.schoolId) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const result = await fulfillPaystackTransaction(reference);

    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.user.schoolId)
      .single();

    res.json({
      status: 'success',
      alreadyProcessed: Boolean(result.alreadyProcessed),
      school: await formatSchoolWithWallet(school),
    });
  } catch (error) {
    console.error('Subscription verify error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Payment verification failed' });
  }
});

app.post('/api/payments/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const rawBody = req.rawBody;
    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    if (event?.event === 'charge.success' && event?.data?.reference) {
      await fulfillPaystackTransaction(event.data.reference, event.data);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Paystack webhook error:', error);
    // Still 200 so Paystack does not retry endlessly on business errors after signature OK
    res.sendStatus(200);
  }
});

// ============ SCHOOL FEES ============

app.get('/api/fees/summary', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const summary = await getFeeSummary(req.user.schoolId);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fees', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const status = req.query.status; // paid | unpaid | undefined (all)
    const invoices = await listFeeInvoices(req.user.schoolId, { status });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fees', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { studentId, description, amount, dueDate, term } = req.body;
    if (!studentId || !description || !(Number(amount) > 0)) {
      return res.status(400).json({ error: 'studentId, description, and a positive amount are required' });
    }

    const { data: student, error } = await supabase
      .from('students')
      .select('id, name, class, parent_email')
      .eq('id', studentId)
      .eq('school_id', req.user.schoolId)
      .maybeSingle();

    if (error || !student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const invoice = await createFeeInvoice({
      schoolId: req.user.schoolId,
      studentId: student.id,
      studentName: student.name,
      studentClass: student.class,
      description,
      amount: Number(amount),
      dueDate: dueDate || null,
      term: term || null,
    });

    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/fees/:id', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const deleted = await deleteFeeInvoice(req.params.id, req.user.schoolId);
    if (!deleted) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/fees/:id/record-payment', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { amount, method = 'cash', note } = req.body;
    const invoice = await getFeeInvoice(req.params.id, req.user.schoolId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const payAmount = amount != null ? Number(amount) : invoice.balance;
    const result = await applyFeePayment({
      invoiceId: invoice.id,
      schoolId: req.user.schoolId,
      amount: payAmount,
      method,
      note: note || null,
      recordedBy: req.user.email || req.user.schoolId,
    });

    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/fees/:id/pay', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const invoice = await getFeeInvoice(req.params.id, req.user.schoolId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status === 'paid' || invoice.balance <= 0) {
      return res.status(400).json({ error: 'Invoice is already paid' });
    }

    const { data: school, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.user.schoolId)
      .maybeSingle();

    if (error || !school) {
      return res.status(404).json({ error: 'School not found' });
    }

    const amount = invoice.balance;
    const reference = createPaymentReference('fee');
    const callbackUrl = `${FRONTEND_URL}/payment/callback?purpose=school_fee`;

    // Prefer parent email when available for Paystack receipt, else school email
    const { data: student } = await supabase
      .from('students')
      .select('parent_email')
      .eq('id', invoice.student_id)
      .eq('school_id', req.user.schoolId)
      .maybeSingle();

    const payerEmail = student?.parent_email || school.email;

    const init = await initializeTransaction({
      email: payerEmail,
      amount,
      reference,
      callbackUrl,
      metadata: {
        purpose: 'school_fee',
        school_id: school.id,
        invoice_id: invoice.id,
        student_id: invoice.student_id,
        custom_fields: [
          { display_name: 'Student', variable_name: 'student_name', value: invoice.student_name },
          { display_name: 'Fee', variable_name: 'fee_description', value: invoice.description },
        ],
      },
    });

    await createPendingTransaction({
      reference: init.reference,
      purpose: 'school_fee',
      schoolId: school.id,
      amountNgn: amount,
      amountKobo: init.amountMinor,
      invoiceId: invoice.id,
      metadata: { invoice_id: invoice.id, currency: init.currency },
    });

    res.json({
      authorizationUrl: init.authorizationUrl,
      reference: init.reference,
      amount,
      currency: init.currency,
      invoice,
    });
  } catch (error) {
    console.error('Fee pay init error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to start payment' });
  }
});

app.get('/api/fees/verify', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const reference = req.query.reference;
    if (!reference) {
      return res.status(400).json({ error: 'Missing reference' });
    }

    const pending = await getTransaction(reference);
    if (!pending || pending.school_id !== req.user.schoolId) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const result = await fulfillPaystackTransaction(reference);
    const invoice = pending.invoice_id
      ? await getFeeInvoice(pending.invoice_id, req.user.schoolId)
      : null;

    res.json({
      status: 'success',
      alreadyProcessed: Boolean(result.alreadyProcessed),
      invoice,
    });
  } catch (error) {
    console.error('Fee verify error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Payment verification failed' });
  }
});

// ============ SCHOOL WALLET ============

app.get('/api/wallet', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      return res.status(400).json({ error: 'Platform admin has no school wallet' });
    }
    const wallet = await getWallet(req.user.schoolId);
    const [ledger, payouts] = await Promise.all([
      listLedger(req.user.schoolId, { limit: 30 }),
      listPayouts(req.user.schoolId, { limit: 20 }),
    ]);
    res.json({ wallet, ledger, payouts });
  } catch (error) {
    console.error('Wallet fetch error:', error);
    res.status(500).json({ error: error.message || 'Failed to load wallet' });
  }
});

app.get('/api/wallet/ledger', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      return res.status(400).json({ error: 'Platform admin has no school wallet' });
    }
    const ledger = await listLedger(req.user.schoolId, {
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(ledger);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/wallet/payouts', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      return res.status(400).json({ error: 'Platform admin has no school wallet' });
    }
    const payouts = await listPayouts(req.user.schoolId, {
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(payouts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/wallet/topup', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      return res.status(400).json({ error: 'Platform admin cannot top up a school wallet' });
    }

    const amount = Number(req.body.amount);
    if (!(amount > 0)) {
      return res.status(400).json({ error: 'Enter a positive top-up amount' });
    }

    const { data: school, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.user.schoolId)
      .maybeSingle();

    if (error || !school) {
      return res.status(404).json({ error: 'School not found' });
    }

    const reference = createPaymentReference('wlt');
    const callbackUrl = `${FRONTEND_URL}/payment/callback?purpose=wallet_topup`;

    const init = await initializeTransaction({
      email: school.email,
      amount,
      reference,
      callbackUrl,
      metadata: {
        purpose: 'wallet_topup',
        school_id: school.id,
        custom_fields: [
          { display_name: 'School', variable_name: 'school_name', value: school.name },
          { display_name: 'Top-up', variable_name: 'topup_amount', value: String(amount) },
        ],
      },
    });

    await createPendingTransaction({
      reference: init.reference,
      purpose: 'wallet_topup',
      schoolId: school.id,
      amountNgn: amount,
      amountKobo: init.amountMinor,
      metadata: { currency: init.currency },
    });

    res.json({
      authorizationUrl: init.authorizationUrl,
      reference: init.reference,
      amount,
      currency: init.currency,
    });
  } catch (error) {
    console.error('Wallet top-up init error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to start top-up' });
  }
});

app.get('/api/wallet/verify', authenticateToken, async (req, res) => {
  try {
    const reference = req.query.reference;
    if (!reference) {
      return res.status(400).json({ error: 'Missing reference' });
    }

    const pending = await getTransaction(reference);
    if (!pending || pending.school_id !== req.user.schoolId) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const result = await fulfillPaystackTransaction(reference);
    const wallet = await getWallet(req.user.schoolId);

    res.json({
      status: 'success',
      alreadyProcessed: Boolean(result.alreadyProcessed),
      wallet,
    });
  } catch (error) {
    console.error('Wallet verify error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Top-up verification failed' });
  }
});

app.post('/api/wallet/pay-subscription', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      return res.status(400).json({ error: 'Super admin does not pay for a subscription' });
    }

    const { data: school, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.user.schoolId)
      .maybeSingle();

    if (error || !school) {
      return res.status(404).json({ error: 'School not found' });
    }

    const merged = mergeSchoolWithExtras(school);
    if (!merged.payment_plan || !VALID_PLAN_IDS.includes(merged.payment_plan)) {
      return res.status(400).json({ error: 'Select a payment plan before paying' });
    }

    if (merged.subscription_frozen === true || merged.subscription_frozen === 1) {
      return res.status(400).json({
        error: 'Account is frozen. Contact the platform admin to unfreeze before paying.',
      });
    }

    const plan = getPlan(merged.payment_plan);
    const walletDebit = await debitWalletForSubscription({
      schoolId: school.id,
      amount: plan.price,
      planName: plan.name,
      recordedBy: req.user.email || school.email,
    });

    if (walletDebit.alreadyProcessed) {
      return res.json({
        status: 'success',
        alreadyProcessed: true,
        wallet: walletDebit.wallet,
        school: await formatSchoolWithWallet(school),
      });
    }

    try {
      const applied = await applySubscriptionPayment(school.id, school, {
        source: 'wallet',
        paystackReference: walletDebit.entry?.id || null,
        updateSchoolRecord,
      });
      if (!applied.alreadyProcessed) {
        await creditPlatformRevenue({
          amount: applied.amount,
          note: `Subscription — ${school.name}`,
          recordedBy: req.user.email || school.email,
          paystackReference: `rev_${walletDebit.entry?.id || Date.now()}`,
          entryType: 'revenue',
          counterpartyName: school.name,
        });
      }
    } catch (applyError) {
      await creditWalletManual({
        schoolId: school.id,
        amount: plan.price,
        note: 'Refund: subscription activation failed after wallet debit',
        recordedBy: 'system',
      });
      throw applyError;
    }

    const { data: refreshed } = await supabase.from('schools').select('*').eq('id', school.id).single();

    res.json({
      status: 'success',
      alreadyProcessed: false,
      amount: plan.price,
      currency: plan.currency,
      wallet: await getWallet(school.id),
      school: await formatSchoolWithWallet(refreshed || school),
    });
  } catch (error) {
    console.error('Wallet subscription pay error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to pay from wallet' });
  }
});

app.post('/api/wallet/payouts', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { personType, personId, amount, note } = req.body;
    const payAmount = Number(amount);

    if (!personType || !personId || !(payAmount > 0)) {
      return res.status(400).json({ error: 'personType, personId, and a positive amount are required' });
    }

    const table = personType === 'staff' ? 'staffs' : personType === 'non_staff' ? 'nonstaffs' : null;
    if (!table) {
      return res.status(400).json({ error: 'personType must be staff or non_staff' });
    }

    const { data: person, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', personId)
      .eq('school_id', req.user.schoolId)
      .maybeSingle();

    if (error || !person) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const result = await payPersonFromWallet({
      schoolId: req.user.schoolId,
      personType,
      personId: person.id,
      personName: person.name,
      personRole: person.role || null,
      amount: payAmount,
      note: note || null,
      recordedBy: req.user.email || req.user.schoolId,
    });

    res.json(result);
  } catch (error) {
    console.error('Wallet payout error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Payout failed' });
  }
});

/** Shared Paystack MoMo/bank send from a wallet (school or platform). */
async function sendWalletTransfer({
  ownerId,
  amount,
  channel,
  recipientName,
  accountNumber,
  bankCode,
  note,
  recordedBy,
}) {
  const payAmount = Number(amount);
  if (!(payAmount > 0)) {
    const err = new Error('Enter a positive amount');
    err.status = 400;
    throw err;
  }

  const normalizedChannel = channel === 'bank' || channel === 'ghipss' ? 'ghipss' : 'mobile_money';
  const displayChannel = normalizedChannel === 'mobile_money' ? 'mobile_money' : 'bank';

  const recipient = await createTransferRecipient({
    type: normalizedChannel,
    name: recipientName,
    accountNumber,
    bankCode,
  });

  const transferRef = createPaymentReference(ownerId === PLATFORM_WALLET_ID ? 'ptx' : 'stx');
  const accountHint = `${bankCode} ···${String(accountNumber).slice(-4)}`;

  // Debit app wallet first
  const debit = await debitForExternalTransfer({
    ownerId,
    amount: payAmount,
    recipientName,
    channel: displayChannel,
    accountHint,
    note,
    recordedBy,
    transferReference: transferRef,
  });

  try {
    const transfer = await initiateTransfer({
      amount: payAmount,
      recipientCode: recipient.recipientCode,
      reason: note || `Payout to ${recipientName}`,
      reference: transferRef,
    });

    return {
      wallet: debit.wallet,
      payout: debit.payout,
      transfer,
      recipient: {
        name: recipient.name,
        type: recipient.type,
        accountHint,
      },
    };
  } catch (transferError) {
    await creditWalletManual({
      schoolId: ownerId,
      amount: payAmount,
      note: `Refund: Paystack transfer failed — ${transferError.message}`,
      recordedBy: 'system',
    });
    throw transferError;
  }
}

app.get('/api/wallet/banks', authenticateToken, async (req, res) => {
  try {
    const type = req.query.type === 'mobile_money' ? 'mobile_money' : 'ghipss';
    const banks = await listTransferBanks({ type });
    res.json(banks);
  } catch (error) {
    console.error('List banks error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to load banks' });
  }
});

app.post('/api/wallet/send', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      return res.status(400).json({ error: 'Use the platform revenue wallet to send funds' });
    }

    const { amount, channel, recipientName, accountNumber, bankCode, note } = req.body;
    const result = await sendWalletTransfer({
      ownerId: req.user.schoolId,
      amount,
      channel,
      recipientName,
      accountNumber,
      bankCode,
      note,
      recordedBy: req.user.email || req.user.schoolId,
    });
    res.json(result);
  } catch (error) {
    console.error('Wallet send error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Transfer failed' });
  }
});

// Platform revenue wallet (super admin only — separate from school wallets)
app.get('/api/platform/wallet', authenticateToken, requireSuperAdmin, async (_req, res) => {
  try {
    const wallet = await getPlatformWallet();
    const [ledger, payouts] = await Promise.all([
      listLedger(PLATFORM_WALLET_ID, { limit: 40 }),
      listPayouts(PLATFORM_WALLET_ID, { limit: 30 }),
    ]);
    res.json({ wallet, ledger, payouts });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load platform wallet' });
  }
});

app.post('/api/platform/wallet/topup', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!(amount > 0)) {
      return res.status(400).json({ error: 'Enter a positive top-up amount' });
    }

    const { data: admin, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.user.schoolId)
      .maybeSingle();

    if (error || !admin) {
      return res.status(404).json({ error: 'Admin account not found' });
    }

    const reference = createPaymentReference('plt');
    const callbackUrl = `${FRONTEND_URL}/payment/callback?purpose=platform_wallet_topup`;

    const init = await initializeTransaction({
      email: admin.email,
      amount,
      reference,
      callbackUrl,
      metadata: {
        purpose: 'platform_wallet_topup',
        owner: PLATFORM_WALLET_ID,
      },
    });

    await createPendingTransaction({
      reference: init.reference,
      purpose: 'platform_wallet_topup',
      schoolId: PLATFORM_WALLET_ID,
      amountNgn: amount,
      amountKobo: init.amountMinor,
      metadata: { currency: init.currency },
    });

    res.json({
      authorizationUrl: init.authorizationUrl,
      reference: init.reference,
      amount,
      currency: init.currency,
    });
  } catch (error) {
    console.error('Platform top-up error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to start top-up' });
  }
});

app.get('/api/platform/wallet/verify', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const reference = req.query.reference;
    if (!reference) {
      return res.status(400).json({ error: 'Missing reference' });
    }

    const pending = await getTransaction(reference);
    if (!pending || pending.purpose !== 'platform_wallet_topup') {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const result = await fulfillPaystackTransaction(reference);
    const wallet = await getPlatformWallet();
    res.json({
      status: 'success',
      alreadyProcessed: Boolean(result.alreadyProcessed),
      wallet,
    });
  } catch (error) {
    console.error('Platform wallet verify error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Verification failed' });
  }
});

app.post('/api/platform/wallet/send', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { amount, channel, recipientName, accountNumber, bankCode, note } = req.body;
    const result = await sendWalletTransfer({
      ownerId: PLATFORM_WALLET_ID,
      amount,
      channel,
      recipientName,
      accountNumber,
      bankCode,
      note,
      recordedBy: req.user.email,
    });
    res.json(result);
  } catch (error) {
    console.error('Platform send error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Transfer failed' });
  }
});

app.get('/api/super-admin/schools/:id/wallet', authenticateToken, requireSuperAdmin, async (_req, res) => {
  return res.status(403).json({ error: 'School wallets are private to each school and are not visible to platform admins' });
});

app.post('/api/super-admin/schools/:id/wallet/adjust', authenticateToken, requireSuperAdmin, async (_req, res) => {
  return res.status(403).json({ error: 'Platform admins cannot view or adjust school wallets' });
});

// ============ SUPER ADMIN ROUTES ============

const buildSchoolWithStats = async (school) => {
  const [students, staff, nonStaff] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact' }).eq('school_id', school.id),
    supabase.from('staffs').select('id', { count: 'exact' }).eq('school_id', school.id),
    supabase.from('nonstaffs').select('id', { count: 'exact' }).eq('school_id', school.id),
  ]);

  const formatted = formatSchool(school, { includeCredentials: true });
  // Super admin must not see school wallets
  delete formatted.wallet_balance;
  delete formatted.wallet_currency;

  return {
    ...formatted,
    created_at: school.created_at,
    stats: {
      students: students.count || 0,
      staff: staff.count || 0,
      nonStaff: nonStaff.count || 0,
    },
  };
};

app.get('/api/super-admin/schools', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { data: schools, error } = await fetchSchoolAccounts({ orderBy: 'created_at', ascending: false });

    if (error) {
      console.error('Super admin schools fetch error:', error.message || error);
      return res.status(500).json({ error: error.message || 'Failed to fetch schools' });
    }

    const schoolsWithStats = await Promise.all((schools || []).map(buildSchoolWithStats));

    res.json(schoolsWithStats);
  } catch (error) {
    console.error('Super admin schools error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/super-admin/schools/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { data: school, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error || !school) {
      return res.status(404).json({ error: 'School not found' });
    }

    if (getSchoolRole(school) === 'super_admin') {
      return res.status(404).json({ error: 'School not found' });
    }

    res.json(await buildSchoolWithStats(school));
  } catch (error) {
    console.error('Super admin school detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/super-admin/overview', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { data: schoolAccounts, error: schoolsError } = await fetchSchoolAccounts();

    if (schoolsError) {
      return res.status(500).json({ error: schoolsError.message || 'Failed to fetch schools' });
    }

    const schoolIds = (schoolAccounts || []).map((s) => s.id);

    const [students, staff, nonStaff] = await Promise.all([
      schoolIds.length
        ? supabase.from('students').select('id', { count: 'exact' }).in('school_id', schoolIds)
        : Promise.resolve({ count: 0 }),
      schoolIds.length
        ? supabase.from('staffs').select('id', { count: 'exact' }).in('school_id', schoolIds)
        : Promise.resolve({ count: 0 }),
      schoolIds.length
        ? supabase.from('nonstaffs').select('id', { count: 'exact' }).in('school_id', schoolIds)
        : Promise.resolve({ count: 0 }),
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalRevenue = 0;
    let revenueThisMonth = 0;
    let activeSubscriptions = 0;

    for (const school of schoolAccounts || []) {
      const merged = mergeSchoolWithExtras(school);
      totalRevenue += merged.total_paid || 0;

      if ((merged.plan_status || 'pending') === 'approved') {
        activeSubscriptions += 1;
      }

      for (const record of merged.payment_records || []) {
        if (record.recorded_at && new Date(record.recorded_at) >= monthStart) {
          revenueThisMonth += Number(record.amount) || 0;
        }
      }
    }

    const walletSubscriptionRevenue = await getPlatformWalletRevenue();

    res.json({
      totalSchools: schoolAccounts?.length || 0,
      totalStudents: students.count || 0,
      totalStaff: staff.count || 0,
      totalNonStaff: nonStaff.count || 0,
      totalRevenue,
      revenueThisMonth,
      activeSubscriptions,
      // Informative only — wallet subscription payments already counted in totalRevenue via payment_records.
      walletSubscriptionRevenue,
      pendingRegisters: (schoolAccounts || []).filter((s) => {
        const m = mergeSchoolWithExtras(s);
        const status = m.plan_status || (m.payment_plan ? 'pending' : 'none');
        return status === 'pending' || status === 'none';
      }).length,
      approvedRegisters: (schoolAccounts || []).filter((s) => {
        const m = mergeSchoolWithExtras(s);
        return (m.plan_status || '') === 'approved';
      }).length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/super-admin/schools/:id/plan', authenticateToken, requireSuperAdmin, async (req, res) => {
  res.status(403).json({
    error: 'Payment plans are chosen by each school and cannot be changed by the platform admin.',
  });
});

app.patch('/api/super-admin/schools/:id/approval', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid approval status' });
    }

    const { data: existingSchool, error: fetchError } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError || !existingSchool) {
      return res.status(404).json({ error: 'School not found' });
    }

    const merged = mergeSchoolWithExtras(existingSchool);

    if (status === 'approved' && !merged.payment_plan) {
      return res.status(400).json({ error: 'The school must select a payment plan before you can approve their account' });
    }

    const extrasUpdate = { plan_status: status };
    if (status === 'approved' && !merged.subscription_started_at) {
      if (merged.next_payment_due && merged.last_payment_at) {
        Object.assign(extrasUpdate, {
          subscription_started_at: merged.last_payment_at,
        });
      } else if (merged.next_payment_due) {
        const started = toDateString(addMonths(merged.next_payment_due, -1));
        Object.assign(extrasUpdate, {
          subscription_started_at: started,
          last_payment_at: started,
        });
      } else {
        Object.assign(extrasUpdate, initializeSubscription());
      }
    }
    await upsertSchoolExtras(req.params.id, extrasUpdate);

    await updateSchoolRecord(req.params.id, {
      plan_status: status,
    });

    const { data: updatedSchool } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    res.json(await buildSchoolWithStats(updatedSchool || existingSchool));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/super-admin/schools/:id/record-payment', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { data: existingSchool, error: fetchError } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError || !existingSchool) {
      return res.status(404).json({ error: 'School not found' });
    }

    if (getSchoolRole(existingSchool) === 'super_admin') {
      return res.status(404).json({ error: 'School not found' });
    }

    const applied = await applySubscriptionPayment(req.params.id, existingSchool, {
      source: 'manual',
      updateSchoolRecord,
    });

    if (!applied.alreadyProcessed) {
      await creditPlatformRevenue({
        amount: applied.amount,
        note: `Manual subscription — ${existingSchool.name}`,
        recordedBy: req.user.email,
        paystackReference: `rev_manual_${req.params.id}_${Date.now()}`,
        entryType: 'revenue',
        counterpartyName: existingSchool.name,
      });
    }

    res.json(await buildSchoolWithStats(existingSchool));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.patch('/api/super-admin/schools/:id/subscription', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { frozen, nextPaymentDue } = req.body;

    const { data: existingSchool, error: fetchError } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError || !existingSchool) {
      return res.status(404).json({ error: 'School not found' });
    }

    if (getSchoolRole(existingSchool) === 'super_admin') {
      return res.status(404).json({ error: 'School not found' });
    }

    const updates = {};
    if (typeof frozen === 'boolean') {
      updates.subscription_frozen = frozen;
    }
    if (nextPaymentDue) {
      updates.next_payment_due = nextPaymentDue;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No subscription updates provided' });
    }

    await upsertSchoolExtras(req.params.id, updates);

    res.json(await buildSchoolWithStats(existingSchool));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/super-admin/schools/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { confirmName } = req.body;

    const { data: existingSchool, error: fetchError } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError || !existingSchool) {
      return res.status(404).json({ error: 'School not found' });
    }

    if (getSchoolRole(existingSchool) === 'super_admin') {
      return res.status(403).json({ error: 'Cannot delete super admin account' });
    }

    if (!confirmName || confirmName.trim() !== existingSchool.name) {
      return res.status(400).json({
        error: 'Type the exact school name to confirm deletion',
      });
    }

    const schoolId = req.params.id;
    const relatedTables = ['attendance', 'messages', 'students', 'staffs', 'nonstaffs'];

    for (const table of relatedTables) {
      const { error: deleteError } = await supabase.from(table).delete().eq('school_id', schoolId);
      if (deleteError) {
        console.error(`Failed to delete ${table} for school ${schoolId}:`, deleteError.message);
      }
    }

    const { error: schoolDeleteError } = await supabase.from('schools').delete().eq('id', schoolId);
    if (schoolDeleteError) {
      return res.status(500).json({ error: schoolDeleteError.message });
    }

    await deleteSchoolExtras(schoolId);

    res.json({ message: `School "${existingSchool.name}" has been permanently deleted` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await supabase
      .from('schools')
      .select('id', { count: 'exact' })
      .limit(1);

    const databaseHealthy = !dbHealth.error;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: databaseHealthy ? 'connected' : 'error',
      email: {
        configured: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
        ready: emailReady,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'failed',
      email: {
        configured: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
        ready: emailReady,
      },
      error: error.message,
    });
  }
});

// ============ STUDENT ROUTES ============

// Get all students for a school
app.get('/api/students', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { data: students, error } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', req.user.schoolId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(mergeStudentPhotos(students));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new student
app.post('/api/students', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { name, class: className, parentEmail, rollNumber, photo } = req.body;

    const photoError = validateImage(photo);
    if (photoError) {
      return res.status(400).json({ error: photoError });
    }

    const barcode = `${req.user.schoolId}-STU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const record = {
      school_id: req.user.schoolId,
      name,
      class: className,
      parent_email: parentEmail,
      roll_number: rollNumber,
      barcode,
      created_at: new Date(),
    };

    if (photo) {
      record.photo_url = photo;
    }

    const { data: student, error } = await insertStudentRecord(record);

    if (error) throw error;

    if (photo && student?.id) {
      await setStudentPhoto(student.id, req.user.schoolId, photo);
    }

    res.json(mergeStudentPhoto(student));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update student
app.put('/api/students/:id', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, class: className, parentEmail, rollNumber, photo, photo_url: photoUrl } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (className !== undefined) updates.class = className;
    if (parentEmail !== undefined) updates.parent_email = parentEmail;
    if (rollNumber !== undefined) updates.roll_number = rollNumber;

    const nextPhoto = photo !== undefined ? photo : photoUrl;
    if (nextPhoto !== undefined) {
      const photoError = validateImage(nextPhoto);
      if (photoError) {
        return res.status(400).json({ error: photoError });
      }
      updates.photo_url = nextPhoto || null;
    }

    const { data: student, error } = await updateStudentRecord(id, req.user.schoolId, updates);

    if (error) throw error;

    if (nextPhoto !== undefined) {
      if (nextPhoto) {
        await setStudentPhoto(id, req.user.schoolId, nextPhoto);
      } else {
        await deleteStudentPhoto(id);
      }
    }

    res.json(mergeStudentPhoto(student));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete student
app.delete('/api/students/:id', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id)
      .eq('school_id', req.user.schoolId);

    if (error) throw error;
    await deleteStudentPhoto(id);
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STAFF ROUTES ============

// helper to normalize DB records for the frontend
const normalizeStaffRecord = (rec) => {
  if (!rec) return rec;
  return {
    ...rec,
    secretCode: rec.secret_code || null,
  };
};

app.get('/api/staff', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { data: staff, error } = await supabase
      .from('staffs')
      .select('*')
      .eq('school_id', req.user.schoolId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Auto-assign codes to Teachers without them
    const generateSecretCode = () => `SCH-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const updates = [];
    
    for (const member of staff) {
      if (member.role === 'Teacher' && !member.secret_code) {
        const newCode = generateSecretCode();
        updates.push(
          supabase
            .from('staffs')
            .update({ secret_code: newCode })
            .eq('id', member.id)
            .then(() => {
              member.secret_code = newCode;
            })
            .catch(err => {
              console.warn(`Failed to update secret code for teacher ${member.id}:`, err.message);
            })
        );
      }
    }
    
    // Wait for all updates to complete
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    
    // normalize records for frontend (add camelCase secretCode)
    res.json(staff.map((member) => mergePersonPhoto(normalizeStaffRecord(member))));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/staff', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { name, role, secretCode, photo } = req.body;

    const photoError = validateImage(photo);
    if (photoError) {
      return res.status(400).json({ error: photoError });
    }

    const barcode = `${req.user.schoolId}-STAFF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Generate a secret code for Teachers if not provided
    const generateSecretCode = () => `SCH-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const preservedSecretCode = role === 'Teacher' ? (secretCode || generateSecretCode()) : null;

    // only include secret_code when the role is Teacher
    const insertObj = {
      school_id: req.user.schoolId,
      name,
      role,
      barcode,
      created_at: new Date(),
    };
    if (preservedSecretCode) insertObj.secret_code = preservedSecretCode;

    // attempt to insert; if DB lacks secret_code column, retry without it
    let staff;
    try {
      const result = await supabase
        .from('staffs')
        .insert([insertObj])
        .select()
        .single();
      if (result.error) throw result.error;
      staff = result.data;
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      if (msg.includes('secret_code')) {
        console.warn('Database does not have secret_code column, retrying without it');
        delete insertObj.secret_code;
        const retry = await supabase
          .from('staffs')
          .insert([insertObj])
          .select()
          .single();
        if (retry.error) throw retry.error;
        staff = retry.data;
      } else {
        throw err;
      }
    }

    // Ensure secretCode is in the response even if DB column doesn't exist
    const response = normalizeStaffRecord(staff);
    if (preservedSecretCode && !response.secretCode) {
      response.secretCode = preservedSecretCode;
    }

    if (photo && staff?.id) {
      await setPersonPhoto(staff.id, req.user.schoolId, photo);
    }

    res.json(mergePersonPhoto(response));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/staff/:id', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, secretCode, photo, photo_url: photoUrl } = req.body;
    
    // First fetch the current staff member to get existing data
    const { data: currentStaff, error: fetchError } = await supabase
      .from('staffs')
      .select('*')
      .eq('id', id)
      .eq('school_id', req.user.schoolId)
      .single();
    
    if (fetchError || !currentStaff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const nextPhoto = photo !== undefined ? photo : photoUrl;
    if (nextPhoto !== undefined) {
      const photoError = validateImage(nextPhoto);
      if (photoError) {
        return res.status(400).json({ error: photoError });
      }
    }

    const updates = {};
    if (name) updates.name = name;
    if (role) updates.role = role;

    // Handle secret code logic for Teachers
    const generateSecretCode = () => `SCH-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const newRole = role || currentStaff.role;
    
    if (newRole === 'Teacher') {
      // If updating to Teacher role, use provided code, preserve existing, or generate new
      if (secretCode) {
        updates.secret_code = secretCode;
      } else if (!currentStaff.secret_code) {
        // No existing code and no new code provided, generate one
        updates.secret_code = generateSecretCode();
      }
      // If existing code exists and no new code provided, don't update (preserve it)
    } else {
      // If changing away from Teacher role, clear the code
      updates.secret_code = null;
    }

    // attempt update; if secret_code column is missing, retry without it
    let staff;
    try {
      const result = await supabase
        .from('staffs')
        .update(updates)
        .eq('id', id)
        .eq('school_id', req.user.schoolId)
        .select()
        .single();
      if (result.error) throw result.error;
      staff = result.data;
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      if (msg.includes('secret_code')) {
        console.warn('Database does not have secret_code column, retrying without it');
        delete updates.secret_code;
        const retry = await supabase
          .from('staffs')
          .update(updates)
          .eq('id', id)
          .eq('school_id', req.user.schoolId)
          .select()
          .single();
        if (retry.error) throw retry.error;
        staff = retry.data;
      } else {
        throw err;
      }
    }

    // Ensure secretCode is in the response
    const response = normalizeStaffRecord(staff);

    if (nextPhoto !== undefined) {
      if (nextPhoto) {
        await setPersonPhoto(id, req.user.schoolId, nextPhoto);
      } else {
        await deletePersonPhoto(id);
      }
    }

    res.json(mergePersonPhoto(response));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/staff/:id', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('staffs')
      .delete()
      .eq('id', id)
      .eq('school_id', req.user.schoolId);

    if (error) throw error;
    await deletePersonPhoto(id);
    res.json({ message: 'Staff deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ NON-STAFF ROUTES ============

app.get('/api/non-staff', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { data: nonStaff, error } = await supabase
      .from('nonstaffs')
      .select('*')
      .eq('school_id', req.user.schoolId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(mergePersonPhotos(nonStaff));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/non-staff', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { name, role, photo } = req.body;

    const photoError = validateImage(photo);
    if (photoError) {
      return res.status(400).json({ error: photoError });
    }

    const barcode = `${req.user.schoolId}-NONSTAFF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const { data: nonStaff, error } = await supabase
      .from('nonstaffs')
      .insert([
        {
          school_id: req.user.schoolId,
          name,
          role,
          barcode,
          created_at: new Date(),
        }
      ])
      .select()
      .single();

    if (error) throw error;

    if (photo && nonStaff?.id) {
      await setPersonPhoto(nonStaff.id, req.user.schoolId, photo);
    }

    res.json(mergePersonPhoto(nonStaff));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/non-staff/:id', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, photo, photo_url: photoUrl } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;

    const nextPhoto = photo !== undefined ? photo : photoUrl;
    if (nextPhoto !== undefined) {
      const photoError = validateImage(nextPhoto);
      if (photoError) {
        return res.status(400).json({ error: photoError });
      }
    }

    const { data: nonStaff, error } = await supabase
      .from('nonstaffs')
      .update(updates)
      .eq('id', id)
      .eq('school_id', req.user.schoolId)
      .select()
      .single();

    if (error) throw error;

    if (nextPhoto !== undefined) {
      if (nextPhoto) {
        await setPersonPhoto(id, req.user.schoolId, nextPhoto);
      } else {
        await deletePersonPhoto(id);
      }
    }

    res.json(mergePersonPhoto(nonStaff));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/non-staff/:id', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('nonstaffs')
      .delete()
      .eq('id', id)
      .eq('school_id', req.user.schoolId);

    if (error) throw error;
    await deletePersonPhoto(id);
    res.json({ message: 'Non-staff deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ATTENDANCE ROUTES ============

const getAttendanceCode = (body) => (body?.qrCode || body?.barcode || '').trim() || null;

const markAttendanceForSchool = async (schoolId, attendanceCode) => {
  let { data: student } = await supabase
    .from('students')
    .select('id, name')
    .eq('barcode', attendanceCode)
    .eq('school_id', schoolId)
    .single();

  let userType = 'student';
  let userId = student?.id;
  let userName = student?.name;

  if (!userId) {
    const { data: staff } = await supabase
      .from('staffs')
      .select('id, name')
      .eq('barcode', attendanceCode)
      .eq('school_id', schoolId)
      .single();

    if (staff) {
      userId = staff.id;
      userName = staff.name;
      userType = 'staff';
    } else {
      const { data: nonStaff } = await supabase
        .from('nonstaffs')
        .select('id, name')
        .eq('barcode', attendanceCode)
        .eq('school_id', schoolId)
        .single();

      if (nonStaff) {
        userId = nonStaff.id;
        userName = nonStaff.name;
        userType = 'non-staff';
      }
    }
  }

  if (!userId) {
    const err = new Error('Invalid QR code');
    err.status = 404;
    throw err;
  }

  const today = new Date().toISOString().split('T')[0];
  const { data: existingAttendance } = await supabase
    .from('attendance')
    .select('id')
    .eq('school_id', schoolId)
    .eq('user_type', userType)
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (existingAttendance) {
    const err = new Error('Attendance already marked for today');
    err.status = 400;
    throw err;
  }

  const { data: attendance, error } = await supabase
    .from('attendance')
    .insert([
      {
        school_id: schoolId,
        user_type: userType,
        user_id: userId,
        date: today,
        timestamp: new Date().toISOString(),
        status: 'present',
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return {
    message: `Attendance marked for ${userName}`,
    attendance,
    user: { name: userName, type: userType },
  };
};

const resolveScannerSchool = async (token) => {
  const schoolId = await getSchoolIdByScannerToken(token);
  if (!schoolId) return null;

  const { data: school, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', schoolId)
    .maybeSingle();

  if (error || !school) return null;

  const merged = mergeSchoolWithExtras(school);
  if (!merged.payment_plan) return null;
  if ((merged.plan_status || 'pending') !== 'approved') return null;
  if (!hasPlanFeature(merged.payment_plan, 'scanner')) return null;
  if (!getSubscriptionInfo(merged).subscription_active) return null;

  return { schoolId, schoolName: merged.name };
};

// Mobile scanner link (admin dashboard)
app.get('/api/scanner/link', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.user.schoolId)
      .maybeSingle();
    const merged = mergeSchoolWithExtras(school);

    if (!hasPlanFeature(merged.payment_plan, 'scanner')) {
      return res.status(403).json({ error: 'Scanner is not included in your plan' });
    }

    const token = await ensureScannerToken(req.user.schoolId);
    res.json({ token, schoolName: merged.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scanner/regenerate', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('id', req.user.schoolId)
      .maybeSingle();
    const merged = mergeSchoolWithExtras(school);

    if (!hasPlanFeature(merged.payment_plan, 'scanner')) {
      return res.status(403).json({ error: 'Scanner is not included in your plan' });
    }

    const token = await regenerateScannerToken(req.user.schoolId);
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public mobile scanner endpoints (token-based, no login)
app.get('/api/scanner/school/:token', async (req, res) => {
  try {
    const resolved = await resolveScannerSchool(req.params.token);
    if (!resolved) {
      return res.status(404).json({ error: 'Invalid or inactive scanner link' });
    }

    res.json({ schoolName: resolved.schoolName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scanner/mark/:token', async (req, res) => {
  try {
    const attendanceCode = getAttendanceCode(req.body);
    if (!attendanceCode) {
      return res.status(400).json({ error: 'QR code is required' });
    }

    const resolved = await resolveScannerSchool(req.params.token);
    if (!resolved) {
      return res.status(404).json({ error: 'Invalid or inactive scanner link' });
    }

    const result = await markAttendanceForSchool(resolved.schoolId, attendanceCode);
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error('Mobile scanner attendance error:', error);
    }
    res.status(status).json({ error: error.message });
  }
});

// Mark attendance (authenticated admin scanner)
app.post('/api/attendance/mark', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const attendanceCode = getAttendanceCode(req.body);
    if (!attendanceCode) {
      return res.status(400).json({ error: 'QR code is required' });
    }

    const result = await markAttendanceForSchool(req.user.schoolId, attendanceCode);
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error('Attendance marking error:', error);
    }
    res.status(status).json({ error: error.message });
  }
});

// Get attendance records
app.get('/api/attendance', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { date, type } = req.query;
    let query = supabase
      .from('attendance')
      .select('*')
      .eq('school_id', req.user.schoolId);

    if (date) {
      query = query.eq('date', date);
    }
    if (type && type !== 'all') {
      query = query.eq('user_type', type);
    }

    const { data: attendance, error } = await query.order('timestamp', { ascending: false });

    if (error) throw error;

    // Enrich with user details
    const enrichedAttendance = await Promise.all(
      attendance.map(async (record) => {
        let table;
        switch (record.user_type) {
          case 'student':
            table = 'students';
            break;
          case 'staff':
            table = 'staffs';
            break;
          case 'non-staff':
            table = 'nonstaffs';
            break;
          default:
            return record;
        }

        const { data: user } = await supabase
          .from(table)
          .select('name, role, class')
          .eq('id', record.user_id)
          .single();

        return { ...record, user };
      })
    );

    res.json(enrichedAttendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance summary for today
app.get('/api/attendance/summary', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const requestedDate = req.query.date || today;
    const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today;

    const [students, staff, nonStaff, attendance] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact' }).eq('school_id', req.user.schoolId),
      supabase.from('staffs').select('id', { count: 'exact' }).eq('school_id', req.user.schoolId),
      supabase.from('nonstaffs').select('id', { count: 'exact' }).eq('school_id', req.user.schoolId),
      supabase.from('attendance').select('user_type').eq('school_id', req.user.schoolId).eq('date', selectedDate),
    ]);

    const presentStudents = attendance.data?.filter(a => a.user_type === 'student').length || 0;
    const presentStaff = attendance.data?.filter(a => a.user_type === 'staff').length || 0;
    const presentNonStaff = attendance.data?.filter(a => a.user_type === 'non-staff').length || 0;

    res.json({
      date: selectedDate,
      students: {
        total: students.count || 0,
        present: presentStudents,
        percentage: students.count ? (presentStudents / students.count * 100).toFixed(2) : 0,
      },
      staff: {
        total: staff.count || 0,
        present: presentStaff,
        percentage: staff.count ? (presentStaff / staff.count * 100).toFixed(2) : 0,
      },
      nonStaff: {
        total: nonStaff.count || 0,
        present: presentNonStaff,
        percentage: nonStaff.count ? (presentNonStaff / nonStaff.count * 100).toFixed(2) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ MESSAGES ROUTES ============

// Get messages for a school
app.get('/api/messages', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('school_id', req.user.schoolId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send message with SMS or email based on plan
app.post('/api/messages', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const {
      senderName,
      senderRole,
      sendMode,
      recipients,
      individualRole,
      recipientEmail,
      recipientPhone,
      message,
      deliveryChannel = 'sms',
    } = req.body;

    const { data: schoolAccount, error: schoolError } = await supabase
      .from('schools')
      .select('payment_plan')
      .eq('id', req.user.schoolId)
      .single();

    if (schoolError || !schoolAccount) {
      return res.status(403).json({ error: 'School account not found' });
    }

    const planId = schoolAccount.payment_plan;
    const channel = deliveryChannel === 'email' ? 'email' : 'sms';

    if (channel === 'sms' && !hasPlanFeature(planId, 'messages-sms')) {
      return res.status(403).json({ error: 'Bulk SMS is not included in your plan' });
    }
    if (channel === 'email' && !hasPlanFeature(planId, 'messages-email')) {
      return res.status(403).json({ error: 'Bulk email is not included in your plan. Upgrade to Enterprise.' });
    }

    const messageRecord = {
      school_id: req.user.schoolId,
      sender_name: senderName,
      sender_role: senderRole || 'Admin',
      send_mode: sendMode || 'Group',
      recipients: recipients || 'Parents',
      individual_role: individualRole,
      recipient_email: channel === 'email' ? recipientEmail : null,
      message,
      delivery_channel: channel,
      created_at: new Date(),
    };

    let newMessage;
    const { data: insertedMessage, error } = await supabase
      .from('messages')
      .insert([messageRecord])
      .select()
      .single();

    if (error && error.message?.includes('delivery_channel')) {
      const { delivery_channel, ...fallbackRecord } = messageRecord;
      const retry = await supabase.from('messages').insert([fallbackRecord]).select().single();
      if (retry.error) throw retry.error;
      newMessage = retry.data;
    } else if (error) {
      throw error;
    } else {
      newMessage = insertedMessage;
    }

    if (channel === 'sms') {
      const smsTarget =
        sendMode === 'Individual'
          ? recipientPhone || recipientEmail
          : `${recipients || 'Parents'} group`;
      console.log(`[SMS] Bulk message queued for ${smsTarget}: ${message.substring(0, 80)}...`);
    }

    if (channel === 'email' && emailReady && emailTransporter) {
      const emailList = [];
      const defaultBroadcastEmail = process.env.BROADCAST_EMAIL || process.env.EMAIL_USER;

      if (sendMode === 'Individual' && recipientEmail) {
        emailList.push(recipientEmail);
      } else if (recipients === 'Parents') {
        emailList.push(process.env.PARENTS_EMAIL || defaultBroadcastEmail);
      } else if (recipients === 'Teachers') {
        emailList.push(process.env.TEACHERS_EMAIL || defaultBroadcastEmail);
      } else if (recipients === 'Staff') {
        emailList.push(process.env.STAFF_EMAIL || defaultBroadcastEmail);
      } else {
        emailList.push(defaultBroadcastEmail);
      }

      const validEmails = emailList.filter(Boolean);
      for (const toEmail of validEmails) {
        try {
          await emailTransporter.sendMail({
            from: process.env.EMAIL_USER,
            to: toEmail,
            subject: `Message from ${senderName} (${senderRole})`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
                <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <h2 style="color: #333; margin-top: 0;">New Message from School</h2>
                  <p><strong>From:</strong> ${senderName} (${senderRole})</p>
                  <p><strong>Recipient Group:</strong> ${recipients || 'Direct Message'}</p>
                  <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                  <div style="color: #555; line-height: 1.6;">
                    ${message.replace(/\n/g, '<br>')}
                  </div>
                  <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                  <p style="color: #999; font-size: 12px; margin-bottom: 0;">This is an automated message from Schootype School Management System</p>
                </div>
              </div>
            `,
            text: message,
          });
          console.log(`Email sent to ${toEmail}`);
        } catch (emailError) {
          console.error(`Failed to send email to ${toEmail}:`, emailError.message);
        }
      }
    } else if (!emailTransporter) {
      console.debug('Email transporter not configured. Skipping email delivery.');
    }

    res.json(newMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reply to message
app.post('/api/messages/:id/reply', authenticateToken, enforcePlanApproval, async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;

    const { data: message, error } = await supabase
      .from('messages')
      .update({ reply, replied_at: new Date() })
      .eq('id', id)
      .eq('school_id', req.user.schoolId)
      .select()
      .single();

    if (error) throw error;
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DASHBOARD STATS ============

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      const { data: schoolAccount } = await supabase
        .from('schools')
        .select('*')
        .eq('id', req.user.schoolId)
        .maybeSingle();

      const merged = mergeSchoolWithExtras(schoolAccount);

      if (!merged?.payment_plan || (merged.plan_status || 'pending') !== 'approved') {
        return res.json({
          totalStudents: 0,
          totalStaff: 0,
          totalNonStaff: 0,
          unreadMessages: 0,
          todayAttendance: 0,
          planPending: true,
        });
      }
    }

    const [students, staff, nonStaff, messages, attendance] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact' }).eq('school_id', req.user.schoolId),
      supabase.from('staffs').select('id', { count: 'exact' }).eq('school_id', req.user.schoolId),
      supabase.from('nonstaffs').select('id', { count: 'exact' }).eq('school_id', req.user.schoolId),
      supabase.from('messages').select('id', { count: 'exact' }).eq('school_id', req.user.schoolId).is('reply', null),
      supabase.from('attendance').select('user_type').eq('school_id', req.user.schoolId).eq('date', new Date().toISOString().split('T')[0]),
    ]);

    res.json({
      totalStudents: students.count || 0,
      totalStaff: staff.count || 0,
      totalNonStaff: nonStaff.count || 0,
      unreadMessages: messages.count || 0,
      todayAttendance: attendance.data?.length || 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simple DB connectivity check before starting the server
const PORT = process.env.PORT || 5000;

async function seedSuperAdmin() {
  if (process.env.SEED_SUPER_ADMIN !== 'true') {
    return;
  }

  const email = (process.env.DEV_SUPER_ADMIN_EMAIL || 'superadmin@school.com').trim().toLowerCase();
  const password = process.env.DEV_SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';
  const name = process.env.DEV_SUPER_ADMIN_NAME || 'Super Admin';
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const existing = await findSchoolByEmail(email);

    const syncUpdates = {
      name,
      email,
      password_hash: hashedPassword,
      initial_password: password,
      role: 'super_admin',
    };

    if (existing) {
      const { error: updateError } = await updateSchoolRecord(existing.id, syncUpdates);
      if (updateError) {
        console.error('Failed to sync super admin:', updateError.message);
        return;
      }

      console.log('Dev super admin credentials synced');
      console.log(`  Email:    ${email}`);
      console.log(`  Password: ${password}`);
      return;
    }

    const { error: insertError } = await insertSchoolRecord({
      ...syncUpdates,
      created_at: new Date(),
    });

    if (insertError) {
      console.error('Failed to seed super admin:', insertError.message);
      return;
    }

    console.log('Dev super admin account created');
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
  } catch (err) {
    console.error('Super admin seed error:', err.message);
  }
}

async function initializeDatabase() {
  try {
    // Perform a lightweight test query to verify Supabase connectivity.
    const { data, error } = await supabase.from('schools').select('id').limit(1);
    if (error) {
      console.error('Database setup failed:', error.message || error);
      return false;
    }
    console.log('Database setup complete');
    await initSchoolPlanStore();
    console.log('School plan store ready');
    await initPaystackStore();
    console.log('Paystack transaction store ready');
    await initFeeStore();
    console.log('Fee ledger store ready');
    await initWalletStore();
    console.log('School wallet store ready');
    await initStudentPhotoStore();
    console.log('Person photo store ready');
    await initAuthSecurityStore();
    console.log('Auth security store ready');
    await seedSuperAdmin();
    return true;
  } catch (err) {
    console.error('Database setup failed:', err.message || err);
    return false;
  }
}

initializeDatabase().then((ok) => {
  if (!ok) {
    console.error('Aborting: database initialization failed. Server not started.');
    process.exit(1);
    return;
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nPort ${PORT} is already in use — another backend instance may still be running.`);
      console.error('Stop it first, then run npm run dev again in the backend folder.');
      console.error(`Windows: netstat -ano | findstr :${PORT}  then  taskkill /PID <pid> /F\n`);
    } else {
      console.error('Failed to start server:', err.message);
    }
    process.exit(1);
  });
});