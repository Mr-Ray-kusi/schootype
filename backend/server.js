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
  renewSubscription,
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
  getSchoolExtrasSync,
  parsePaymentRecords,
} from './schoolPlanStore.js';
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
import { initSchoolWalletStore } from './schoolWalletStore.js';
import { registerWalletRoutes } from './walletRoutes.js';
import { initPlatformSmsStore } from './platformSmsStore.js';
import { registerSmsBillingRoutes, settleSmsPayment } from './smsBilling.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('__login_timing_dummy__', 10);

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '5mb' }));

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
    total_paid: merged.total_paid || 0,
    payment_records: merged.payment_records || [],
  };

  if (includeCredentials) {
    formatted.initial_password = merged.initial_password || null;
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
  const optionalColumns = ['photo_url', 'parent_phone', 'house_address', 'date_of_birth', 'parent_email', 'roll_number'];

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
  const optionalColumns = ['photo_url', 'parent_phone', 'house_address', 'date_of_birth', 'parent_email', 'roll_number'];

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

// Supabase initialization
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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

const getEmailUser = () =>
  String(process.env.EMAIL_USER || process.env.BROADCAST_EMAIL || '')
    .trim()
    .toLowerCase();

const getEmailPassword = () =>
  // Gmail app passwords are often copied with spaces — strip them
  String(process.env.EMAIL_PASSWORD || '').replace(/\s+/g, '').trim();

const hasValidEmailConfig = () => {
  const emailUser = getEmailUser();
  const emailPass = getEmailPassword();
  const placeholderUsers = new Set([
    'your-email@gmail.com',
    'your-kusiraymond208@gmail.com',
  ]);
  return Boolean(
    emailUser &&
      emailPass &&
      !placeholderUsers.has(emailUser) &&
      emailPass !== 'your-app-password' &&
      emailUser.includes('@')
  );
};

const initEmailTransporter = () => {
  emailTransporter = null;
  emailReady = false;

  if (!hasValidEmailConfig()) {
    console.warn(
      'Email credentials not configured. Set EMAIL_USER and EMAIL_PASSWORD in backend/.env to enable email delivery.'
    );
    return;
  }

  const emailUser = getEmailUser();
  const emailPass = getEmailPassword();

  const emailTransportOptions = process.env.EMAIL_HOST
    ? {
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT || 587),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      }
    : {
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      };

  emailTransporter = nodemailer.createTransport(emailTransportOptions);

  const verifyTimeout = setTimeout(() => {
    console.warn('Email verification timeout - continuing without email service');
    emailReady = false;
  }, 8000);

  emailTransporter.verify((error) => {
    clearTimeout(verifyTimeout);
    if (error) {
      emailReady = false;
      console.warn('Email service is not ready:', error.message);
    } else {
      emailReady = true;
      console.log(`Email service ready (${emailUser})`);
    }
  });
};

