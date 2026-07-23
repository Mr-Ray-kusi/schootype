export const PAYMENT_PLANS = {
  basic: {
    id: 'basic',
    name: 'Starter',
    price: 20,
    period: 'month',
    description: 'Core people management for small schools just getting organized.',
    features: [
      'Dashboard overview & school stats',
      'Student registry with QR code IDs',
      'Staff profiles & role management',
      'Non-staff support team records',
      'Quick student enrollment form',
      'School wallet, bank & MoMo settings',
      'Up to 175 students & 15 staff',
    ],
    featureKeys: [
      'dashboard',
      'students',
      'add-student',
      'staff',
      'non-staff',
      'bank-settings',
      'school-wallet',
    ],
    limits: { maxStudents: 175, maxStaff: 15, maxNonStaff: 10 },
  },
  standard: {
    id: 'standard',
    name: 'Professional',
    price: 50,
    period: 'month',
    description: 'Attendance automation, daily operations, and bulk SMS for active schools.',
    features: [
      'Everything in Starter',
      'Daily attendance tracking & summaries',
      'QR code scanner check-in',
      'Attendance filters, export & print',
      'Dashboard attendance charts',
      'Bulk SMS messaging to parents & staff',
      'School wallet deposits & withdrawals',
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
      'bank-settings',
      'school-wallet',
    ],
    limits: { maxStudents: 450, maxStaff: 35, maxNonStaff: 25 },
  },
  premium: {
    id: 'premium',
    name: 'Enterprise',
    price: 75,
    period: 'month',
    description: 'Full academic, communication, and finance suite for established institutions.',
    features: [
      'Everything in Professional',
      'Bulk SMS & email messaging',
      'Class management & organization',
      'Report cards & teacher result uploads',
      'Fees paid — salary & payment tracking',
      'Fees unpaid — overdue alerts & reminders',
      'School wallet with Paystack bank & MoMo',
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
      'bank-settings',
      'school-wallet',
    ],
    limits: { maxStudents: null, maxStaff: null, maxNonStaff: null },
  },
};

export const VALID_PLAN_IDS = Object.keys(PAYMENT_PLANS);

export const getPlan = (planId) => PAYMENT_PLANS[planId] || null;

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
    const { featureKeys, ...publicPlan } = PAYMENT_PLANS[id];
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
  'bank-settings': 'Bank Settings',
  'school-wallet': 'School Wallet',
};
