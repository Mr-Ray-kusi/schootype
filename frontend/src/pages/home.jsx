import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/authcontext';
import { useEffect } from 'react';
import { PLAN_LIST } from '../constants/plans';
import { Check, School, LogIn } from 'lucide-react';

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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-300">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <School className="w-8 h-8 text-primary-400" />
            <span className="text-xl font-bold text-white">SchoolMS</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="flex items-center gap-2 px-4 py-2 text-slate-100 hover:text-white transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Login
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            Smart School Management
            <span className="block text-primary-400 mt-2">Choose the plan that fits your school</span>
          </h1>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PLAN_LIST.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-8 flex flex-col ${
                  plan.highlighted
                    ? 'border-primary-500 bg-slate-800 shadow-lg shadow-primary-500/10 scale-[1.02]'
                    : 'border-slate-600 bg-slate-800/50'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary-600 text-white text-xs font-semibold rounded-full">
                    Most Popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="text-slate-300 text-sm mt-2">{plan.description}</p>
                <div className="mt-6">
                  <span className="text-4xl font-bold text-white">${plan.price}</span>
                  <span className="text-slate-300">/{plan.period}</span>
                </div>
                <ul className="mt-8 space-y-3 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-200">
                      <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Link
                    to={`/signup?plan=${plan.id}`}
                    className={`block w-full text-center py-3 rounded-lg font-medium transition-colors ${
                      plan.highlighted
                        ? 'bg-primary-600 hover:bg-primary-700 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                  >
                    Get Started
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-700 py-8 text-center text-slate-400 text-sm">
        © {new Date().getFullYear()} SchoolMS. All rights reserved.
      </footer>
    </div>
  );
};

export default Home;
