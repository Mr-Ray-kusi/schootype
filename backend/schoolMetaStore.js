import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const META_PATH = path.join(__dirname, 'data', 'school-meta.json');

const defaultMeta = () => ({
  subscriptionPlan: null,
  subscriptionStatus: 'pending',
  subscriptionExpiresAt: null,
  ussdCode: null,
  logoUrl: null,
  payments: [],
});

const loadAll = () => {
  try {
    if (fs.existsSync(META_PATH)) {
      return JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
    }
  } catch (err) {
    console.warn('Could not load school meta:', err.message);
  }
  return {};
};

const saveAll = (data) => {
  fs.mkdirSync(path.dirname(META_PATH), { recursive: true });
  fs.writeFileSync(META_PATH, JSON.stringify(data, null, 2));
};

export const getSchoolMeta = (schoolId) => {
  const all = loadAll();
  return { ...defaultMeta(), ...(all[schoolId] || {}) };
};

export const setSchoolMeta = (schoolId, updates) => {
  const all = loadAll();
  all[schoolId] = { ...defaultMeta(), ...(all[schoolId] || {}), ...updates };
  saveAll(all);
  return all[schoolId];
};

export const mergeSchoolWithMeta = (school) => {
  if (!school) return null;
  const meta = getSchoolMeta(school.id);
  return {
    id: school.id,
    name: school.name,
    email: school.email,
    created_at: school.created_at,
    logoUrl: meta.logoUrl || school.logo_url || null,
    subscriptionPlan: meta.subscriptionPlan || school.subscription_plan || null,
    subscriptionStatus: meta.subscriptionStatus || school.subscription_status || 'pending',
    subscriptionExpiresAt: meta.subscriptionExpiresAt || school.subscription_expires_at || null,
    ussdCode: meta.ussdCode || school.ussd_code || null,
  };
};

export const addSubscriptionPayment = (schoolId, { plan, amount, momoPhone, paymentRef }) => {
  const meta = getSchoolMeta(schoolId);
  const payment = {
    id: uuidv4(),
    school_id: schoolId,
    plan,
    amount,
    currency: 'GHS',
    payment_reference: paymentRef,
    momo_phone: momoPhone,
    status: 'pending_approval',
    created_at: new Date().toISOString(),
  };
  const payments = [payment, ...(meta.payments || [])];
  setSchoolMeta(schoolId, {
    payments,
    subscriptionPlan: plan,
    subscriptionStatus: 'pending_approval',
  });
  return payment;
};

export const getLatestPayment = (schoolId) => {
  const meta = getSchoolMeta(schoolId);
  return (meta.payments || []).find((p) => p.status === 'pending_approval') || meta.payments?.[0] || null;
};

export const approveSchoolSubscription = (schoolId, approvedBy, generateUssdCode) => {
  const meta = getSchoolMeta(schoolId);
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const updates = {
    subscriptionStatus: 'active',
    subscriptionExpiresAt: expiresAt.toISOString(),
    payments: (meta.payments || []).map((p) =>
      p.status === 'pending_approval'
        ? { ...p, status: 'approved', approved_at: new Date().toISOString(), approved_by: approvedBy }
        : p
    ),
  };

  if (meta.subscriptionPlan === 'premium' && !meta.ussdCode) {
    updates.ussdCode = generateUssdCode(schoolId);
  }

  return setSchoolMeta(schoolId, updates);
};

export const rejectSchoolSubscription = (schoolId, rejectedBy) => {
  const meta = getSchoolMeta(schoolId);
  return setSchoolMeta(schoolId, {
    subscriptionStatus: 'pending',
    payments: (meta.payments || []).map((p) =>
      p.status === 'pending_approval' ? { ...p, status: 'rejected', approved_by: rejectedBy } : p
    ),
  });
};

export const getApprovedRevenue = () => {
  const all = loadAll();
  let total = 0;
  const payments = [];
  Object.values(all).forEach((meta) => {
    (meta.payments || []).forEach((p) => {
      if (p.status === 'approved') {
        total += Number(p.amount);
        payments.push(p);
      }
    });
  });
  return { totalRevenue: total, payments };
};
