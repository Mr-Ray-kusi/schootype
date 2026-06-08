import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { Send, Reply, Mail, User, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [newMessage, setNewMessage] = useState({
    senderName: '',
    senderRole: 'Admin',
    sendMode: 'Group',
    recipients: 'Parents',
    individualRole: 'Parent',
    recipientEmail: '',
    message: '',
    attachment: null,
  });
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState('');
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#list') {
      document.getElementById('list-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location]);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await axios.get('/api/messages');
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    setSendError('');
    setSendingMessage(true);
    try {
      if (!newMessage.senderName.trim()) {
        setSendError('Please enter your name');
        setSendingMessage(false);
        return;
      }
      if (!newMessage.message.trim()) {
        setSendError('Please enter a message');
        setSendingMessage(false);
        return;
      }
      if (newMessage.sendMode === 'Individual' && !newMessage.recipientEmail.trim()) {
        setSendError('Please enter recipient email for individual message');
        setSendingMessage(false);
        return;
      }

      const payload = {
        senderName: newMessage.senderName,
        senderRole: newMessage.senderRole,
        sendMode: newMessage.sendMode,
        recipients: newMessage.recipients,
        individualRole: newMessage.individualRole,
        recipientEmail: newMessage.recipientEmail,
        attachmentName: newMessage.attachment?.name || null,
        message: newMessage.message,
      };

      await axios.post('/api/messages', payload);

      setShowSendModal(false);
      setNewMessage({
        senderName: '',
        senderRole: 'Admin',
        sendMode: 'Group',
        recipients: 'Parents',
        individualRole: 'Parent',
        recipientEmail: '',
        message: '',
        attachment: null,
      });
      setSendError('');
      fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      setSendError(error.response?.data?.error || 'Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleReply = async (messageId) => {
    try {
      await axios.post(`/api/messages/${messageId}/reply`, { reply: replyText });
      setReplyingTo(null);
      setReplyText('');
      fetchMessages();
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading messages...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold text-white">Broadcast Messages</h1>
                <p className="mt-2 text-slate-400">Send bulk email broadcasts to parents, teachers, or the entire school community.</p>
              </div>
              <button
                onClick={() => setShowSendModal(true)}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700"
              >
                <Mail className="w-5 h-5" />
                New Broadcast
              </button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-slate-950 p-5">
                <p className="text-xs uppercase tracking-widest text-slate-500">Recent Broadcasts</p>
                <p className="mt-4 text-3xl font-semibold text-white">{messages.length}</p>
              </div>
              <div className="rounded-3xl bg-slate-950 p-5">
                <p className="text-xs uppercase tracking-widest text-slate-500">Target group</p>
                <p className="mt-4 text-3xl font-semibold text-white">Parents</p>
              </div>
              <div className="rounded-3xl bg-slate-950 p-5">
                <p className="text-xs uppercase tracking-widest text-slate-500">Latest update</p>
                <p className="mt-4 text-3xl font-semibold text-white">Today</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Broadcast Health</h2>
            <p className="mt-2 text-slate-400">Performance indicators for email deliverability and engagement.</p>

            <div className="mt-8 space-y-5">
              {[
                { label: 'Sent successfully', value: '96%', progress: 96 },
                { label: 'Opened by parents', value: '84%', progress: 84 },
                { label: 'Responses received', value: '22%', progress: 22 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>{item.label}</span>
                    <span>{item.value}</span>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div id="list-section" className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="rounded-3xl border border-slate-800 bg-slate-900 shadow-sm">
              <div className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{message.recipients || 'Parents'}</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">{message.sender_name}</h3>
                  </div>
                  <div className="text-sm text-slate-400 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {formatDistanceToNow(new Date(message.created_at))} ago
                  </div>
                </div>
                <p className="mt-4 text-slate-300">{message.message}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <span className="rounded-full bg-slate-950 px-3 py-1 text-sm text-slate-300">Broadcast</span>
                  <span className="rounded-full bg-slate-950 px-3 py-1 text-sm text-slate-300">Email</span>
                </div>

                {message.reply ? (
                  <div className="mt-4 rounded-3xl bg-blue-950 p-4 text-slate-100">
                    <p className="text-sm font-medium text-blue-300">Admin reply</p>
                    <p className="mt-2 text-slate-200">{message.reply}</p>
                  </div>
                ) : (
                  <div className="mt-4">
                    {replyingTo === message.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your reply here..."
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows="3"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleReply(message.id)}
                            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                          >
                            <Send className="w-4 h-4" />
                            Send Reply
                          </button>
                          <button
                            onClick={() => setReplyingTo(null)}
                            className="inline-flex items-center rounded-full bg-slate-800 px-4 py-2 text-slate-200 hover:bg-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReplyingTo(message.id)}
                        className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                      >
                        <Reply className="w-4 h-4" />
                        Reply
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {messages.length === 0 && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
              No broadcasts sent yet. Use the button above to send a parent email broadcast.
            </div>
          )}
        </div>

        {showSendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div className="w-full max-w-2xl rounded-3xl bg-slate-950 p-8 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">New Broadcast</h2>
                  <p className="mt-1 text-sm text-slate-400">Send a group broadcast or direct message to a single parent, teacher, or staff member with an optional file attachment.</p>
                </div>
                <button
                  onClick={() => setShowSendModal(false)}
                  className="rounded-full border border-slate-700 px-4 py-2 text-slate-300 hover:bg-slate-900"
                >
                  Close
                </button>
              </div>
              <form onSubmit={handleSendMessage} className="mt-8 space-y-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-300">Your Name *</label>
                    <input
                      type="text"
                      value={newMessage.senderName}
                      onChange={(e) => setNewMessage({ ...newMessage, senderName: e.target.value })}
                      placeholder="Admin name"
                      className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-300">Your Role</label>
                    <input
                      type="text"
                      value="Admin"
                      disabled
                      className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-300">Send To</label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {['Group', 'Individual'].map((mode) => (
                      <label key={mode} className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 hover:border-blue-500">
                        <input
                          type="radio"
                          name="sendMode"
                          value={mode}
                          checked={newMessage.sendMode === mode}
                          onChange={(e) => setNewMessage({ ...newMessage, sendMode: e.target.value })}
                          className="mr-3 h-4 w-4 rounded-full border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                        />
                        {mode}
                      </label>
                    ))}
                  </div>
                </div>

                {newMessage.sendMode === 'Group' ? (
                  <div>
                    <label className="text-sm font-medium text-slate-300">Recipient Group</label>
                    <select
                      value={newMessage.recipients}
                      onChange={(e) => setNewMessage({ ...newMessage, recipients: e.target.value })}
                      className="mt-2 w-full rounded-2xl border border-slate-700 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Parents">Parents</option>
                      <option value="Teachers">Teachers</option>
                      <option value="Staff">Staff</option>
                      <option value="All Parents & Teachers">All Parents & Teachers</option>
                      <option value="All">All</option>
                    </select>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-slate-300">Recipient Role</label>
                      <select
                        value={newMessage.individualRole}
                        onChange={(e) => setNewMessage({ ...newMessage, individualRole: e.target.value })}
                        className="mt-2 w-full rounded-2xl border border-slate-700 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Parent">Parent</option>
                        <option value="Teacher">Teacher</option>
                        <option value="Staff">Staff</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-300">Recipient Email or ID</label>
                      <input
                        type="text"
                        value={newMessage.recipientEmail}
                        onChange={(e) => setNewMessage({ ...newMessage, recipientEmail: e.target.value })}
                        placeholder="someone@example.com"
                        className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={newMessage.sendMode === 'Individual'}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-slate-300">Message *</label>
                  <textarea
                    value={newMessage.message}
                    onChange={(e) => setNewMessage({ ...newMessage, message: e.target.value })}
                    rows="6"
                    placeholder="Write your broadcast or individual message here..."
                    className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-300">Attachment</label>
                  <div className="mt-2 flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 hover:border-blue-500">
                      Choose file
                      <input
                        type="file"
                        accept="*/*"
                        onChange={(e) => setNewMessage({ ...newMessage, attachment: e.target.files?.[0] || null })}
                        className="sr-only"
                      />
                    </label>
                    <span className="text-sm text-slate-400">
                      {newMessage.attachment ? newMessage.attachment.name : 'No file selected'}
                    </span>
                  </div>
                </div>

                {sendError && (
                  <div className="rounded-2xl bg-red-950 p-4 text-red-100 text-sm">
                    {sendError}
                  </div>
                )}
                <div className="flex flex-wrap gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={sendingMessage}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    {sendingMessage ? 'Sending...' : 'Send Broadcast'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSendModal(false);
                      setSendError('');
                    }}
                    className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-6 py-3 text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Messages;
