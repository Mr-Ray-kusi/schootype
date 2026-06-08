import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/login';
import Signup from './pages/sigup';
import Dashboard from './pages/Dashboard';
import Students from './pages/students';
import Staff from './pages/staffs';
import NonStaff from './pages/nonstaffs';
import Attendance from './pages/attendance';
import Messages from './pages/message';
import Scanner from './pages/scanner';
import AddStudent from './pages/addstudends';
import Classes from './pages/classes';
import ReportCards from './pages/report-cards';
import FeesPaid from './pages/fees-paid';
import FeesUnpaid from './pages/fees-unpaid';
import { AuthProvider, useAuth } from './contexts/authcontext';

const PrivateRoute = ({ children }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />
          <Route path="/students" element={
            <PrivateRoute>
              <Students />
            </PrivateRoute>
          } />
          <Route path="/staff" element={
            <PrivateRoute>
              <Staff />
            </PrivateRoute>
          } />
          <Route path="/non-staff" element={
            <PrivateRoute>
              <NonStaff />
            </PrivateRoute>
          } />
          <Route path="/attendance" element={
            <PrivateRoute>
              <Attendance />
            </PrivateRoute>
          } />
          <Route path="/classes" element={
            <PrivateRoute>
              <Classes />
            </PrivateRoute>
          } />
          <Route path="/report-cards" element={
            <PrivateRoute>
              <ReportCards />
            </PrivateRoute>
          } />
          <Route path="/fees-paid" element={
            <PrivateRoute>
              <FeesPaid />
            </PrivateRoute>
          } />
          <Route path="/fees-unpaid" element={
            <PrivateRoute>
              <FeesUnpaid />
            </PrivateRoute>
          } />
          <Route path="/messages" element={
            <PrivateRoute>
              <Messages />
            </PrivateRoute>
          } />
          <Route path="/scanner" element={
            <PrivateRoute>
              <Scanner />
            </PrivateRoute>
          } />
          <Route path="/add-student" element={
            <PrivateRoute>
              <AddStudent />
            </PrivateRoute>
          } />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;