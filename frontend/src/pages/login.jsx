import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth, getPostAuthPath } from '../contexts/authcontext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

const Login = () => {
  const location = useLocation();
  const pendingFromSignup = location.state?.pendingVerificationEmail || '';
  const [email, setEmail] = useState(pendingFromSignup);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(Boolean(pendingFromSignup));
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleResend = async () => {
    const target = email.trim().toLowerCase();
    if (!target) {
      toast.error('Enter your email first');
      return;
    }
    setResending(true);
    try {
      await axios.post('/api/auth/resend-verification', { email: target });
      toast.success('If that account needs verification, a new link was sent.');
      setNeedsVerification(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not resend verification email');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await login(email, password);
      toast.success('Login successful!');
      navigate(getPostAuthPath(data.school));
    } catch (error) {
      const data = error.response?.data;
      if (error.response?.status === 403 && data?.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerification(true);
        if (data.email) setEmail(data.email);
        toast.error(data.error || 'Please verify your email before signing in.');
      } else if (error.response?.status === 403 && data?.code === 'PASSWORD_NOT_SET') {
        setNeedsVerification(true);
        if (data.email) setEmail(data.email);
        toast.error(data.error || 'Finish setup from your email link first.');
      } else {
        const message =
          data?.error ||
          (error.request && !error.response
            ? 'Cannot connect to server. Start the backend: cd backend && npm run dev'
            : 'Login failed');
        if (error.response?.status === 429 && data?.retryAfter) {
          toast.error(`${message} (${data.retryAfter}s)`);
        } else {
          toast.error(message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 font-sans text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 40% at 100% 0%, rgba(14, 165, 233, 0.14), transparent 55%), #020617',
        }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Link to="/" className="font-display text-2xl font-extrabold tracking-tight text-white">
              NEXUS
            </Link>
            <h1 className="mt-6 font-display text-3xl font-bold text-white">Sign in</h1>
            <p className="mt-2 text-sm text-slate-400">Access your school admin dashboard</p>
          </div>

          {needsVerification && (
            <div className="mb-5 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
              <p className="font-medium">Check your email to finish setup</p>
              <p className="mt-1 text-sky-100/80">
                Open the link we sent to verify your email and choose a password. Then come back here to sign in.
              </p>
              <button
                type="button"
                disabled={resending}
                onClick={handleResend}
                className="mt-3 text-sm font-semibold text-sky-300 underline-offset-2 hover:underline disabled:opacity-50"
              >
                {resending ? 'Sending…' : 'Resend email'}
              </button>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-3xl border border-slate-700/80 bg-slate-900/60 p-6 md:p-8"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                required
                placeholder="admin@school.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                required
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-sky-500 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Don&apos;t have an account?{' '}
            <Link to="/plans" className="font-medium text-sky-400 hover:text-sky-300">
              Sign up
            </Link>
          </p>
          <p className="mt-3 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to home
            </Link>
          </p>

          {import.meta.env.DEV && (
            <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-xs text-slate-400">
              <p className="mb-2 font-medium text-slate-300">Dev super admin</p>
              <p>Email: superadmin@school.com</p>
              <p>Password: SuperAdmin123!</p>
              <button
                type="button"
                className="mt-3 text-sky-400 hover:text-sky-300"
                onClick={() => {
                  setEmail('superadmin@school.com');
                  setPassword('SuperAdmin123!');
                }}
              >
                Fill credentials
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
