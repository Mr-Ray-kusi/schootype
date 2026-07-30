import { Clock, Lock, CreditCard, Wallet } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/authcontext';
import { FEATURE_LABELS, getPlan } from '../constants/plans';
import { formatMoney } from '../utils/money';

const PlanPendingBanner = () => {
  const { school, isPlanApproved, refreshSchool } = useAuth();
  const [paying, setPaying] = useState(false);
  const [payingWallet, setPayingWallet] = useState(false);

  if (!school?.payment_plan || isPlanApproved) {
    return null;
  }

  const status = school.plan_status || 'pending';
  const isRejected = status === 'rejected';
  const plan = getPlan(school.payment_plan);
  const planPrice = plan?.price ?? school.plan_price;
  const balance = Number(school.wallet_balance) || 0;
  const canPayWallet = planPrice != null && balance >= planPrice;

  const startPayment = async () => {
    setPaying(true);
    try {
      const { data } = await axios.post('/api/school/subscription/pay');
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }
      toast.error('Could not start Paystack checkout');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to start payment');
    } finally {
      setPaying(false);
    }
  };

  const payFromWallet = async () => {
    setPayingWallet(true);
    try {
      const { data } = await axios.post('/api/wallet/pay-subscription');
      if (data.school && refreshSchool) await refreshSchool(data.school);
      else if (refreshSchool) await refreshSchool();
      toast.success('Plan activated from wallet');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Wallet payment failed');
    } finally {
      setPayingWallet(false);
    }
  };

  return (
    <div className={`rounded-xl border p-5 mb-6 ${isRejected ? 'border-red-500/40 bg-red-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 flex-1">
          {isRejected ? (
            <Lock className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          ) : (
            <Clock className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          )}
          <div className="flex-1">
            <h3 className="font-semibold text-white">
              {isRejected ? 'Plan not approved' : 'Activate your plan'}
            </h3>
            <p className="text-sm text-slate-200 mt-1">
              {isRejected
                ? `Your ${school.plan_name || 'selected'} plan was not approved. Contact the platform admin, or pay to activate after resubmitting.`
                : `Your ${school.plan_name || 'selected'} plan${planPrice ? ` (${formatMoney(planPrice)}/mo)` : ''} is pending. Pay with Paystack or your school wallet to activate immediately, or wait for a super admin to approve.`}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Wallet balance: {formatMoney(balance)}
              {' · '}
              <Link to="/wallet" className="text-primary-400 hover:underline">Open wallet</Link>
            </p>
            {school.pending_plan_features?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {school.pending_plan_features.map((feature) => (
                  <span
                    key={feature}
                    className="px-2 py-1 text-xs rounded-full bg-slate-800/80 text-slate-200 border border-slate-600"
                  >
                    {FEATURE_LABELS[feature] || feature}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {!isRejected && (
          <div className="flex flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={startPayment}
              disabled={paying}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              {paying ? 'Redirecting…' : planPrice ? `Paystack ${formatMoney(planPrice)}` : 'Pay with Paystack'}
            </button>
            <button
              type="button"
              onClick={payFromWallet}
              disabled={payingWallet || !canPayWallet}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Wallet className="w-4 h-4" />
              {payingWallet ? 'Paying…' : canPayWallet ? 'Pay from wallet' : 'Top up wallet first'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanPendingBanner;
