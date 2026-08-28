import React, { useState } from 'react';
import axios from 'axios';

const FeesUnpaid = () => {
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderMessage, setReminderMessage] = useState(
    'Dear Parent, please settle all outstanding school fees by the end of the week to avoid late penalties.'
  );
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Fees Unpaid</h1>
        <p className="mt-1 text-sm text-slate-400">Outstanding balances will list here once fee records are captured.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
          <p className="text-sm uppercase tracking-wide text-slate-300">Total overdue</p>
          <p className="mt-4 text-3xl font-semibold text-white">0.00</p>
        </div>
        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
          <p className="text-sm uppercase tracking-wide text-slate-300">Students owing</p>
          <p className="mt-4 text-3xl font-semibold text-white">0</p>
        </div>
        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
          <p className="text-sm uppercase tracking-wide text-slate-300">Staff owing</p>
          <p className="mt-4 text-3xl font-semibold text-white">0</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-700 bg-slate-800 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-white">Follow-up</h2>
          <button
            type="button"
            onClick={() => setShowReminderModal(true)}
            className="rounded-full bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Send Reminder
          </button>
        </div>
        <div className="mt-8 rounded-2xl border border-dashed border-slate-600 py-12 text-center">
          <p className="text-slate-300">No unpaid fee records.</p>
          <p className="mt-1 text-sm text-slate-500">Demo amounts have been cleared from this page.</p>
        </div>
      </div>

      {sentConfirmation && (
        <div className="rounded-3xl border border-primary-500 bg-primary-900 p-6 text-primary-100">
          {sentConfirmation}
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
