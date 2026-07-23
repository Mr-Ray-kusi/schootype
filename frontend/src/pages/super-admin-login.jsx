import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '../contexts/authcontext';
import { Shield } from 'lucide-react';

const DEFAULT_EMAIL = 'admin@schoolms.com';
const DEFAULT_PASSWORD = 'SchoolAdmin2026';

const SuperAdminLogin = () => {
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { superAdminLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/super-admin/login-info')
      .then((res) => {
        if (res.data?.email) setEmail(res.data.email);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await superAdminLogin(email.trim(), password.trim());
      toast.success('Super admin login successful');
      navigate('/super-admin');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed. Check credentials below.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="bg-slate-900 p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-700">
        <div className="text-center mb-8">
          <Shield className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">Super Admin Portal</h1>
          <p className="text-slate-400 mt-2">Manage school accounts and subscriptions</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
              autoComplete="current-password"
              placeholder="Enter super admin password"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Logging in...' : 'Login as Super Admin'}
          </button>
        </form>

        <div className="mt-6 p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-sm">
          <p className="text-slate-300 font-medium mb-2">Default credentials</p>
          <p className="text-slate-400">Email: <span className="text-indigo-300">{DEFAULT_EMAIL}</span></p>
          <p className="text-slate-400">Password: <span className="text-indigo-300">{DEFAULT_PASSWORD}</span></p>
          <p className="text-xs text-slate-500 mt-2">Use this page only — not the regular school login.</p>
        </div>

        <p className="text-center mt-6 text-slate-400 text-sm">
          <Link to="/login" className="text-indigo-300 hover:underline">Back to school login</Link>
        </p>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
