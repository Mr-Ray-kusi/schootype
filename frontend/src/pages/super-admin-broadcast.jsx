import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  CheckSquare,
  FileUp,
  Mail,
  Send,
  Square,
  X,
} from 'lucide-react';
import Layout from '../components/layout';

const fieldClass =
  'w-full rounded-xl border border-slate-600/80 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-primary-500/60 focus:ring-2 focus:ring-primary-500/30';

const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

const SuperAdminBroadcast = () => {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState({ configured: false, ready: false });
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(true);
  const [attachment, setAttachment] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [schoolsRes, statusRes] = await Promise.all([
        axios.get('/api/super-admin/schools'),
        axios.get('/api/super-admin/email-status').catch(() => ({ data: { configured: false, ready: false } })),
      ]);
      setSchools(schoolsRes.data || []);
      setEmailStatus(statusRes.data || { configured: false, ready: false });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSchools = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
    );
  }, [schools, search]);

  const toggleSchool = (id) => {
    setSelectAll(false);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectAll(true);
    setSelectedIds([]);
  };

  const handleClearSelection = () => {
    setSelectAll(false);
    setSelectedIds([]);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error('File must be 3MB or smaller');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const contentBase64 = result.includes(',') ? result.split(',')[1] : result;
      setAttachment({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        contentBase64,
        size: file.size,
      });
    };
    reader.onerror = () => toast.error('Could not read file');
    reader.readAsDataURL(file);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!subject.trim()) {
      toast.error('Enter a subject');
      return;
    }
    if (!message.trim() && !attachment) {
      toast.error('Type a message or attach a file');
      return;
    }
    if (!selectAll && !selectedIds.length) {
      toast.error('Select at least one school');
      return;
    }

    setSending(true);
    setLastResult(null);
    try {
      const { data } = await axios.post('/api/super-admin/broadcast-email', {
        subject: subject.trim(),
        message: message.trim(),
        selectAll,
        schoolIds: selectAll ? [] : selectedIds,
        attachment: attachment
          ? {
              filename: attachment.filename,
              contentType: attachment.contentType,
              contentBase64: attachment.contentBase64,
            }
          : undefined,
      });
      setLastResult(data);
      toast.success(`Sent to ${data.sent} of ${data.total} school admin${data.total === 1 ? '' : 's'}`);
      if (data.failed) {
        toast.error(`${data.failed} email${data.failed === 1 ? '' : 's'} failed`);
      }
      setSubject('');
      setMessage('');
      setAttachment(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="relative min-h-[calc(100vh-3rem)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 70% 45% at 0% 0%, rgba(14, 165, 233, 0.14), transparent 55%), radial-gradient(ellipse 50% 35% at 100% 0%, rgba(16, 185, 129, 0.1), transparent 50%)',
          }}
        />

        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-300/90">
            Platform
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
            Email schools
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
            Send a message from the system to all school admins, or only the ones you select.
            Optionally attach a file.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${
                emailStatus.ready
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  emailStatus.ready ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {emailStatus.ready ? 'Email service ready' : 'Email Service'}
            </span>
            <span className="text-slate-400">
              {loading ? 'Loading schools…' : `${schools.length} school admin${schools.length === 1 ? '' : 's'}`}
            </span>
          </div>
        </header>

        <div className="grid items-stretch gap-6 lg:grid-cols-2 lg:gap-8">
          <section>
            <form
              onSubmit={handleSend}
              className="flex h-full flex-col rounded-3xl border border-slate-700/80 bg-slate-900/50 p-6 md:p-8"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Compose
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Subject, message body, and optional attachment.
                  </p>
                </div>
                <Mail className="mt-0.5 h-5 w-5 text-slate-500" />
              </div>

              <div className="mt-6 flex flex-1 flex-col space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Subject
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Platform maintenance notice"
                    className={fieldClass}
                  />
                </div>

                <div className="flex-1">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={10}
                    placeholder="Type the email message schools will receive…"
                    className={`${fieldClass} min-h-[180px] resize-y`}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Attachment (optional)
                  </label>
                  {!attachment ? (
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 bg-slate-950/40 px-4 py-6 text-sm text-slate-300 transition hover:border-slate-500 hover:bg-slate-950/70">
                      <FileUp className="h-4 w-4" />
                      Upload a file (max 3MB)
                      <input type="file" className="hidden" onChange={handleFileChange} />
                    </label>
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{attachment.filename}</p>
                        <p className="text-xs text-slate-500">
                          {(attachment.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        className="rounded-lg border border-slate-600 p-2 text-slate-300 hover:bg-slate-800"
                        aria-label="Remove attachment"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={sending || loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary-900/20 transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {sending
                    ? 'Sending…'
                    : selectAll
                      ? 'Send to all school admins'
                      : `Send to ${selectedIds.length} selected`}
                </button>
              </div>
            </form>
          </section>

          <section>
            <div className="flex h-full flex-col rounded-3xl border border-slate-700/80 bg-slate-900/50 p-6 md:p-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Recipients
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Choose all schools or pick specific admins.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    selectAll
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                      : 'border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  All schools
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
                >
                  <Square className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search schools…"
                className={`${fieldClass} mt-4`}
              />

              <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '420px' }}>
                {loading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-14 animate-pulse rounded-xl border border-slate-700/60 bg-slate-800/40"
                      />
                    ))}
                  </div>
                ) : !filteredSchools.length ? (
                  <p className="rounded-xl border border-dashed border-slate-600 px-4 py-10 text-center text-sm text-slate-400">
                    No schools found.
                  </p>
                ) : (
                  filteredSchools.map((school) => {
                    const checked = selectAll || selectedIds.includes(school.id);
                    return (
                      <label
                        key={school.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                          checked
                            ? 'border-primary-500/40 bg-primary-500/10'
                            : 'border-slate-700/80 bg-slate-950/40 hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (selectAll) {
                              setSelectAll(false);
                              setSelectedIds(
                                schools.map((s) => s.id).filter((id) => id !== school.id)
                              );
                            } else {
                              toggleSchool(school.id);
                            }
                          }}
                          className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-900 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-white">
                            {school.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-400">
                            {school.email}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <p className="mt-4 text-xs text-slate-500">
                {selectAll
                  ? `Will email all ${schools.length} school admin${schools.length === 1 ? '' : 's'}.`
                  : `Will email ${selectedIds.length} selected school admin${selectedIds.length === 1 ? '' : 's'}.`}
              </p>

              {lastResult && (
                <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                  Last send: {lastResult.sent} sent
                  {lastResult.failed ? `, ${lastResult.failed} failed` : ''}.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default SuperAdminBroadcast;
