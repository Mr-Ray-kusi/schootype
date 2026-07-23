import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/authcontext';
import { Shield, CheckCircle, XCircle, Key, LogOut, DollarSign, School } from 'lucide-react';

const SuperAdminDashboard = () => {
  const { superAdminToken, superAdminLogout } = useAuth();
  const navigate = useNavigate();
  const [schools, setSchools] = useState([]);
  const [revenue, setRevenue] = useState({ totalRevenue: 0, payments: [] });
  const [loading, setLoading] = useState(true);
  const [resetPasswordId, setResetPasswordId] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const authHeaders = { Authorization: `Bearer ${superAdminToken}` };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [schoolsRes, revenueRes] = await Promise.all([
        axios.get('/api/super-admin/schools', { headers: authHeaders }),
        axios.get('/api/super-admin/revenue', { headers: authHeaders }),
      ]);
      setSchools(schoolsRes.data);
      setRevenue(revenueRes.data);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (schoolId) => {
    try {
      await axios.post(`/api/super-admin/approve/${schoolId}`, {}, { headers: authHeaders });
      toast.success('School approved and subscription activated');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Approval failed');
    }
  };

  const handleReject = async (schoolId) => {
    try {
      await axios.post(`/api/super-admin/reject/${schoolId}`, {}, { headers: authHeaders });
      toast.success('Payment rejected');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rejection failed');
    }
  };

  const handleResetPassword = async (schoolId) => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await axios.put(`/api/super-admin/schools/${schoolId}/password`, { newPassword }, { headers: authHeaders });
      toast.success('Password reset successfully');
      setResetPasswordId(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Password reset failed');
    }
  };

  const handleUpdateAccess = async (schoolId, plan, status) => {
    try {
      await axios.put(`/api/super-admin/schools/${schoolId}/access`, {
        subscriptionPlan: plan,
        subscriptionStatus: status,
      }, { headers: authHeaders });
      toast.success('Access updated');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    }
  };

  const handleLogout = () => {
    superAdminLogout();
    navigate('/super-admin/login');
  };

  const getNavAccess = (plan) => {
    if (plan === 'premium') return 'Dashboard, Attendance (QR code), Students, Staff, Classes, Scanner, Reports (student portal), Messages, Fees Paid/Unpaid, USSD';
    if (plan === 'basic') return 'Dashboard, Attendance (manual), Students, Staff, Classes, Scanner, Reports (admin only)';
    return 'None — pending subscription';
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Super Admin Dashboard</h1>
              <p className="text-xs text-slate-400">Manage schools, subscriptions & payments</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-950 rounded-lg">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center gap-3">
              <School className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-sm text-slate-400">Total Schools</p>
                <p className="text-3xl font-bold text-white">{schools.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="text-sm text-slate-400">Active Subscriptions</p>
                <p className="text-3xl font-bold text-white">{schools.filter((s) => s.subscription_status === 'active').length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-amber-400" />
              <div>
                <p className="text-sm text-slate-400">Total Revenue</p>
                <p className="text-3xl font-bold text-white">GHC {revenue.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white">Registered Schools</h2>
            <p className="text-sm text-slate-400">Approve payments, manage access, and reset passwords</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-6 py-3 text-left">School</th>
                  <th className="px-6 py-3 text-left">Email</th>
                  <th className="px-6 py-3 text-left">Plan</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Payment</th>
                  <th className="px-6 py-3 text-left">Nav Access</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {schools.map((school) => (
                  <tr key={school.id} className="hover:bg-slate-800/50">
                    <td className="px-6 py-4 text-white font-medium">{school.name}</td>
                    <td className="px-6 py-4 text-slate-300">{school.email}</td>
                    <td className="px-6 py-4">
                      <select
                        value={school.subscription_plan || ''}
                        onChange={(e) => handleUpdateAccess(school.id, e.target.value, school.subscription_status)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                      >
                        <option value="">None</option>
                        <option value="basic">Basic (GHC50)</option>
                        <option value="premium">Premium (GHC100)</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        school.subscription_status === 'active' ? 'bg-emerald-600 text-white' :
                        school.subscription_status === 'pending_approval' ? 'bg-amber-600 text-white' :
                        'bg-slate-600 text-white'
                      }`}>
                        {school.subscription_status || 'pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 text-xs">
                      {school.latestPayment ? (
                        <>GHC {school.latestPayment.amount} — {school.latestPayment.status}</>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs max-w-xs">{getNavAccess(school.subscription_plan)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {school.subscription_status === 'pending_approval' && (
                          <>
                            <button onClick={() => handleApprove(school.id)} className="p-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700" title="Approve">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleReject(school.id)} className="p-1.5 rounded bg-red-600 text-white hover:bg-red-700" title="Reject">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button onClick={() => setResetPasswordId(school.id)} className="p-1.5 rounded bg-slate-700 text-white hover:bg-slate-600" title="Reset Password">
                          <Key className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {schools.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400">No schools registered yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {resetPasswordId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Reset School Password</h3>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="input mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => handleResetPassword(resetPasswordId)} className="btn-primary flex-1">Reset</button>
              <button onClick={() => { setResetPasswordId(null); setNewPassword(''); }} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
