import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Bell, CheckCheck, Send } from 'lucide-react';
import { useAuth } from '../contexts/authcontext';

const fieldClass =
  'w-full rounded-xl border border-slate-600/80 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-primary-500/60 focus:ring-2 focus:ring-primary-500/30';

const formatWhen = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
};

const Notifications = () => {
  const { isSuperAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [selectedSchoolIds, setSelectedSchoolIds] = useState([]);
  const [selectAllSchools, setSelectAllSchools] = useState(true);
  const [schoolSearch, setSchoolSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/notifications');
      setItems(data.items || []);
      if (isSuperAdmin) {
        const schoolsRes = await axios.get('/api/super-admin/schools');
        setSchools(schoolsRes.data || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const roots = useMemo(() => {
    const list = (items || []).filter((n) => !n.parent_id);
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [items]);

  const selected = useMemo(
    () => items.find((n) => n.id === selectedId) || null,
    [items, selectedId]
  );

  const thread = useMemo(() => {
    if (!selected) return [];
    const rootId = selected.parent_id || selected.id;
    return items
      .filter((n) => n.id === rootId || n.parent_id === rootId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [items, selected]);

  const schoolNameById = useMemo(() => {
    const map = {};
    schools.forEach((s) => {
      map[s.id] = s.name;
    });
    return map;
  }, [schools]);

  const filteredSchools = useMemo(() => {
    const q = schoolSearch.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter(
      (s) => s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
    );
  }, [schools, schoolSearch]);

  const openThread = async (item) => {
    setSelectedId(item.id);
    setReply('');
    const rootId = item.parent_id || item.id;
    const toMark = items.filter((n) => {
      if (n.id !== rootId && n.parent_id !== rootId) return false;
      if (n.read_at) return false;
      if (isSuperAdmin) return n.sender_role === 'school';
      return n.sender_role === 'super_admin';
    });
    await Promise.all(
      toMark.map((n) => axios.post(`/api/notifications/${n.id}/read`).catch(() => null))
    );
    if (toMark.length) {
      setItems((prev) =>
        prev.map((n) =>
          toMark.some((m) => m.id === n.id) ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!selected || !reply.trim()) {
      toast.error('Type a reply first');
      return;
    }
    setSending(true);
    try {
      const root = thread[0] || selected;
      const { data } = await axios.post(`/api/notifications/${root.id}/reply`, {
        body: reply.trim(),
      });
      setItems((prev) => [data, ...prev]);
      setReply('');
      toast.success('Reply sent');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleCompose = async (e) => {
    e.preventDefault();
    if (!composeBody.trim()) {
      toast.error('Message body is required');
      return;
    }
    if (!selectAllSchools && !selectedSchoolIds.length) {
      toast.error('Select at least one school');
      return;
    }
    setSending(true);
    try {
      const { data } = await axios.post('/api/super-admin/notifications', {
        subject: composeSubject.trim() || 'Message from SCHOOLTYPE',
        body: composeBody.trim(),
        selectAll: selectAllSchools,
        schoolIds: selectAllSchools ? [] : selectedSchoolIds,
      });
      toast.success(`Sent to ${data.count} school${data.count === 1 ? '' : 's'}`);
      setComposeSubject('');
      setComposeBody('');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const markAllRead = async () => {
    try {
      await axios.post('/api/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      toast.success('All marked as read');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not mark as read');
    }
  };

  const isUnreadRoot = (item) => {
    const rootId = item.id;
    return items.some((n) => {
      if (n.id !== rootId && n.parent_id !== rootId) return false;
      if (n.read_at) return false;
      if (isSuperAdmin) return n.sender_role === 'school';
      return n.sender_role === 'super_admin';
    });
  };

  return (
    <div className="relative min-h-[calc(100vh-3rem)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 0% 0%, rgba(14, 165, 233, 0.14), transparent 55%), radial-gradient(ellipse 50% 35% at 100% 0%, rgba(16, 185, 129, 0.1), transparent 50%)',
        }}
      />

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-300/90">
            {isSuperAdmin ? 'Platform' : 'School'}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Notifications
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
            {isSuperAdmin
              ? 'Send in-app messages to schools and read their replies inside SCHOOLTYPE.'
              : 'Messages from SCHOOLTYPE platform admin. Open a thread to read and reply.'}
          </p>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
        >
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </button>
      </header>

      {isSuperAdmin && (
        <section className="mb-8 rounded-3xl border border-slate-700/80 bg-slate-900/50 p-6 md:p-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Compose in-app message
          </h2>
          <form onSubmit={handleCompose} className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Subject
                </label>
                <input
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="e.g. Yearly renewal notice"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Message
                </label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={6}
                  placeholder="Schools will see this in their notification inbox…"
                  className={`${fieldClass} resize-y`}
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {sending ? 'Sending…' : 'Send in-app notification'}
              </button>
            </div>

            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectAllSchools(true);
                    setSelectedSchoolIds([]);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    selectAllSchools ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  All schools
                </button>
                <button
                  type="button"
                  onClick={() => setSelectAllSchools(false)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    !selectAllSchools ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  Select schools
                </button>
              </div>
              {!selectAllSchools && (
                <>
                  <input
                    value={schoolSearch}
                    onChange={(e) => setSchoolSearch(e.target.value)}
                    placeholder="Search schools…"
                    className={`${fieldClass} mb-3`}
                  />
                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-700 p-2">
                    {filteredSchools.map((s) => {
                      const checked = selectedSchoolIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-200 hover:bg-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedSchoolIds((prev) =>
                                checked ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                              )
                            }
                          />
                          <span className="truncate">{s.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
              {selectAllSchools && (
                <p className="text-sm text-slate-400">
                  Message will go to all {schools.length} registered school
                  {schools.length === 1 ? '' : 's'}.
                </p>
              )}
            </div>
          </form>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-3xl border border-slate-700/80 bg-slate-900/50 p-4 lg:col-span-2 md:p-5">
          <div className="mb-3 flex items-center gap-2 text-slate-300">
            <Bell className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Inbox</h2>
          </div>
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : roots.length === 0 ? (
            <p className="text-sm text-slate-400">No notifications yet.</p>
          ) : (
            <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
              {roots.map((item) => {
                const unread = isUnreadRoot(item);
                const active = selectedId === item.id || selected?.parent_id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openThread(item)}
                      className={`w-full rounded-xl px-3 py-3 text-left transition ${
                        active ? 'bg-slate-700 text-white' : 'hover:bg-slate-800/80 text-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${unread ? 'font-semibold text-white' : ''}`}>
                          {item.subject || 'Notification'}
                        </p>
                        {unread && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{item.body}</p>
                      <p className="mt-2 text-[11px] text-slate-500">
                        {isSuperAdmin && schoolNameById[item.school_id]
                          ? `${schoolNameById[item.school_id]} · `
                          : ''}
                        {formatWhen(item.created_at)}
                        {item.kind === 'subscription_reminder' ? ' · Renewal' : ''}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-slate-700/80 bg-slate-900/50 p-5 lg:col-span-3 md:p-6">
          {!selected ? (
            <p className="text-sm text-slate-400">Select a notification to read and reply.</p>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white">
                {thread[0]?.subject || selected.subject || 'Thread'}
              </h2>
              {isSuperAdmin && schoolNameById[selected.school_id] && (
                <p className="mt-1 text-sm text-slate-400">{schoolNameById[selected.school_id]}</p>
              )}
              <div className="mt-5 max-h-[22rem] space-y-3 overflow-y-auto">
                {thread.map((msg) => {
                  const fromPlatform = msg.sender_role === 'super_admin';
                  return (
                    <div
                      key={msg.id}
                      className={`rounded-2xl border px-4 py-3 ${
                        fromPlatform
                          ? 'border-sky-500/20 bg-sky-500/10'
                          : 'border-emerald-500/20 bg-emerald-500/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span>{fromPlatform ? 'SCHOOLTYPE Admin' : 'School'}</span>
                        <span>{formatWhen(msg.created_at)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-100">{msg.body}</p>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleReply} className="mt-5 space-y-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder={
                    isSuperAdmin ? 'Reply to this school…' : 'Reply to SCHOOLTYPE admin…'
                  }
                  className={`${fieldClass} resize-y`}
                />
                <button
                  type="submit"
                  disabled={sending || !reply.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {sending ? 'Sending…' : 'Send reply'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default Notifications;
