import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Home from './pages/home';
import Login from './pages/login';
import Signup from './pages/sigup';
import VerifyEmail from './pages/verify-email';
import Plans from './pages/plans';
import SelectPlan from './pages/select-plan';
import MobileScanner from './pages/mobile-scanner';
import StudentPublicId from './pages/student-public-id';
import StaffPortal from './pages/staff-portal';
import Layout from './components/layout';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/authcontext';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Students = lazy(() => import('./pages/students'));
const Staff = lazy(() => import('./pages/staffs'));
const NonStaff = lazy(() => import('./pages/nonstaffs'));
const Attendance = lazy(() => import('./pages/attendance'));
const Messages = lazy(() => import('./pages/message'));
const Scanner = lazy(() => import('./pages/scanner'));
const AddStudent = lazy(() => import('./pages/addstudends'));
const Classes = lazy(() => import('./pages/classes'));
const ReportCards = lazy(() => import('./pages/report-cards'));
const FeesPaid = lazy(() => import('./pages/fees-paid'));
const FeesUnpaid = lazy(() => import('./pages/fees-unpaid'));
const BankSettings = lazy(() => import('./pages/bank-settings'));
const SchoolWallet = lazy(() => import('./pages/school-wallet'));
const SuperAdmin = lazy(() => import('./pages/super-admin'));
const SuperAdminSchool = lazy(() => import('./pages/super-admin-school'));
const SuperAdminBroadcast = lazy(() => import('./pages/super-admin-broadcast'));
const SuperAdminSms = lazy(() => import('./pages/super-admin-sms'));
const SuperAdminMonitor = lazy(() => import('./pages/super-admin-monitor'));

const LoadingScreen = () => (
  <div className="flex items-center justify-center h-screen bg-slate-900 text-slate-300">Loading...</div>
);

const SchoolAdminRoute = () => {
  const { token, school, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!token) return <Navigate to="/login" />;
  if (!school) return <LoadingScreen />;
  if (school?.role === 'super_admin') return <Navigate to="/super-admin" />;
  if (!school?.payment_plan) return <Navigate to="/select-plan" />;
  return <Outlet />;
};

const PlanFeatureRoute = ({ feature, features }) => {
  const { hasFeature, includesPlanFeature } = useAuth();
  const featureKeys = features || (feature ? [feature] : []);

  if (featureKeys.length && !featureKeys.some((key) => includesPlanFeature(key))) {
    return <Navigate to="/dashboard" />;
  }
  if (featureKeys.length && !featureKeys.some((key) => hasFeature(key))) {
    return <Navigate to="/dashboard" />;
  }
  return <Outlet />;
};

const SuperAdminRoute = () => {
  const { token, school, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!token) return <Navigate to="/login" />;
  if (!school) return <LoadingScreen />;
  if (school?.role !== 'super_admin') return <Navigate to="/dashboard" />;
  return <Outlet />;
};

const FinanceRoute = ({ feature }) => {
  const { token, school, loading, isSuperAdmin, hasFeature, includesPlanFeature } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!token) return <Navigate to="/login" />;
  if (isSuperAdmin || school?.role === 'super_admin') return <Outlet />;
  if (!school) return <LoadingScreen />;
  if (!school?.payment_plan) return <Navigate to="/select-plan" />;
  if (feature && !includesPlanFeature(feature)) return <Navigate to="/dashboard" />;
  if (feature && !hasFeature(feature)) return <Navigate to="/dashboard" />;
  return <Outlet />;
};

const SelectPlanRoute = ({ children }) => {
  const { token, school, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!token) return <Navigate to="/login" />;
  if (!school) return <LoadingScreen />;
  if (school?.role === 'super_admin') return <Navigate to="/super-admin" />;
  if (school?.payment_plan) return <Navigate to="/dashboard" />;
  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/plans" element={<Plans />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/id/:barcode" element={<StudentPublicId />} />
              <Route path="/scan/:token" element={<MobileScanner />} />
              <Route path="/staff-portal/:token" element={<StaffPortal />} />
              <Route
                path="/select-plan"
                element={
                  <SelectPlanRoute>
                    <SelectPlan />
                  </SelectPlanRoute>
                }
              />

              <Route element={<SchoolAdminRoute />}>
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route element={<PlanFeatureRoute feature="students" />}>
                    <Route path="/students" element={<Students />} />
                  </Route>
                  <Route element={<PlanFeatureRoute feature="staff" />}>
                    <Route path="/staff" element={<Staff />} />
                  </Route>
                  <Route element={<PlanFeatureRoute feature="non-staff" />}>
                    <Route path="/non-staff" element={<NonStaff />} />
                  </Route>
                  <Route element={<PlanFeatureRoute feature="attendance" />}>
                    <Route path="/attendance" element={<Attendance />} />
                  </Route>
                  <Route element={<PlanFeatureRoute feature="classes" />}>
                    <Route path="/classes" element={<Classes />} />
                  </Route>
                  <Route element={<PlanFeatureRoute feature="report-cards" />}>
                    <Route path="/report-cards" element={<ReportCards />} />
                  </Route>
                  <Route element={<PlanFeatureRoute feature="fees-paid" />}>
                    <Route path="/fees-paid" element={<FeesPaid />} />
                  </Route>
                  <Route element={<PlanFeatureRoute feature="fees-unpaid" />}>
                    <Route path="/fees-unpaid" element={<FeesUnpaid />} />
                  </Route>
                  <Route element={<PlanFeatureRoute features={['messages-sms', 'messages-email']} />}>
                    <Route path="/messages" element={<Messages />} />
                  </Route>
                  <Route element={<PlanFeatureRoute feature="scanner" />}>
                    <Route path="/scanner" element={<Scanner />} />
                  </Route>
                  <Route element={<PlanFeatureRoute feature="add-student" />}>
                    <Route path="/add-student" element={<AddStudent />} />
                  </Route>
                </Route>
              </Route>

              <Route element={<FinanceRoute feature="bank-settings" />}>
                <Route element={<Layout />}>
                  <Route path="/bank-settings" element={<BankSettings />} />
                </Route>
              </Route>
              <Route element={<FinanceRoute feature="school-wallet" />}>
                <Route element={<Layout />}>
                  <Route path="/school-wallet" element={<SchoolWallet />} />
                </Route>
              </Route>

              <Route element={<SuperAdminRoute />}>
                <Route element={<Layout />}>
                  <Route path="/super-admin" element={<SuperAdmin />} />
                  <Route path="/super-admin/schools/:schoolId" element={<SuperAdminSchool />} />
                  <Route path="/super-admin/bank-settings" element={<BankSettings />} />
                  <Route path="/super-admin/platform-wallet" element={<SchoolWallet />} />
                  <Route path="/super-admin/email-schools" element={<SuperAdminBroadcast />} />
                  <Route path="/super-admin/sms" element={<SuperAdminSms />} />
                  <Route path="/super-admin/monitor" element={<SuperAdminMonitor />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
