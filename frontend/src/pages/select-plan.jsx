import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/authcontext';
import { PLAN_LIST } from '../constants/plans';
import { Check, School } from 'lucide-react';

const SelectPlan = () => {
  const { school, selectPlan, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState(searchParams.get('plan') || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    if (school?.role === 'super_admin') {
      navigate('/super-admin', { replace: true });
      return;
    }
    if (school?.payment_plan) {
      navigate('/dashboard', { replace: true });
    }
  }, [token, school, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPlan) {
      toast.error('Please select a payment plan');
      return;
    }

    setLoading(true);
    try {
      await selectPlan(selectedPlan);
      toast.success('Plan submitted — awaiting admin approval');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to select plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">
      <header className="border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-2">
          <School className="w-7 h-7 text-primary-400" />
          <span className="text-lg font-bold text-white">NEXUS</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white">Select Your Payment Plan</h1>
          <p className="text-slate-300 mt-2">
            Welcome, {school?.name}! Choose a plan to unlock features for your school dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {PLAN_LIST.map((plan) => (
              <label
                key={plan.id}
                className={`cursor-pointer rounded-2xl border p-6 transition-all ${
                  selectedPlan === plan.id
                    ? 'border-primary-500 bg-primary-500/10 ring-2 ring-primary-500'
                    : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value={plan.id}
                  checked={selectedPlan === plan.id}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="sr-only"
                />
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <span className="text-primary-400 font-semibold">${plan.price}/mo</span>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-200">
                      <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </label>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="submit"
              disabled={loading || !selectedPlan}
              className="px-8 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {loading ? 'Submitting...' : 'Submit plan & go to dashboard'}
            </button>
            <Link to="/" className="text-slate-300 hover:text-slate-200 text-sm">
              Back to home
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
};

export default SelectPlan;
