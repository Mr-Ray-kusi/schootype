import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import toast from 'react-hot-toast';
import { formatNaira } from '../utils/money';

const FeesPaid = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [paidRes, summaryRes] = await Promise.all([
        axios.get('/api/fees?status=paid'),
        axios.get('/api/fees/summary'),
      ]);
      setInvoices(paidRes.data || []);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Failed to load paid fees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Fees Paid</h1>
          <p className="mt-3 text-slate-300">
            Confirmed student fee collections recorded in your school ledger.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-wide text-slate-300">Invoices Paid</p>
            <p className="mt-4 text-4xl font-semibold text-white">{summary?.paidCount ?? invoices.length}</p>
          </div>
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-wide text-slate-300">Still Outstanding</p>
            <p className="mt-4 text-4xl font-semibold text-white">{summary?.unpaidCount ?? 0}</p>
          </div>
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-wide text-slate-300">Total Collected</p>
            <p className="mt-4 text-4xl font-semibold text-white">
              {formatNaira(summary?.totalCollected || 0)}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Paid invoices</h2>
              <p className="text-sm text-slate-300">Student fees marked paid via Paystack or offline recording.</p>
            </div>
            <button
              type="button"
              onClick={fetchData}
              className="rounded-full bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600"
            >
              Refresh
            </button>
          </div>

          <div className="mt-8 overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900">
            {loading ? (
              <p className="p-6 text-slate-300">Loading…</p>
            ) : invoices.length === 0 ? (
              <p className="p-6 text-slate-300">No paid fees yet. Collect payments from Fees Unpaid.</p>
            ) : (
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-300">
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Class</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Paid at</th>
                    <th className="px-6 py-4">Term</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice, index) => (
                    <tr key={invoice.id} className={index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'}>
                      <td className="px-6 py-4 text-white">{invoice.student_name}</td>
                      <td className="px-6 py-4">{invoice.student_class || '—'}</td>
                      <td className="px-6 py-4">{invoice.description}</td>
                      <td className="px-6 py-4">{formatNaira(invoice.amount_paid || invoice.amount)}</td>
                      <td className="px-6 py-4">
                        {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4">{invoice.term || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default FeesPaid;
