import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Copy, RefreshCw } from 'lucide-react';

const formatGhs = (value) =>
  `GHS ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FeesUnpaid = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderMessage, setReminderMessage] = useState(
    'Dear Parent, please settle outstanding school fees this month using the payment link. You can pay with MoMo, bank transfer, or USSD.'
  );
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: payload } = await axios.get('/api/fees/overview');
      setData(payload);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load unpaid fees');
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

  const sendReminder = async () => {
    setSending(true);
    try {
      await axios.post('/api/messages', {
        senderName: 'Admin',
        senderRole: 'Admin',
        sendMode: 'Group',
        recipients: 'Parents',
        individualRole: 'Parent',
        recipientEmail: '',
        attachmentName: null,
        deliveryChannel: 'email',
        message: reminderMessage,
      });
      toast.success('Fee reminder sent to parents.');
      setShowReminderModal(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send fee reminder.');
    } finally {
      setSending(false);
    }
  };

  const unpaid = data?.unpaid || [];
  const totals = data?.totals || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Fees Unpaid</h1>
          <p className="mt-1 text-sm text-slate-400">
            Outstanding balances for {data?.month || 'this month'}. Share the pay link so parents can use MoMo, bank, or USSD.
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
            onClick={() => setShowReminderModal(true)}
            className="rounded-full bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Send Reminder
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
          <p className="text-sm uppercase tracking-wide text-slate-300">Total overdue</p>
          <p className="mt-4 text-3xl font-semibold text-white">{formatGhs(totals.unpaid_amount)}</p>
        </div>
        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
          <p className="text-sm uppercase tracking-wide text-slate-300">Students owing</p>
          <p className="mt-4 text-3xl font-semibold text-white">{totals.unpaid || 0}</p>
        </div>
        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
          <p className="text-sm uppercase tracking-wide text-slate-300">Already paid</p>
          <p className="mt-4 text-3xl font-semibold text-white">{totals.paid || 0}</p>
        </div>
      </div>

      {unpaid.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-600 bg-slate-800/50 py-16 text-center">
          <p className="text-slate-300">No unpaid fee records this month.</p>
          <p className="mt-1 text-sm text-slate-500">Set class fees in Setup if this list should show owing students.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800 text-slate-300">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Amount due</th>
                <th className="px-4 py-3">Pay link</th>
              </tr>
            </thead>
            <tbody>
              {unpaid.map((row) => (
                <tr key={row.id} className="border-t border-slate-700 bg-slate-900 text-slate-100">
                  <td className="px-4 py-3">{row.name}</td>
                  <td className="px-4 py-3">{row.class || '—'}</td>
                  <td className="px-4 py-3">{formatGhs(row.fee_amount)}</td>
                  <td className="px-4 py-3">
                    {row.pay_path ? (
                      <button
                        type="button"
                        onClick={() => copyLink(row.pay_path)}
                        className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl bg-slate-900 p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-semibold text-white">Fee reminder</h2>
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                className="rounded-full border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <textarea
              value={reminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
              rows="6"
              className="mt-6 w-full rounded-3xl border border-slate-600 bg-slate-800 px-4 py-4 text-white"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={sendReminder}
                disabled={sending}
                className="rounded-full bg-primary-600 px-6 py-3 text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send Reminder'}
              </button>
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                className="rounded-full border border-slate-600 px-6 py-3 text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeesUnpaid;
