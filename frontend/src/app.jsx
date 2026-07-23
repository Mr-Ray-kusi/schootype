import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/home';
import Login from './pages/login';
import Signup from './pages/sigup';
import Plans from './pages/plans';
import SelectPlan from './pages/select-plan';
import Dashboard from './pages/Dashboard';
import Students from './pages/students';
import Staff from './pages/staffs';
import NonStaff from './pages/nonstaffs';
import Attendance from './pages/attendance';
import Messages from './pages/message';
import Scanner from './pages/scanner';
import MobileScanner from './pages/mobile-scanner';
import AddStudent from './pages/addstudends';
import Classes from './pages/classes';
import ReportCards from './pages/report-cards';
import FeesPaid from './pages/fees-paid';
import FeesUnpaid from './pages/fees-unpaid';
import BankSettings from './pages/bank-settings';
import SchoolWallet from './pages/school-wallet';
import SuperAdmin from './pages/super-admin';
import SuperAdminSchool from './pages/super-admin-school';
import SuperAdminBroadcast from './pages/super-admin-broadcast';
import SuperAdminSms from './pages/super-admin-sms';
import StudentPublicId from './pages/student-public-id';
import { AuthProvider, useAuth } from './contexts/authcontext';

const LoadingScreen = () => (
  <div className="flex items-center justify-center h-screen bg-slate-900 text-slate-300">Loading...</div>
);

const SchoolAdminRoute = ({ children }) => {
  const { token, school, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!token) return <Navigate to="/login" />;
  if (school?.role === 'super_admin') return <Navigate to="/super-admin" />;
  if (!school?.payment_plan) return <Navigate to="/select-plan" />;
  return children;
};

const PlanFeatureRoute = ({ feature, features, children }) => {
  const { token, school, loading, hasFeature, includesPlanFeature } = useAuth();
  const featureKeys = features || (feature ? [feature] : []);

  if (loading) return <LoadingScreen />;
  if (!token) return <Navigate to="/login" />;
  if (school?.role === 'super_admin') return <Navigate to="/super-admin" />;
  if (!school?.payment_plan) return <Navigate to="/select-plan" />;
  if (featureKeys.length && !featureKeys.some((key) => includesPlanFeature(key))) {
    return <Navigate to="/dashboard" />;
  }
  if (featureKeys.length && !featureKeys.some((key) => hasFeature(key))) {
    return <Navigate to="/dashboard" />;
  }
  return children;
};

const SuperAdminRoute = ({ children }) => {
  const { token, school, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!token) return <Navigate to="/login" />;
  if (school?.role !== 'super_admin') return <Navigate to="/dashboard" />;
  return children;
};

/** Bank settings / wallet — school admins need the plan feature; super admin always allowed. */
const FinanceRoute = ({ feature, children }) => {
  const { token, school, loading, isSuperAdmin, hasFeature, includesPlanFeature } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!token) return <Navigate to="/login" />;
  if (isSuperAdmin || school?.role === 'super_admin') return children;
  if (!school?.payment_plan) return <Navigate to="/select-plan" />;
  if (feature && !includesPlanFeature(feature)) return <Navigate to="/dashboard" />;
  if (feature && !hasFeature(feature)) return <Navigate to="/dashboard" />;
  return children;
};

const SelectPlanRoute = ({ children }) => {
  const { token, school, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!token) return <Navigate to="/login" />;
  if (school?.role === 'super_admin') return <Navigate to="/super-admin" />;
  if (school?.payment_plan) return <Navigate to="/dashboard" />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/id/:barcode" element={<StudentPublicId />} />
          <Route path="/scan/:token" element={<MobileScanner />} />
          <Route path="/select-plan" element={
            <SelectPlanRoute><SelectPlan /></SelectPlanRoute>
          } />
          <Route path="/dashboard" element={
            <SchoolAdminRoute><Dashboard /></SchoolAdminRoute>
          } />
          <Route path="/super-admin" element={
            <SuperAdminRoute><SuperAdmin /></SuperAdminRoute>
          } />
          <Route path="/super-admin/schools/:schoolId" element={
            <SuperAdminRoute><SuperAdminSchool /></SuperAdminRoute>
          } />
          <Route path="/super-admin/bank-settings" element={
            <SuperAdminRoute><BankSettings /></SuperAdminRoute>
          } />
          <Route path="/super-admin/platform-wallet" element={
            <SuperAdminRoute><SchoolWallet /></SuperAdminRoute>
          } />
          <Route path="/super-admin/email-schools" element={
            <SuperAdminRoute><SuperAdminBroadcast /></SuperAdminRoute>
          } />
          <Route path="/super-admin/sms" element={
            <SuperAdminRoute><SuperAdminSms /></SuperAdminRoute>
          } />
          <Route path="/students" element={
            <SchoolAdminRoute><PlanFeatureRoute feature="students"><Students /></PlanFeatureRoute></SchoolAdminRoute>
          } />
          <Route path="/staff" element={
            <SchoolAdminRoute><PlanFeatureRoute feature="staff"><Staff /></PlanFeatureRoute></SchoolAdminRoute>
          } />
          <Route path="/non-staff" element={
            <SchoolAdminRoute><PlanFeatureRoute feature="non-staff"><NonStaff /></PlanFeatureRoute></SchoolAdminRoute>
          } />
          <Route path="/attendance" element={
            <SchoolAdminRoute><PlanFeatureRoute feature="attendance"><Attendance /></PlanFeatureRoute></SchoolAdminRoute>
          } />
          <Route path="/classes" element={
            <SchoolAdminRoute><PlanFeatureRoute feature="classes"><Classes /></PlanFeatureRoute></SchoolAdminRoute>
          } />
          <Route path="/report-cards" element={
            <SchoolAdminRoute><PlanFeatureRoute feature="report-cards"><ReportCards /></PlanFeatureRoute></SchoolAdminRoute>
          } />
          <Route path="/fees-paid" element={
            <SchoolAdminRoute><PlanFeatureRoute feature="fees-paid"><FeesPaid /></PlanFeatureRoute></SchoolAdminRoute>
          } />
          <Route path="/fees-unpaid" element={
            <SchoolAdminRoute><PlanFeatureRoute feature="fees-unpaid"><FeesUnpaid /></PlanFeatureRoute></SchoolAdminRoute>
          } />
          <Route path="/bank-settings" element={
            <FinanceRoute feature="bank-settings"><BankSettings /></FinanceRoute>
          } />
          <Route path="/school-wallet" element={
            <FinanceRoute feature="school-wallet"><SchoolWallet /></FinanceRoute>
          } />
          <Route path="/messages" element={
            <SchoolAdminRoute>
              <PlanFeatureRoute features={['messages-sms', 'messages-email']}>
                <Messages />
              </PlanFeatureRoute>
            </SchoolAdminRoute>
          } />
          <Route path="/scanner" element={
            <SchoolAdminRoute><PlanFeatureRoute feature="scanner"><Scanner /></PlanFeatureRoute></SchoolAdminRoute>
          } />
          <Route path="/add-student" element={
            <SchoolAdminRoute><PlanFeatureRoute feature="add-student"><AddStudent /></PlanFeatureRoute></SchoolAdminRoute>
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
