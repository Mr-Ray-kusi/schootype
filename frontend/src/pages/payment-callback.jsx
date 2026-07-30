import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/authcontext';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, refreshSchool } = useAuth();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('Confirming your payment…');

  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const purpose = searchParams.get('purpose') || 'subscription';

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    if (!reference) {
      setStatus('error');
      setMessage('Missing payment reference.');
      return;
    }

    let cancelled = false;

    const verify = async () => {
      try {
        let endpoint = `/api/school/subscription/verify?reference=${encodeURIComponent(reference)}`;
        if (purpose === 'school_fee') {
          endpoint = `/api/fees/verify?reference=${encodeURIComponent(reference)}`;
        } else if (purpose === 'wallet_topup') {
          endpoint = `/api/wallet/verify?reference=${encodeURIComponent(reference)}`;
        } else if (purpose === 'platform_wallet_topup') {
          endpoint = `/api/platform/wallet/verify?reference=${encodeURIComponent(reference)}`;
        }

        const { data } = await axios.get(endpoint);
        if (cancelled) return;

        if (purpose === 'subscription' && data.school && refreshSchool) {
          await refreshSchool(data.school);
        } else if (refreshSchool) {
          await refreshSchool();
        }

        setStatus('success');
        setMessage(
          purpose === 'school_fee'
            ? 'Fee payment confirmed. The invoice has been updated.'
            : purpose === 'wallet_topup'
              ? 'Wallet top-up confirmed. Your balance has been updated.'
              : purpose === 'platform_wallet_topup'
                ? 'Platform revenue top-up confirmed.'
                : 'Subscription payment confirmed. Your plan is active.'
        );
        toast.success('Payment successful');
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(error.response?.data?.error || 'Could not verify payment. If you were charged, contact support with your reference.');
        toast.error(error.response?.data?.error || 'Payment verification failed');
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [token, reference, purpose, navigate, refreshSchool]);

  const destination =
    purpose === 'school_fee'
      ? '/fees-paid'
      : purpose === 'wallet_topup'
        ? '/wallet'
        : purpose === 'platform_wallet_topup'
          ? '/super-admin/revenue'
          : '/dashboard';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-8 text-center shadow-xl">
        {status === 'verifying' && (
          <Loader2 className="w-12 h-12 text-primary-400 mx-auto animate-spin" />
        )}
        {status === 'success' && (
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
        )}
        {status === 'error' && (
          <XCircle className="w-12 h-12 text-red-400 mx-auto" />
        )}
        <h1 className="mt-4 text-xl font-semibold text-white">
          {status === 'verifying' ? 'Verifying payment' : status === 'success' ? 'Payment successful' : 'Payment issue'}
        </h1>
        <p className="mt-2 text-sm text-slate-300">{message}</p>
        {reference && (
          <p className="mt-3 text-xs text-slate-400 break-all">Reference: {reference}</p>
        )}
        {status !== 'verifying' && (
          <Link
            to={destination}
            className="mt-6 inline-flex rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            Continue
          </Link>
        )}
      </div>
    </div>
  );
};

export default PaymentCallback;
