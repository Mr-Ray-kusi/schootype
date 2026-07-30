import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import toast from 'react-hot-toast';
import { formatNaira } from '../utils/money';

const FeesUnpaid = () => {
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [createForm, setCreateForm] = useState({
    studentId: '',
    description: 'School fees',
    amount: '',
    dueDate: '',
    term: '',
  });
  const [recordForm, setRecordForm] = useState({
    amount: '',
    method: 'cash',
    note: '',
  });
  const [reminderMessage, setReminderMessage] = useState(
    'Dear Parent, please settle all outstanding school fees to avoid late penalties.'
  );
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [unpaidRes, summaryRes, studentsRes] = await Promise.all([
        axios.get('/api/fees?status=unpaid'),
        axios.get('/api/fees/summary'),
        axios.get('/api/students'),
      ]);
      setInvoices(unpaidRes.data || []);
      setSummary(summaryRes.data);
      setStudents(studentsRes.data || []);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Failed to load unpaid fees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/fees', {
        studentId: createForm.studentId,
        description: createForm.description,
        amount: Number(createForm.amount),
        dueDate: createForm.dueDate || null,
        term: createForm.term || null,
      });
      toast.success('Fee invoice created');
      setShowCreateModal(false);
      setCreateForm({
        studentId: '',
        description: 'School fees',
        amount: '',
        dueDate: '',
        term: '',
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create invoice');
    }
  };

  const handlePaystack = async (invoice) => {
    setPayingId(invoice.id);
    try {
      const { data } = await axios.post(`/api/fees/${invoice.id}/pay`);
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }
      toast.error('Could not start Paystack checkout');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to start payment');
    } finally {
      setPayingId(null);
    }
  };

  const openRecord = (invoice) => {
    setSelectedInvoice(invoice);
    setRecordForm({
      amount: String(invoice.balance),
      method: 'cash',
      note: '',
    });
    setShowRecordModal(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    try {
      await axios.post(`/api/fees/${selectedInvoice.id}/record-payment`, {
        amount: Number(recordForm.amount),
        method: recordForm.method,
        note: recordForm.note || null,
      });
      toast.success('Payment recorded');
      setShowRecordModal(false);
      setSelectedInvoice(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to record payment');
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
      toast.success('Fee reminder sent');
      setShowReminderModal(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send reminder');
    } finally {
      setSending(false);
    }
  };

  const overdueByClass = summary?.overdueByClass || [];

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Fees Unpaid</h1>
            <p className="mt-3 text-slate-300">
              Track outstanding balances, collect via Paystack, or record offline payments.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="rounded-full bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Assign fee
            </button>
            <button
              type="button"
              onClick={() => setShowReminderModal(true)}
              className="rounded-full border border-slate-600 bg-slate-800 px-5 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
            >
              Send reminder
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-wide text-slate-300">Total Overdue</p>
            <p className="mt-4 text-3xl font-semibold text-white">
              {formatNaira(summary?.totalOverdue || 0)}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-wide text-slate-300">Students Owing</p>
            <p className="mt-4 text-3xl font-semibold text-white">{summary?.studentsOwing ?? 0}</p>
          </div>
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-wide text-slate-300">Open Invoices</p>
            <p className="mt-4 text-3xl font-semibold text-white">{summary?.unpaidCount ?? 0}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Outstanding invoices</h2>
                <p className="text-sm text-slate-300">Pay online with Paystack or record cash/transfer.</p>
              </div>
              <button
                type="button"
                onClick={fetchData}
                className="rounded-full bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600"
              >
                Refresh
              </button>
            </div>

            <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900">
              {loading ? (
                <p className="p-6 text-slate-300">Loading…</p>
              ) : invoices.length === 0 ? (
                <p className="p-6 text-slate-300">No unpaid fees. Use “Assign fee” to create invoices.</p>
              ) : (
                <table className="min-w-full text-left text-sm text-slate-200">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-300">
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Balance</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice, index) => (
                      <tr key={invoice.id} className={index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'}>
                        <td className="px-4 py-3">
                          <p className="text-white">{invoice.student_name}</p>
                          <p className="text-xs text-slate-400">{invoice.student_class || '—'}</p>
                        </td>
                        <td className="px-4 py-3">{invoice.description}</td>
                        <td className="px-4 py-3">{formatNaira(invoice.balance)}</td>
                        <td className="px-4 py-3">{invoice.due_date || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={payingId === invoice.id}
                              onClick={() => handlePaystack(invoice)}
                              className="rounded-full bg-primary-600 px-3 py-1.5 text-xs text-white hover:bg-primary-700 disabled:opacity-50"
                            >
                              {payingId === invoice.id ? '…' : 'Paystack'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openRecord(invoice)}
                              className="rounded-full border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                            >
                              Record
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Overdue by class</h2>
            <p className="text-sm text-slate-300 mt-1">Share of outstanding balances.</p>
            <div className="mt-6 space-y-5">
              {overdueByClass.length === 0 ? (
                <p className="text-sm text-slate-400">No class breakdown yet.</p>
              ) : (
                overdueByClass.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm text-slate-200">
                      <span>{item.label}</span>
                      <span>{item.count} · {formatNaira(item.balance)}</span>
                    </div>
                    <div className="mt-2 h-3 rounded-full bg-slate-700">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${item.percent || 0}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
            <form
              onSubmit={handleCreate}
              className="w-full max-w-lg rounded-3xl bg-slate-900 p-8 shadow-2xl space-y-4"
            >
              <h2 className="text-2xl font-semibold text-white">Assign fee invoice</h2>
              <div>
                <label className="block text-sm text-slate-300">Student</label>
                <select
                  required
                  value={createForm.studentId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, studentId: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-600 bg-slate-800 px-4 py-3 text-white"
                >
                  <option value="">Select student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.class ? `(${s.class})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300">Description</label>
                <input
                  required
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-600 bg-slate-800 px-4 py-3 text-white"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm text-slate-300">Amount (₵)</label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={createForm.amount}
                    onChange={(e) => setCreateForm((f) => ({ ...f, amount: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-600 bg-slate-800 px-4 py-3 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300">Due date</label>
                  <input
                    type="date"
                    value={createForm.dueDate}
                    onChange={(e) => setCreateForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-600 bg-slate-800 px-4 py-3 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300">Term (optional)</label>
                <input
                  value={createForm.term}
                  onChange={(e) => setCreateForm((f) => ({ ...f, term: e.target.value }))}
                  placeholder="e.g. First Term 2026"
                  className="mt-2 w-full rounded-2xl border border-slate-600 bg-slate-800 px-4 py-3 text-white"
                />
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button type="submit" className="rounded-full bg-primary-600 px-6 py-3 text-white hover:bg-primary-700">
                  Create invoice
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-full border border-slate-600 px-6 py-3 text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showRecordModal && selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
            <form
              onSubmit={handleRecordPayment}
              className="w-full max-w-lg rounded-3xl bg-slate-900 p-8 shadow-2xl space-y-4"
            >
              <h2 className="text-2xl font-semibold text-white">Record offline payment</h2>
              <p className="text-sm text-slate-300">
                {selectedInvoice.student_name} — balance {formatNaira(selectedInvoice.balance)}
              </p>
              <div>
                <label className="block text-sm text-slate-300">Amount (₵)</label>
                <input
                  required
                  type="number"
                  min="1"
                  max={selectedInvoice.balance}
                  step="1"
                  value={recordForm.amount}
                  onChange={(e) => setRecordForm((f) => ({ ...f, amount: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-600 bg-slate-800 px-4 py-3 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300">Method</label>
                <select
                  value={recordForm.method}
                  onChange={(e) => setRecordForm((f) => ({ ...f, method: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-600 bg-slate-800 px-4 py-3 text-white"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="mobile_money">Mobile Money</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300">Note</label>
                <textarea
                  value={recordForm.note}
                  onChange={(e) => setRecordForm((f) => ({ ...f, note: e.target.value }))}
                  rows="3"
                  className="mt-2 w-full rounded-2xl border border-slate-600 bg-slate-800 px-4 py-3 text-white"
                />
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button type="submit" className="rounded-full bg-primary-600 px-6 py-3 text-white hover:bg-primary-700">
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="rounded-full border border-slate-600 px-6 py-3 text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showReminderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
            <div className="w-full max-w-2xl rounded-3xl bg-slate-900 p-8 shadow-2xl">
              <h2 className="text-2xl font-semibold text-white">Fee owing broadcast</h2>
              <p className="mt-2 text-slate-300">Send a reminder to parents about unpaid fees.</p>
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
                  {sending ? 'Sending…' : 'Send reminder'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReminderModal(false)}
                  className="rounded-full border border-slate-600 px-6 py-3 text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default FeesUnpaid;
