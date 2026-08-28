import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth, getPostAuthPath } from '../contexts/authcontext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Mail, Lock, Eye, EyeOff, Github } from 'lucide-react';
import AuthSplitLayout, { AuthField, AUTH_ORANGE } from '../components/AuthSplitLayout';

const REMEMBER_KEY = 'schootype_remember_email';

const Login = () => {
  const location = useLocation();
  const pendingFromSignup = location.state?.pendingVerificationEmail || '';
  const [email, setEmail] = useState(pendingFromSignup);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(Boolean(pendingFromSignup));
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (pendingFromSignup) return;
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {
      // ignore storage errors
    }
  }, [pendingFromSignup]);

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
      try {
        if (rememberMe) localStorage.setItem(REMEMBER_KEY, email.trim().toLowerCase());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        // ignore
      }
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
    <AuthSplitLayout mode="login">
      <div>
        <h1 className="text-[2rem] font-bold leading-tight text-white">Welcome back</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Sign in to the school console to manage attendance, fees and reports
        </p>
      </div>

      {needsVerification && (
        <div className="mt-6 rounded-xl border border-[#ff5722]/30 bg-[#ff5722]/10 px-4 py-3 text-sm text-orange-100">
          <p className="font-medium">Check your email to finish setup</p>
          <p className="mt-1 text-orange-100/80">
            Open the link we sent to verify your email and choose a password. Then come back here to sign in.
          </p>
          <button
            type="button"
            disabled={resending}
            onClick={handleResend}
            className="mt-3 text-sm font-semibold text-[#ff5722] underline-offset-2 hover:underline disabled:opacity-50"
          >
            {resending ? 'Sending…' : 'Resend email'}
          </button>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => toast('School accounts sign in with email.')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-600 bg-[#1a1a1a] py-2.5 text-sm font-medium text-white hover:bg-[#222]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z" />
            <path fill="#34A853" d="M5.3 14.3l-.8.6-2.6 2C3.6 20.2 7.5 22.5 12 22.5c3 0 5.5-1 7.3-2.7l-3.1-2.4c-.9.6-2 1-3.3 1-2.5 0-4.6-1.7-5.4-3.9z" />
            <path fill="#FBBC05" d="M2 7.1C1.4 8.3 1 9.6 1 11s.4 2.7 1 3.9l3.4-2.6C5.1 11.5 5 10.8 5 11c0-.8.1-1.5.4-2.2z" />
            <path fill="#4285F4" d="M12 4.8c1.7 0 3.2.6 4.3 1.7l2.6-2.6C17.5 2.1 15 1 12 1 7.5 1 3.6 3.3 1.9 6.7L5.3 9.3C6.1 7.1 8.2 4.8 12 4.8z" />
          </svg>
          Google
        </button>
        <button
          type="button"
          onClick={() => toast('School accounts sign in with email.')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-600 bg-[#1a1a1a] py-2.5 text-sm font-medium text-white hover:bg-[#222]"
        >
          <Github className="h-4 w-4" />
          GitHub
        </button>
      </div>

      <div className="relative my-6 text-center text-[11px] uppercase tracking-[0.14em] text-neutral-500">
        <span className="absolute inset-x-0 top-1/2 h-px bg-neutral-700" />
        <span className="relative bg-[#121212] px-3">or continue with email</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="admin@school.com"
        />

        <AuthField
          label="Password"
          icon={Lock}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Enter your password"
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-neutral-500 hover:text-neutral-300"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 text-neutral-300">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="auth-checkbox h-4 w-4 rounded border-neutral-600"
            />
            Remember me
          </label>
          <button
            type="button"
            onClick={handleResend}
            className="font-medium hover:underline"
            style={{ color: AUTH_ORANGE }}
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="auth-accent w-full rounded-xl py-3.5 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-400">
        New school?{' '}
        <Link to="/plans" className="font-semibold hover:underline" style={{ color: AUTH_ORANGE }}>
          Create an account
        </Link>
      </p>
      {import.meta.env.DEV && (
        <p className="mt-3 text-center text-[11px] text-neutral-500">
          Demo —{' '}
          <button
            type="button"
            className="underline-offset-2 hover:underline"
            style={{ color: AUTH_ORANGE }}
            onClick={() => {
              setEmail('superadmin@school.com');
              setPassword('SuperAdmin123!');
            }}
          >
            fill super admin
          </button>
        </p>
      )}
    </AuthSplitLayout>
  );
};

export default Login;
