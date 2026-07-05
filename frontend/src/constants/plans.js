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
    highlighted: false,
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
    highlighted: true,
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
    highlighted: false,
  },
};

export const PLAN_LIST = Object.values(PAYMENT_PLANS);

export const getPlan = (planId) => PAYMENT_PLANS[planId] || null;

export const hasFeature = (planId, featureKey) => {
  const plan = getPlan(planId);
  return plan ? plan.featureKeys.includes(featureKey) : false;
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
    items: ['Bulk SMS to parents & staff (Professional)', 'Email broadcasts (Enterprise)', 'Group & individual messaging', 'Fee payment reminders'],
  },
  {
    title: 'Academics & Finance',
    items: ['Class organization', 'Report cards & teacher uploads', 'Salary & fees tracking'],
  },
];

export const hasMessagingAccess = (planFeatures = []) =>
  planFeatures.includes('messages-sms') || planFeatures.includes('messages-email');
