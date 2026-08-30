import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const formatGhs = (value) =>
  `GHS ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FeesReceipt = () => {
  const [params] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref') || '';
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reference) {
      setError('Missing payment reference.');
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    let attempts = 0;
    const load = async () => {
      try {
        const { data } = await axios.get(`/api/public/fees/verify/${encodeURIComponent(reference)}`);
        if (cancelled) return;
        setResult(data);
        if (data.status === 'success' || data.status === 'failed' || data.status === 'timeout') {
          setLoading(false);
          return;
        }
        attempts += 1;
        if (attempts < 20) {
          window.setTimeout(load, 3000);
          return;
        }
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Could not confirm this payment.');
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [reference]);

  const success = result?.status === 'success';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-10 text-white">
      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900/80 p-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-sky-300/80">School fees</p>
        {loading ? (
          <p className="mt-6 text-slate-300">Confirming payment…</p>
        ) : error ? (
          <p className="mt-6 text-rose-300">{error}</p>
        ) : (
          <>
            <h1 className="mt-4 text-3xl font-bold">
              {success
                ? 'Payment received'
                : result.status === 'failed' || result.status === 'timeout'
                  ? 'Payment not complete'
                  : 'Waiting for confirmation'}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {result.student_name || 'Student'} · {result.payment_month || ''}
            </p>
            <p className="mt-6 text-4xl font-bold tabular-nums">{formatGhs(result.amount)}</p>
            <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
              {result.channel || 'Paystack'} · {reference}
            </p>
          </>
        )}
        <Link to="/fees" className="mt-8 inline-block text-sm text-sky-400 hover:text-sky-300">
          Pay another fee
        </Link>
      </div>
    </div>
  );
};

export default FeesReceipt;
