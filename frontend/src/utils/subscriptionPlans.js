export const PLANS = {
  basic: {
    id: 'basic',
    name: 'Starter Plan',
    price: 50,
    currency: 'GHC',
    period: 'month',
    features: [
      'Dashboard',
      'Attendance (manual roll number entry)',
      'Students (add, remove)',
      'Staffs & Non-Staff management',
      'Classes',
      'Scanner',
      'Reports (teachers → administrators only)',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Professional Plan',
    price: 100,
    currency: 'GHC',
    period: 'month',
    features: [
      'Everything in Starter Plan',
      'Attendance with QR code reader',
      'Scanner with QR code support',
      'Reports with student portal view',
      'Message parents & staff (500 parents/mo, 150 words/text)',
      'Check fees paid and unpaid',
      'Fees reflected on your revenue',
      'Unique USSD code for parent fee payments via MoMo',
    ],
  },
};

export const BASIC_ROUTES = [
  '/',
  '/students',
  '/staff',
  '/classes',
  '/attendance',
  '/non-staff',
  '/scanner',
  '/add-student',
  '/report-cards',
];

export const PREMIUM_ROUTES = [
  ...BASIC_ROUTES,
  '/messages',
  '/fees-paid',
  '/fees-unpaid',
];

export const getAllowedRoutes = (plan) => {
  if (plan === 'premium') return PREMIUM_ROUTES;
  if (plan === 'basic') return BASIC_ROUTES;
  return [];
};

export const isRouteAllowed = (plan, path) => {
  const routes = getAllowedRoutes(plan);
  return routes.some((r) => path === r || (r !== '/' && path.startsWith(r)));
};

export const PASSWORD_RESET_CONTACT = {
  email: 'support@schoolms.com',
  phone: '+233 24 000 0000',
};
