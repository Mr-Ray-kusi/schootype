import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth, getPostAuthPath } from '../contexts/authcontext';
import { getPlan } from '../constants/plans';
import { ArrowLeft } from 'lucide-react';

const Signup = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get('plan');
  const selectedPlan = planParam ? getPlan(planParam) : null;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    schoolName: '',
  });
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => {
    if (planParam && !selectedPlan) {
      toast.error('Invalid plan selected');
    }
  }, [planParam, selectedPlan]);

  if (!planParam || !selectedPlan) {
    return <Navigate to="/plans" replace />;
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be smaller than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogo(reader.result);
      setLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    setLogoPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (!/[a-zA-Z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      toast.error('Password must include at least one letter and one number');
      return;
    }

    setLoading(true);

    try {
      const data = await signup(
        formData.schoolName,
        formData.email,
        formData.password,
        logo,
        planParam
      );
      toast.success('Account created! Your plan is awaiting admin approval.');
      navigate(getPostAuthPath(data.school));
    } catch (error) {
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Signup failed');
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
            'radial-gradient(ellipse 55% 40% at 0% 0%, rgba(14, 165, 233, 0.16), transparent 55%), #020617',
        }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Link to="/" className="font-display text-2xl font-extrabold tracking-tight text-white">
              NEXUS
            </Link>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-sky-300/90">
              Step 2 of 2
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold text-white">Create your account</h1>
            <p className="mt-2 text-sm text-slate-300">
              {selectedPlan.name} — ${selectedPlan.price}/{selectedPlan.period}
            </p>
            <Link
              to="/plans"
              className="mt-2 inline-block text-xs text-sky-400 hover:text-sky-300"
            >
              Change plan
            </Link>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-3xl border border-slate-700/80 bg-slate-900/60 p-6 md:p-8"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200">School name</label>
              <input
                type="text"
                name="schoolName"
                required
                value={formData.schoolName}
                onChange={handleChange}
                className="input"
                placeholder="e.g. Bright Future Academy"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200">Email</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="input"
                placeholder="admin@school.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200">Password</label>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="input"
                placeholder="••••••••"
              />
              <p className="mt-1 text-xs text-slate-500">At least 8 characters with letters and numbers.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200">Confirm password</label>
              <input
                type="password"
                name="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="input"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200">
                School logo <span className="font-normal text-slate-500">(optional)</span>
              </label>
              {logoPreview ? (
                <div className="mt-2 flex items-center gap-4">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-14 w-14 rounded-lg object-cover border border-slate-600"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="mt-1 block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-sky-500"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-full bg-sky-500 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:opacity-50"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-sky-400 hover:text-sky-300">
              Sign in
            </Link>
          </p>
          <p className="mt-3 text-center">
            <Link
              to="/plans"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to plans
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
