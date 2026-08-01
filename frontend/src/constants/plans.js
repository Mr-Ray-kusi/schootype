export const PAYMENT_PLANS = {
  small: {
    id: 'small',
    name: 'Small School',
    sizeLabel: 'Up to 200 students',
    price: 4650,
    priceGhsMin: 3500,
    priceGhsMax: 5800,
    priceUsdMin: 300,
    priceUsdMax: 500,
    period: 'year',
    description: 'Core school operations for campuses with up to 200 students.',
    features: [
      'Dashboard overview & school stats',
      'Student registry with QR code IDs',
      'Staff profiles & role management',
      'Non-staff support team records',
      'Quick student enrollment form',
      'School wallet, bank & MoMo settings',
      'Up to 200 students',
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
    limits: { maxStudents: 200, maxStaff: 25, maxNonStaff: 15 },
    highlighted: false,
  },
  mid: {
    id: 'mid',
    name: 'Mid-sized School',
    sizeLabel: '200 – 1,000 students',
    price: 11650,
    priceGhsMin: 5800,
    priceGhsMax: 17500,
    priceUsdMin: 500,
    priceUsdMax: 1500,
    period: 'year',
    description: 'Attendance, messaging, and daily operations for growing schools.',
    features: [
      'Everything in Small School',
      'Daily attendance tracking & summaries',
      'QR code scanner check-in',
      'Attendance filters & print',
      'Dashboard attendance charts',
      'Bulk SMS messaging to parents & staff',
      'School wallet deposits & withdrawals',
      'Up to 1,000 students',
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
    limits: { maxStudents: 1000, maxStaff: 80, maxNonStaff: 40 },
    highlighted: true,
  },
  large: {
    id: 'large',
    name: 'Large School',
    sizeLabel: '1,000+ students',
    price: 26250,
    priceGhsMin: 17500,
    priceGhsMax: 35000,
    priceUsdMin: 1500,
    priceUsdMax: 3000,
    period: 'year',
    description: 'Full academic, communication, and finance suite for large institutions.',
    features: [
      'Everything in Mid-sized School',
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
    highlighted: false,
  },
};

/** Legacy monthly plan IDs → yearly size tiers */
export const PLAN_ALIASES = {
  basic: 'small',
  standard: 'mid',
  premium: 'large',
  starter: 'small',
  professional: 'mid',
  enterprise: 'large',
};

export const PLAN_LIST = Object.values(PAYMENT_PLANS);

export const resolvePlanId = (planId) => {
  if (!planId) return null;
  if (PAYMENT_PLANS[planId]) return planId;
  return PLAN_ALIASES[planId] || planId;
};

export const getPlan = (planId) => {
  const resolved = resolvePlanId(planId);
  return PAYMENT_PLANS[resolved] || null;
};

export const hasFeature = (planId, featureKey) => {
  const plan = getPlan(planId);
  return plan ? plan.featureKeys.includes(featureKey) : false;
};

export const formatPlanPriceGhs = (plan) => {
  if (!plan) return '';
  if (plan.priceGhsMin != null && plan.priceGhsMax != null) {
    const suffix = plan.id === 'large' ? '+' : '';
    return `₵${plan.priceGhsMin.toLocaleString()} – ₵${plan.priceGhsMax.toLocaleString()}${suffix}`;
  }
  return `₵${Number(plan.price || 0).toLocaleString()}`;
};

export const formatPlanPriceUsd = (plan) => {
  if (!plan) return '';
  if (plan.priceUsdMin != null && plan.priceUsdMax != null) {
    return `$${plan.priceUsdMin.toLocaleString()} – $${plan.priceUsdMax.toLocaleString()}${
      plan.id === 'large' ? '+' : ''
    }`;
  }
  return '';
};

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

export const ROUTE_FEATURE_MAP = {
  '/dashboard': 'dashboard',
  '/students': 'students',
  '/staff': 'staff',
  '/non-staff': 'non-staff',
  '/attendance': 'attendance',
  '/scanner': 'scanner',
  '/add-student': 'add-student',
  '/classes': 'classes',
  '/messages': 'messages-sms',
  '/report-cards': 'report-cards',
  '/fees-paid': 'fees-paid',
  '/fees-unpaid': 'fees-unpaid',
  '/bank-settings': 'bank-settings',
  '/school-wallet': 'school-wallet',
};

export const SYSTEM_CAPABILITY_GROUPS = [
  {
    title: 'People Management',
    items: ['Student registry & QR codes', 'Staff & teacher profiles', 'Non-staff records', 'Enrollment forms'],
  },
  {
    title: 'Attendance',
    items: ['Daily check-in scanner', 'Attendance logs & filters', 'Summary charts & export'],
  },
  {
    title: 'Communication',
    items: ['Bulk SMS to parents & staff (Mid-sized)', 'Email broadcasts (Large)', 'In-app school notifications', 'Fee payment reminders'],
  },
  {
    title: 'Academics & Finance',
    items: ['Class organization', 'Report cards & teacher uploads', 'Salary & fees tracking', 'School wallet & MoMo/bank payouts'],
  },
];

export const hasMessagingAccess = (planFeatures = []) =>
  planFeatures.includes('messages-sms') || planFeatures.includes('messages-email');
