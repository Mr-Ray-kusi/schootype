const loaders = {
  '/dashboard': () => import('../pages/Dashboard'),
  '/students': () => import('../pages/students'),
  '/staff': () => import('../pages/staffs'),
  '/attendance': () => import('../pages/attendance'),
  '/scanner': () => import('../pages/scanner'),
  '/collection': () => import('../pages/collection'),
  '/add-student': () => import('../pages/addstudends'),
  '/classes': () => import('../pages/classes'),
  '/messages': () => import('../pages/message'),
  '/report-cards': () => import('../pages/report-cards'),
  '/fees-paid': () => import('../pages/fees-paid'),
  '/fees-unpaid': () => import('../pages/fees-unpaid'),
  '/bank-settings': () => import('../pages/bank-settings'),
  '/school-wallet': () => import('../pages/school-wallet'),
  '/notifications': () => import('../pages/notifications'),
};

const warmed = new Set();

export function prefetchRoute(href) {
  const path = String(href || '').split('?')[0];
  const loader = loaders[path];
  if (!loader || warmed.has(path)) return;
  warmed.add(path);
  loader().catch(() => {
    warmed.delete(path);
  });
}
