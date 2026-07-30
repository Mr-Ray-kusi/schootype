import dotenv from 'dotenv';

dotenv.config();

/**
 * Plan catalog for Schooltype.
 * Prices follow PAYSTACK_CURRENCY (default GHS — Ghana Paystack merchants).
 * Switch via backend/.env: PAYSTACK_CURRENCY=GHS|USD|NGN
 */
const PLAN_PRICES = {
  GHS: { basic: 200, standard: 500, premium: 750 },
  USD: { basic: 20, standard: 50, premium: 75 },
  NGN: { basic: 20000, standard: 50000, premium: 75000 },
};

const SUPPORTED_CURRENCIES = Object.keys(PLAN_PRICES);

export function getActiveCurrency() {
  const raw = (process.env.PAYSTACK_CURRENCY || 'GHS').toUpperCase().trim();
  return SUPPORTED_CURRENCIES.includes(raw) ? raw : 'GHS';
}

/** @deprecated Prefer getActiveCurrency() — may be stale if read at import time. */
export const PLAN_CURRENCY = getActiveCurrency();

const PLAN_DEFS = {
  basic: {
    id: 'basic',
    name: 'Starter',
    period: 'month',
    description: 'Core people management for small schools just getting organized.',
    features: [
      'Dashboard overview & school stats',
      'Student registry with QR code IDs',
      'Staff profiles & role management',
      'Non-staff support team records',
      'Quick student enrollment form',
      'Up to 175 students & 15 staff',
    ],
    featureKeys: [
      'dashboard',
      'students',
      'add-student',
      'staff',
      'non-staff',
    ],
    limits: { maxStudents: 175, maxStaff: 15, maxNonStaff: 10 },
  },
  standard: {
    id: 'standard',
    name: 'Professional',
    period: 'month',
    description: 'Attendance automation, daily operations, and bulk SMS for active schools.',
    features: [
      'Everything in Starter',
      'Daily attendance tracking & summaries',
      'QR code scanner check-in',
      'Attendance filters, export & print',
      'Dashboard attendance charts',
      'Bulk SMS messaging to parents & staff',
      'Up to 450 students & 35 staff',
    ],
    featureKeys: [
      'dashboard',
      'students',
      'add-student',
      'staff',
      'non-staff',
      'attendance',
      'scanner',
      'messages-sms',
    ],
    limits: { maxStudents: 450, maxStaff: 35, maxNonStaff: 25 },
  },
  premium: {
    id: 'premium',
    name: 'Enterprise',
    period: 'month',
    description: 'Full academic, communication, and finance suite for established institutions.',
    features: [
      'Everything in Professional',
      'Bulk SMS & email messaging',
      'Class management & organization',
      'Report cards & teacher result uploads',
      'Fees paid — salary & payment tracking',
      'Fees unpaid — overdue alerts & reminders',
      'Unlimited students, staff & non-staff',
    ],
    featureKeys: [
      'dashboard',
      'students',
      'add-student',
      'staff',
      'non-staff',
      'attendance',
      'scanner',
      'messages-sms',
      'messages-email',
      'classes',
      'report-cards',
      'fees-paid',
      'fees-unpaid',
    ],
    limits: { maxStudents: null, maxStaff: null, maxNonStaff: null },
  },
};

function buildPlans(currency = getActiveCurrency()) {
  const prices = PLAN_PRICES[currency] || PLAN_PRICES.GHS;
  const plans = {};
  for (const [id, def] of Object.entries(PLAN_DEFS)) {
    plans[id] = {
      ...def,
      price: prices[id],
      currency,
    };
  }
  return plans;
}

export function getPaymentPlans() {
  return buildPlans();
}

/** Snapshot at first access after env load — prefer getPaymentPlans(). */
export const PAYMENT_PLANS = buildPlans();

export const VALID_PLAN_IDS = Object.keys(PLAN_DEFS);

export const getPlan = (planId) => getPaymentPlans()[planId] || null;

export const getPlanFeatures = (planId) => {
  const plan = getPlan(planId);
  return plan ? plan.featureKeys : [];
};

export const hasPlanFeature = (planId, featureKey) => {
  if (!planId) return false;
  return getPlanFeatures(planId).includes(featureKey);
};

export const getPlansList = () =>
  VALID_PLAN_IDS.map((id) => {
    const { featureKeys, ...publicPlan } = getPaymentPlans()[id];
    return publicPlan;
  });

export const FEATURE_LABELS = {
  dashboard: 'Dashboard',
  students: 'Students',
  'add-student': 'Add Student',
  staff: 'Staff',
  'non-staff': 'Non-Staff',
  attendance: 'Attendance',
  scanner: 'Scanner',
  'messages-sms': 'Bulk SMS',
  'messages-email': 'Bulk Email',
  classes: 'Classes',
  'report-cards': 'Report Cards',
  'fees-paid': 'Fees Paid',
  'fees-unpaid': 'Fees Unpaid',
};