initEmailTransporter();

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
      school: formatSchool(school),
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
      school: formatSchool(school),
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

    res.json({ school: formatSchool(currentSchool) });
  } catch (error) {
    console.error('Select plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ SUPER ADMIN ROUTES ============

const buildSchoolWithStats = async (school) => {
  const [students, staff, nonStaff] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact' }).eq('school_id', school.id),
    supabase.from('staffs').select('id', { count: 'exact' }).eq('school_id', school.id),
    supabase.from('nonstaffs').select('id', { count: 'exact' }).eq('school_id', school.id),
  ]);

  return {
    ...formatSchool(school, { includeCredentials: true }),
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

app.get('/api/super-admin/email-status', authenticateToken, requireSuperAdmin, (req, res) => {
  res.json({
    configured: hasValidEmailConfig(),
    ready: Boolean(emailReady && emailTransporter),
    from: hasValidEmailConfig() ? getEmailUser() : null,
  });
});

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

app.post('/api/super-admin/broadcast-email', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    if (!emailReady || !emailTransporter) {
      return res.status(503).json({
        error:
          'Email is not configured or ready. Set EMAIL_USER and EMAIL_PASSWORD (app password) in backend/.env, then restart the server.',
      });
    }

    const {
      subject,
      message,
      schoolIds,
      selectAll,
      attachment,
    } = req.body || {};

    const cleanSubject = String(subject || '').trim();
    const cleanMessage = String(message || '').trim();

    if (!cleanSubject) {
      return res.status(400).json({ error: 'Subject is required' });
    }
    if (!cleanMessage && !attachment?.contentBase64) {
      return res.status(400).json({ error: 'Provide a message and/or attach a file' });
    }

    let mailAttachment = null;
    if (attachment?.contentBase64) {
      const filename = String(attachment.filename || 'attachment').slice(0, 180);
      const contentType = String(attachment.contentType || 'application/octet-stream');
      const base64 = String(attachment.contentBase64).replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      if (!buffer.length) {
        return res.status(400).json({ error: 'Attachment file is empty or invalid' });
      }
      if (buffer.length > 3 * 1024 * 1024) {
        return res.status(400).json({ error: 'Attachment must be 3MB or smaller' });
      }
      mailAttachment = {
        filename,
        contentType,
        content: buffer,
      };
    }

    const { data: schoolAccounts, error } = await fetchSchoolAccounts({
      orderBy: 'name',
      ascending: true,
    });
    if (error) {
      return res.status(500).json({ error: error.message || 'Failed to load schools' });
    }

    let recipients = schoolAccounts || [];
    if (!selectAll) {
      const ids = Array.isArray(schoolIds) ? schoolIds.map(String) : [];
      if (!ids.length) {
        return res.status(400).json({ error: 'Select at least one school, or choose all schools' });
      }
      recipients = recipients.filter((school) => ids.includes(String(school.id)));
    }

    recipients = recipients.filter((school) => school?.email && getSchoolRole(school) !== 'super_admin');

    if (!recipients.length) {
      return res.status(400).json({ error: 'No school admin emails found for the selection' });
    }

    const fromAddress = getEmailUser();
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
          <h2 style="color: #111827; margin-top: 0;">Message from NEXUS Platform Admin</h2>
          <p style="color: #6b7280; margin-top: 0;">This email was sent to your school admin account.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <div style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(cleanMessage).replace(/\n/g, '<br>')}</div>
          ${
            mailAttachment
              ? `<p style="margin-top: 20px; color: #6b7280; font-size: 13px;">A file is attached: <strong>${escapeHtml(mailAttachment.filename)}</strong></p>`
              : ''
          }
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">NEXUS · Platform notification</p>
        </div>
      </div>
    `;

    const results = [];
    for (const school of recipients) {
      try {
        await emailTransporter.sendMail({
          from: fromAddress,
          to: school.email,
          subject: cleanSubject,
          text: cleanMessage || `(See attached file: ${mailAttachment?.filename || 'attachment'})`,
          html: htmlBody,
          attachments: mailAttachment
            ? [
                {
                  filename: mailAttachment.filename,
                  content: mailAttachment.content,
                  contentType: mailAttachment.contentType,
                },
              ]
            : undefined,
        });
        results.push({ schoolId: school.id, email: school.email, name: school.name, status: 'sent' });
      } catch (emailError) {
        console.error(`Broadcast email failed for ${school.email}:`, emailError.message);
        results.push({
          schoolId: school.id,
          email: school.email,
          name: school.name,
          status: 'failed',
          error: emailError.message,
        });
      }
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    res.json({
      sent,
      failed,
      total: results.length,
      results,
    });
  } catch (error) {
    console.error('Broadcast email error:', error);
    res.status(500).json({ error: error.message || 'Failed to send broadcast email' });
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

    res.json({
      totalSchools: schoolAccounts?.length || 0,
      totalStudents: students.count || 0,
      totalStaff: staff.count || 0,
      totalNonStaff: nonStaff.count || 0,
      totalRevenue,
      revenueThisMonth,
      activeSubscriptions,
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

    const merged = mergeSchoolWithExtras(existingSchool);
    const renewed = renewSubscription(merged);
    const plan = getPlan(merged.payment_plan);
    const amount = plan?.price || 0;
    const extras = getSchoolExtrasSync(req.params.id);
    const records = parsePaymentRecords(extras);
    records.unshift({
      amount,
      plan_id: merged.payment_plan,
      plan_name: plan?.name || merged.payment_plan,
      recorded_at: new Date().toISOString(),
    });

    await upsertSchoolExtras(req.params.id, {
      ...renewed,
      subscription_frozen: false,
      total_paid: (Number(extras?.total_paid) || 0) + amount,
      payment_records: JSON.stringify(records),
    });

    res.json(await buildSchoolWithStats(existingSchool));
  } catch (error) {
    res.status(500).json({ error: error.message });
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
registerWalletRoutes(app, { authenticateToken, enforcePlanApproval });
registerSmsBillingRoutes(app, {
  authenticateToken,
  enforcePlanApproval,
  requireSuperAdmin,
  supabase,
});

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
      paystack: {
        configured: Boolean(process.env.PAYSTACK_SECRET_KEY),
        currency: (process.env.PAYSTACK_CURRENCY || 'GHS').toUpperCase(),
        public_key_set: Boolean(process.env.PAYSTACK_PUBLIC_KEY),
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
      paystack: {
        configured: Boolean(process.env.PAYSTACK_SECRET_KEY),
        currency: (process.env.PAYSTACK_CURRENCY || 'GHS').toUpperCase(),
        public_key_set: Boolean(process.env.PAYSTACK_PUBLIC_KEY),
      },
      error: error.message,
    });
  }
});

// ============ PUBLIC STUDENT ID (phone camera QR) ============

app.get('/api/public/id/:barcode', async (req, res) => {
  try {
    let barcode = req.params.barcode || '';
    try {
      barcode = decodeURIComponent(barcode);
    } catch {
      // already decoded
    }
    barcode = barcode.trim();
    if (!barcode) {
      return res.status(400).json({ error: 'Invalid student code' });
    }

    const { data: student, error } = await supabase
      .from('students')
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle();

    if (error) throw error;
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const { data: school } = await supabase
      .from('schools')
      .select('name, logo_url')
      .eq('id', student.school_id)
      .maybeSingle();

    const withPhoto = mergeStudentPhoto(student);

    res.json({
      name: withPhoto.name,
      class: withPhoto.class,
      photo_url: withPhoto.photo_url || null,
      parent_phone: withPhoto.parent_phone || null,
      parent_email: withPhoto.parent_email || null,
      house_address: withPhoto.house_address || null,
      date_of_birth: withPhoto.date_of_birth || null,
      school_name: school?.name || 'School',
      school_logo_url: school?.logo_url || null,
    });
  } catch (error) {
    console.error('Public student ID error:', error);
    res.status(500).json({ error: 'Failed to load student ID' });
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
    const {
      name,
      class: className,
      parentEmail,
      parentPhone,
      houseAddress,
      dateOfBirth,
      rollNumber,
      photo,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Student name is required' });
    }
    if (!className?.trim()) {
      return res.status(400).json({ error: 'Class is required' });
    }
    if (!parentPhone?.trim()) {
      return res.status(400).json({ error: 'Parent phone number is required for SMS' });
    }

    const photoError = validateImage(photo);
    if (photoError) {
      return res.status(400).json({ error: photoError });
    }

    const barcode = `${req.user.schoolId}-STU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const record = {
      school_id: req.user.schoolId,
      name: name.trim(),
      class: className,
      parent_email: parentEmail?.trim() || null,
      parent_phone: parentPhone.trim(),
      house_address: houseAddress?.trim() || null,
      date_of_birth: dateOfBirth || null,
      roll_number: rollNumber?.trim() || null,
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
    const {
      name,
      class: className,
      parentEmail,
      parent_email,
      parentPhone,
      parent_phone,
      houseAddress,
      house_address,
      dateOfBirth,
      date_of_birth,
      rollNumber,
      roll_number,
      photo,
      photo_url: photoUrl,
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (className !== undefined) updates.class = className;
    const nextParentEmail = parentEmail !== undefined ? parentEmail : parent_email;
    if (nextParentEmail !== undefined) updates.parent_email = nextParentEmail;
    const nextParentPhone = parentPhone !== undefined ? parentPhone : parent_phone;
    if (nextParentPhone !== undefined) updates.parent_phone = nextParentPhone;
    const nextHouse = houseAddress !== undefined ? houseAddress : house_address;
    if (nextHouse !== undefined) updates.house_address = nextHouse;
    const nextDob = dateOfBirth !== undefined ? dateOfBirth : date_of_birth;
    if (nextDob !== undefined) updates.date_of_birth = nextDob || null;
    const nextRoll = rollNumber !== undefined ? rollNumber : roll_number;
    if (nextRoll !== undefined) updates.roll_number = nextRoll;

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

const getAttendanceCode = (body) => {
  const raw = (body?.qrCode || body?.barcode || '').trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const match = url.pathname.match(/\/id\/([^/]+)\/?$/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  } catch {
    // not a URL
  }

  const pathMatch = raw.match(/\/id\/([^/?#\s]+)/);
  if (pathMatch?.[1]) {
    try {
      return decodeURIComponent(pathMatch[1]);
    } catch {
      return pathMatch[1];
    }
  }

  return raw;
};

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
      confirmSmsPayment = false,
    } = req.body;

    const { data: schoolAccount, error: schoolError } = await supabase
      .from('schools')
      .select('id, name, payment_plan')
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

    let smsSettlement = null;
    if (channel === 'sms') {
      if (!confirmSmsPayment) {
        return res.status(400).json({
          error: 'Confirm SMS send first. You need enough prepaid school SMS units (convert from School Wallet).',
          code: 'SMS_CONFIRM_REQUIRED',
        });
      }
      try {
        smsSettlement = await settleSmsPayment({
          supabase,
          schoolId: req.user.schoolId,
          schoolName: schoolAccount.name,
          message,
          sendMode,
          recipients,
          recipientPhone,
        });
      } catch (settleErr) {
        const status = settleErr.status || 500;
        return res.status(status).json({
          error: settleErr.message || 'SMS payment failed',
          code: settleErr.code || 'SMS_PAYMENT_FAILED',
        });
      }
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
      console.log(
        `[SMS] Units consumed & queued for ${smsTarget} (${smsSettlement?.quote?.units_required || '?'} units; school left ${smsSettlement?.school_sms_units}): ${String(message).substring(0, 80)}...`
      );
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
            from: getEmailUser(),
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
                  <p style="color: #999; font-size: 12px; margin-bottom: 0;">This is an automated message from NEXUS</p>
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

    res.json({
      ...newMessage,
      sms_billing: smsSettlement || undefined,
    });
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
    await initStudentPhotoStore();
    console.log('Person photo store ready');
    await initAuthSecurityStore();
    console.log('Auth security store ready');
    await initSchoolWalletStore();
    console.log('School wallet store ready');
    await initPlatformSmsStore();
    console.log('Platform SMS store ready');
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