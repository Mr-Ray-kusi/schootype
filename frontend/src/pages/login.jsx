import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, getPostAuthPath } from '../contexts/authcontext';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await login(email, password);
      toast.success('Login successful!');
      navigate(getPostAuthPath(data.school));
    } catch (error) {
      const data = error.response?.data;
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
