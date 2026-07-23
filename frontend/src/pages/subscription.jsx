import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/authcontext';
import { PLANS } from '../utils/subscriptionPlans';
import { Check, CreditCard, Smartphone, Sparkles } from 'lucide-react';

const Subscription = () => {
  const navigate = useNavigate();
  const { school, refreshSchool, updateSchoolSubscription } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState('basic');
  const [momoPhone, setMomoPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const freshSchool = await refreshSchool();
        const res = await axios.get('/api/subscription/status');
        setStatus(res.data);
        const isActive = res.data.status === 'active' || freshSchool?.subscriptionStatus === 'active';
        if (isActive) {
          updateSchoolSubscription({
            subscriptionPlan: res.data.plan || freshSchool?.subscriptionPlan,
            subscriptionStatus: 'active',
            subscriptionExpiresAt: res.data.expiresAt || freshSchool?.subscriptionExpiresAt,
            ussdCode: res.data.ussdCode || freshSchool?.ussdCode,
          });
          navigate('/', { replace: true });
        }
      } catch (err) {
        console.error(err);
      }
    };
    checkStatus();
  }, [navigate, refreshSchool, updateSchoolSubscription]);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!momoPhone.trim()) {
      toast.error('Please enter your MoMo phone number');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post('/api/subscription/initiate', {
        plan: selectedPlan,
        momoPhone: momoPhone.trim(),
      });
      setPaymentInfo(res.data);
      updateSchoolSubscription({ subscriptionStatus: 'pending_approval', subscriptionPlan: selectedPlan });
      await refreshSchool();
      toast.success('Payment initiated! Complete MoMo payment and await approval.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-indigo-200 text-sm mb-4">
            <Sparkles className="w-4 h-4" />
            Welcome, {school?.name || 'School Admin'}
          </div>
          <h1 className="text-4xl font-bold text-white">Choose Your Subscription Plan</h1>
          <p className="mt-3 text-slate-300 max-w-2xl mx-auto">
            Select a plan to unlock your school management dashboard. Payment via Mobile Money (MoMo).
          </p>
        </div>

        {status?.status === 'pending_approval' && (
          <div className="mb-8 p-6 rounded-2xl bg-amber-500/10 backdrop-blur-xl border border-amber-500/30 text-amber-100 text-center">
            <p className="font-semibold">Payment pending approval</p>
            <p className="text-sm mt-1">Your subscription is awaiting super admin confirmation after MoMo payment.</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8 mb-10">
          {Object.values(PLANS).map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlan(plan.id)}
              className={`text-left p-8 rounded-3xl backdrop-blur-xl border transition-all duration-300 ${
                selectedPlan === plan.id
                  ? 'bg-white/15 border-indigo-400 shadow-2xl shadow-indigo-500/20 scale-[1.02]'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">{plan.name}</h2>
                {selectedPlan === plan.id && (
                  <span className="px-3 py-1 rounded-full bg-indigo-500 text-white text-xs">Selected</span>
                )}
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">{plan.currency} {plan.price}</span>
                <span className="text-slate-400">/{plan.period}</span>
              </div>
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-slate-200 text-sm">
                    <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {!paymentInfo ? (
          <form onSubmit={handleSubscribe} className="max-w-md mx-auto p-8 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Complete Payment
            </h3>
            <div className="mb-4">
              <label className="block text-sm text-slate-300 mb-2">MoMo Phone Number</label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="tel"
                  value={momoPhone}
                  onChange={(e) => setMomoPhone(e.target.value)}
                  placeholder="e.g. 0241234567"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              You will be asked to complete GHC {PLANS[selectedPlan].price} payment on your MoMo account after submitting.
            </p>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Processing...' : `Subscribe — GHC ${PLANS[selectedPlan].price}/month`}
            </button>
          </form>
        ) : (
          <div className="max-w-lg mx-auto p-8 rounded-3xl bg-white/10 backdrop-blur-xl border border-emerald-500/30">
            <h3 className="text-lg font-semibold text-emerald-300 mb-4">Payment Initiated</h3>
            <p className="text-slate-200 mb-4">{paymentInfo.message}</p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300 mb-6">
              {paymentInfo.instructions?.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="text-xs text-slate-400">
              Reference: <span className="text-white font-mono">{paymentInfo.payment?.payment_reference}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Subscription;
