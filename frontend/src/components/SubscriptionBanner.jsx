import { AlertTriangle, Lock, Clock, CreditCard, Wallet } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/authcontext';
import { formatMoney } from '../utils/money';

const SubscriptionBanner = () => {
  const { school, isPlanApproved, isSubscriptionActive, refreshSchool } = useAuth();
  const [paying, setPaying] = useState(false);
  const [payingWallet, setPayingWallet] = useState(false);

  const balance = Number(school?.wallet_balance) || 0;
  const priceLabel = school?.plan_price != null ? formatMoney(school.plan_price) : null;
  const canPayWallet = school?.plan_price != null && balance >= school.plan_price;

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
      toast.success('Subscription paid from wallet');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Wallet payment failed');
    } finally {
      setPayingWallet(false);
    }
  };

  const PayActions = () => (
    <div className="flex flex-col gap-2 shrink-0">
      <button
        type="button"
        onClick={startPayment}
        disabled={paying}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        <CreditCard className="w-4 h-4" />
        {paying ? 'Redirecting…' : priceLabel ? `Paystack ${priceLabel}` : 'Pay with Paystack'}
      </button>
      <button
        type="button"
        onClick={payFromWallet}
        disabled={payingWallet || !canPayWallet}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <Wallet className="w-4 h-4" />
        {payingWallet ? 'Paying…' : canPayWallet ? 'Pay from wallet' : 'Top up wallet'}
      </button>
      <Link to="/wallet" className="text-center text-xs text-primary-400 hover:underline">
        Wallet · {formatMoney(balance)}
      </Link>
    </div>
  );

  if (!school?.payment_plan || !isPlanApproved) {
    return null;
  }

  if (isSubscriptionActive) {
    if (school.subscription_in_grace) {
      return (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-white">Payment overdue — grace period</h3>
                <p className="text-sm text-slate-200 mt-1">
                  Your current subscription period ended on{' '}
                  {school.next_payment_due
                    ? new Date(school.next_payment_due).toLocaleDateString()
                    : '—'}
                  . Features remain active for {school.subscription_grace_days || 5} days after the period end.
                  Renew with Paystack or wallet{priceLabel ? ` (${priceLabel}/mo)` : ''} to avoid interruption.
                </p>
              </div>
            </div>
            <PayActions />
          </div>
        </div>
      );
    }

    if (school.next_payment_due) {
      const due = new Date(`${school.next_payment_due}T23:59:59`);
      const daysLeft = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24));
      if (daysLeft >= 0 && daysLeft <= 14) {
        return (
          <div className="rounded-xl border border-slate-600 bg-slate-800/80 p-5 mb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-white">Subscription renews soon</h3>
                <p className="text-sm text-slate-300 mt-1">
                  Period ends {new Date(school.next_payment_due).toLocaleDateString()}
                  {priceLabel ? ` · ${priceLabel}/mo` : ''}. Renew with Paystack or wallet.
                </p>
              </div>
              <PayActions />
            </div>
          </div>
        );
      }
    }
    return null;
  }

  const isFrozen = school.subscription_frozen || school.subscription_status === 'frozen';

  return (
    <div className={`rounded-xl border p-5 mb-6 ${isFrozen ? 'border-red-500/40 bg-red-500/10' : 'border-orange-500/40 bg-orange-500/10'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {isFrozen ? (
            <Lock className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />
          )}
          <div>
            <h3 className="font-semibold text-white">
              {isFrozen ? 'Account frozen' : 'Subscription period ended'}
            </h3>
            <p className="text-sm text-slate-200 mt-1">
              {isFrozen
                ? 'Your account has been frozen by the administrator. All features are locked until your subscription is restored.'
                : `Your subscription period ended ${school.subscription_days_past_due || 0} days ago (grace period of ${school.subscription_grace_days || 5} days has ended). Features are locked until the subscription is renewed.`}
            </p>
            {school.next_payment_due && (
              <p className="text-xs text-slate-300 mt-2">
                Period ended: {new Date(school.next_payment_due).toLocaleDateString()}
                {school.last_payment_at && (
                  <> · Period started: {new Date(school.last_payment_at).toLocaleDateString()}</>
                )}
              </p>
            )}
          </div>
        </div>
        {!isFrozen && <PayActions />}
      </div>
    </div>
  );
};

export default SubscriptionBanner;
