import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Download } from 'lucide-react';
import { downloadFeeReceiptPdf, formatGhs } from '../utils/feeReceiptPdf';

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
  const outstanding = Number(result?.outstanding) || 0;
  const hasBalance = success && outstanding >= 0.01;

  const savePdf = () => {
    if (!result) return;
    downloadFeeReceiptPdf({
      schoolName: result.school_name || 'School',
      studentName: result.student_name || 'Student',
      className: result.class_name,
      rollNumber: result.roll_number,
      periodLabel: result.period_label || result.term_name || result.payment_month,
      feeAmount: result.fee_amount,
      paidAmount: result.paid_amount ?? result.amount,
      outstanding: result.outstanding,
      payments: result.payments || [],
      reference,
      recordedBy: result.recorded_by || 'Paid online',
    });
  };

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
                ? hasBalance
                  ? 'Payment received'
                  : 'Fully paid'
                : result.status === 'failed' || result.status === 'timeout'
                  ? 'Payment not complete'
                  : 'Waiting for confirmation'}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {result.school_name ? `${result.school_name} · ` : ''}
              {result.student_name || 'Student'}
              {result.class_name ? ` · ${result.class_name}` : ''}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {result.period_label || result.term_name || result.payment_month || ''}
            </p>
            <p className="mt-6 text-4xl font-bold tabular-nums">{formatGhs(result.amount)}</p>
            <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
              This payment · {result.channel || 'Paystack'} · {reference}
            </p>
            {success ? (
              <dl className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-slate-700 bg-slate-950/50 p-3 text-left text-xs">
                <div>
                  <dt className="text-slate-500">Fee billed</dt>
                  <dd className="mt-1 text-sm text-white">{formatGhs(result.fee_amount)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Total paid</dt>
                  <dd className="mt-1 text-sm text-emerald-300">{formatGhs(result.paid_amount)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Outstanding</dt>
                  <dd className={`mt-1 text-sm ${hasBalance ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {hasBalance ? formatGhs(outstanding) : 'None'}
                  </dd>
                </div>
              </dl>
            ) : null}
            {hasBalance ? (
              <p className="mt-4 text-sm text-amber-200">
                A balance of {formatGhs(outstanding)} is still due for this period.
              </p>
            ) : null}
            {success ? (
              <button
                type="button"
                onClick={savePdf}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-400"
              >
                <Download className="h-4 w-4" />
                Download PDF receipt
              </button>
            ) : null}
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
