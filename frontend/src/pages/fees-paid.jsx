import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Copy, Plus, RefreshCw } from 'lucide-react';
import RecordFeePaymentModal from '../components/RecordFeePaymentModal';

const formatGhs = (value) =>
  `GHS ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FeesPaid = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: payload } = await axios.get('/api/fees/overview');
      setData(payload);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load fee payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copyLink = async (path) => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Payment link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const paid = data?.paid || [];
  const totals = data?.totals || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Fees Paid</h1>
          <p className="mt-1 text-sm text-slate-400">
            Payments for {data?.month || 'this month'} via MoMo, bank, cash, or USSD.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Record payment
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
          <p className="text-sm uppercase tracking-wide text-slate-300">Paid this month</p>
          <p className="mt-4 text-4xl font-semibold text-white">{totals.paid || 0}</p>
        </div>
        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
          <p className="text-sm uppercase tracking-wide text-slate-300">Amount collected</p>
          <p className="mt-4 text-4xl font-semibold text-white">{formatGhs(totals.paid_amount)}</p>
        </div>
        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
          <p className="text-sm uppercase tracking-wide text-slate-300">Still unpaid</p>
          <p className="mt-4 text-4xl font-semibold text-white">{totals.unpaid || 0}</p>
        </div>
      </div>

      {paid.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-600 bg-slate-800/50 py-16 text-center">
          <p className="text-slate-300">No fee payments recorded yet this month.</p>
          <p className="mt-1 text-sm text-slate-500">
            Record a cash or bank payment, or share each student’s pay link with parents.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-700">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-800 text-slate-300">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Outstanding</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Link</th>
              </tr>
            </thead>
            <tbody>
              {paid.map((row) => {
                const outstanding = Number(row.outstanding) || 0;
                return (
                  <tr key={row.id} className="border-t border-slate-700 bg-slate-900 text-slate-100">
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3">{row.class || '—'}</td>
                    <td className="px-4 py-3">{formatGhs(row.fee_amount)}</td>
                    <td className="px-4 py-3">{formatGhs(row.paid_amount || row.payment?.amount)}</td>
                    <td className={`px-4 py-3 font-medium ${outstanding >= 0.01 ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {outstanding >= 0.01 ? formatGhs(outstanding) : 'None'}
                    </td>
                    <td className="px-4 py-3 capitalize">{row.payment?.channel || row.payment?.payment_method || 'Paystack'}</td>
                    <td className="px-4 py-3">
                      {row.pay_path ? (
                        <button type="button" onClick={() => copyLink(row.pay_path)} className="text-sky-400 hover:text-sky-300">
                          <Copy className="h-4 w-4" />
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showManual ? (
        <RecordFeePaymentModal
          students={data?.students || []}
          month={data?.month}
          onClose={() => setShowManual(false)}
          onSaved={() => {
            setLoading(true);
            load();
          }}
        />
      ) : null}
    </div>
  );
};

export default FeesPaid;
