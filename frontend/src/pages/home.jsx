import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/authcontext';
import { useEffect } from 'react';

const Home = () => {
  const { token, school, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !token) return;

    if (school?.role === 'super_admin') {
      navigate('/super-admin', { replace: true });
    } else if (!school?.payment_plan) {
      navigate('/select-plan', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [token, school, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 font-sans text-slate-300">
        Loading…
      </div>
    );
  }

  if (token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 font-sans text-slate-300">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 font-sans text-white">
      {/* Full-bleed student background */}
      <div className="absolute inset-0">
        <img
          src="/hero-students.jpg"
          alt=""
          className="h-full w-full object-cover animate-ken-burns"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(105deg, rgba(2, 12, 27, 0.92) 0%, rgba(2, 12, 27, 0.78) 42%, rgba(2, 12, 27, 0.45) 70%, rgba(2, 12, 27, 0.55) 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 50% 40% at 15% 80%, rgba(14, 165, 233, 0.25), transparent), radial-gradient(ellipse 40% 35% at 85% 20%, rgba(34, 197, 94, 0.12), transparent)',
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="animate-hero-fade flex items-center justify-between px-6 py-6 md:px-10 lg:px-14">
          <Link to="/" className="font-display text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            NEXUS
          </Link>
          <nav className="flex items-center gap-3 md:gap-4">
            <Link
              to="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white"
            >
              Sign in
            </Link>
            <Link
              to="/plans"
              className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400"
            >
              Sign up
            </Link>
          </nav>
        </header>

        <main className="flex flex-1 flex-col justify-center px-6 pb-16 pt-8 md:px-10 lg:px-14 lg:pb-24">
          <div className="max-w-2xl">
            <p className="animate-hero-fade font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              NEXUS
            </p>
            <h1 className="animate-hero-rise mt-5 font-display text-2xl font-bold leading-snug tracking-tight text-white/95 sm:text-3xl md:text-4xl">
              The central connection point for all your school academic activities
            </h1>
            <p className="animate-hero-rise-late mt-5 max-w-lg text-base leading-relaxed text-slate-200/90 sm:text-lg">
              Track students and staff, mark attendance with QR codes, send SMS or email,
              manage fees and wallets — everything your school needs, connected in one place.
            </p>

            <div className="animate-hero-rise-late mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/plans"
                className="inline-flex items-center justify-center rounded-full bg-sky-500 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-sky-500/30 transition hover:bg-sky-400 hover:shadow-sky-400/40"
              >
                Get started
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/40 hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Home;
