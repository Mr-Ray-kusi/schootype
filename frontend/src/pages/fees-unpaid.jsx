import React, { useState } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';

const unpaidStats = [
  { label: 'Total Overdue', value: '₦420,000' },
  { label: 'Students Owing', value: '128' },
  { label: 'Staff Owing', value: '9' },
];

const overdueByClass = [
  { label: 'Grade 1', count: 16, percent: 13 },
  { label: 'Grade 2', count: 20, percent: 16 },
  { label: 'Grade 3', count: 24, percent: 19 },
  { label: 'Grade 4', count: 18, percent: 14 },
  { label: 'Grade 5', count: 26, percent: 20 },
];

const FeesUnpaid = () => {
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('Dear Parent, please settle all outstanding school fees by the end of the week to avoid late penalties.');
  const [sending, setSending] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState('');

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
      setSentConfirmation('Fee reminder message has been sent to parents successfully.');
      setShowReminderModal(false);
    } catch (error) {
      console.error('Error sending fee reminder:', error);
      setSentConfirmation('Failed to send fee reminder. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Fees Unpaid</h1>
          <p className="mt-3 text-slate-300">Monitor overdue payments and send reminders to reduce outstanding fees.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {unpaidStats.map((item) => (
            <div key={item.label} className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
              <p className="text-sm uppercase tracking-wide text-slate-300">{item.label}</p>
              <p className="mt-4 text-3xl font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Overdue Class Trend</h2>
                <p className="text-sm text-slate-300">Classes with the largest share of unpaid fees.</p>
              </div>
              <span className="text-sm text-slate-200">Current month</span>
            </div>

            <div className="mt-8 space-y-5">
              {overdueByClass.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm text-slate-200">
                    <span>{item.label}</span>
                    <span>{item.count} students</span>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-slate-700">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${item.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Follow-up Actions</h2>
                <p className="text-sm text-slate-300">Send overdue fee notices and notify parents quickly.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowReminderModal(true)}
                className="rounded-full bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Send Reminder
              </button>
            </div>

            <div className="mt-8 space-y-4">
              <div className="rounded-2xl bg-slate-900 p-4">
                <p className="text-sm text-slate-300">Reminder drafts prepared</p>
                <p className="mt-2 text-white font-semibold">Message ready for all parents with overdue fees.</p>
              </div>
              <div className="rounded-2xl bg-slate-900 p-4">
                <p className="text-sm text-slate-300">Payment plan support</p>
                <p className="mt-2 text-white font-semibold">Offer flexible settlement options.</p>
              </div>
              <div className="rounded-2xl bg-slate-900 p-4">
                <p className="text-sm text-slate-300">Bursar review pending</p>
                <p className="mt-2 text-white font-semibold">9 accounts flagged for follow-up.</p>
              </div>
            </div>
          </div>
        </div>

        {sentConfirmation && (
          <div className="rounded-3xl border border-primary-500 bg-primary-900 p-6 text-primary-100">
            {sentConfirmation}
          </div>
        )}

        {showReminderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 py-6">
            <div className="w-full max-w-2xl rounded-3xl bg-slate-900 p-8 shadow-2xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Fee Owing Broadcast</h2>
                  <p className="mt-2 text-slate-300">Send a reminder message to parents with unpaid fees.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReminderModal(false)}
                  className="rounded-full border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm text-slate-200">Message</label>
                  <textarea
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    rows="6"
                    className="mt-2 w-full rounded-3xl border border-slate-600 bg-slate-800 px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={sendReminder}
                    disabled={sending}
                    className="inline-flex items-center justify-center rounded-full bg-primary-600 px-6 py-3 text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : 'Send Reminder'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReminderModal(false)}
                    className="inline-flex items-center justify-center rounded-full border border-slate-600 bg-slate-700 px-6 py-3 text-slate-200 hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default FeesUnpaid;
