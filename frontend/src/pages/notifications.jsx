import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Bell, CheckCheck, Send } from 'lucide-react';
import { useAuth } from '../contexts/authcontext';

const fieldClass =
  'w-full rounded-xl border border-slate-600/80 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-primary-500/60 focus:ring-2 focus:ring-primary-500/30';

const POLL_MS = 5000;

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

const mergeNotificationItems = (prev, next) => {
  const byId = new Map();
  (prev || []).forEach((item) => byId.set(item.id, item));
  (next || []).forEach((item) => {
    const existing = byId.get(item.id);
    byId.set(item.id, existing ? { ...existing, ...item } : item);
  });
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
};

const Notifications = () => {
  const { isSuperAdmin, school } = useAuth();
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
  const threadEndRef = useRef(null);
  const tempIdRef = useRef(0);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await axios.get('/api/notifications');
      const nextItems = data.items || [];
      setItems((prev) => (silent ? mergeNotificationItems(prev, nextItems) : nextItems));
    } catch (err) {
      if (!silent) {
        toast.error(err.response?.data?.error || 'Failed to load notifications');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load({ silent: false });
  }, [load]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    axios
      .get('/api/super-admin/schools')
      .then((res) => setSchools(res.data || []))
      .catch(() => {});
  }, [isSuperAdmin]);

  useEffect(() => {
    const id = setInterval(() => load({ silent: true }), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const roots = useMemo(() => {
    const list = (items || []).filter((n) => !n.parent_id);
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [items]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (
      items.find((n) => n.id === selectedId) ||
      items.find((n) => n.parent_id === selectedId) ||
      null
    );
  }, [items, selectedId]);

  const threadRootId = selected ? selected.parent_id || selected.id : null;

  const thread = useMemo(() => {
    if (!threadRootId) return [];
    return items
      .filter((n) => n.id === threadRootId || n.parent_id === threadRootId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [items, threadRootId]);

  useEffect(() => {
    if (thread.length) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [thread.length, threadRootId]);

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

  const inboxSenderForRoot = (item) => {
    if (isSuperAdmin) {
      return schoolNameById[item.school_id] || 'School';
    }
    return 'SCHOOLTYPE Admin';
  };

  const labelForMessage = (msg) => {
    const mine = isSuperAdmin
      ? msg.sender_role === 'super_admin'
      : msg.sender_role === 'school';

    if (mine) return 'Me';

    if (msg.sender_role === 'school') {
      return schoolNameById[msg.school_id] || school?.name || 'School';
    }

    return 'SCHOOLTYPE Admin';
  };

  const openThread = (item) => {
    const rootId = item.parent_id || item.id;
    setSelectedId(rootId);
    setReply('');

    const toMark = items.filter((n) => {
      if (n.id !== rootId && n.parent_id !== rootId) return false;
      if (n.read_at) return false;
      if (isSuperAdmin) return n.sender_role === 'school';
      return n.sender_role === 'super_admin';
    });

    if (!toMark.length) return;

    setItems((prev) =>
      prev.map((n) =>
        toMark.some((m) => m.id === n.id) ? { ...n, read_at: new Date().toISOString() } : n
      )
    );

    // Mark read in background so opening a thread feels instant.
    Promise.all(
      toMark.map((n) => axios.post(`/api/notifications/${n.id}/read`).catch(() => null))
    );
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!selected || !reply.trim() || sending) {
      if (!reply.trim()) toast.error('Type a reply first');
      return;
    }

    const bodyText = reply.trim();
    const rootId = threadRootId || selected.id;
    const tempId = `temp-${Date.now()}-${++tempIdRef.current}`;
    const optimistic = {
      id: tempId,
      school_id: selected.school_id,
      sender_role: isSuperAdmin ? 'super_admin' : 'school',
      subject: selected.subject ? `Re: ${String(selected.subject).replace(/^Re:\s*/i, '')}` : 'Reply',
      body: bodyText,
      kind: 'message',
      parent_id: rootId,
      created_at: new Date().toISOString(),
      read_at: new Date().toISOString(),
      _optimistic: true,
    };

    setReply('');
    setItems((prev) => mergeNotificationItems(prev, [optimistic]));
    setSelectedId(rootId);
    setSending(true);

    try {
      const { data } = await axios.post(`/api/notifications/${rootId}/reply`, {
        body: bodyText,
      });
      setItems((prev) => {
        const withoutTemp = prev.filter((n) => n.id !== tempId);
        return mergeNotificationItems(withoutTemp, [data]);
      });
    } catch (err) {
      setItems((prev) => prev.filter((n) => n.id !== tempId));
      setReply(bodyText);
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
    if (sending) return;

    setSending(true);
    const subjectText = composeSubject.trim() || 'Message from SCHOOLTYPE';
    const bodyText = composeBody.trim();
    try {
      const { data } = await axios.post('/api/super-admin/notifications', {
        subject: subjectText,
        body: bodyText,
        selectAll: selectAllSchools,
        schoolIds: selectAllSchools ? [] : selectedSchoolIds,
      });
      setComposeSubject('');
      setComposeBody('');
      if (Array.isArray(data.items) && data.items.length) {
        setItems((prev) => mergeNotificationItems(prev, data.items));
        setSelectedId(data.items[0].id);
      }
      toast.success(`Sent to ${data.count} school${data.count === 1 ? '' : 's'}`);
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
                const active = threadRootId === item.id;
                const sender = inboxSenderForRoot(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openThread(item)}
                      className={`w-full rounded-xl px-3 py-3 text-left transition ${
                        active ? 'bg-slate-700 text-white' : 'hover:bg-slate-800/80 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${unread ? 'font-semibold text-white' : ''}`}>
                          {sender}
                        </p>
                        {unread && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">{formatWhen(item.created_at)}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-slate-700/80 bg-slate-900/50 p-5 lg:col-span-3 md:p-6">
          {!selected ? (
            <p className="text-sm text-slate-400">Select a sender to open the conversation and reply.</p>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white">
                {inboxSenderForRoot(thread[0] || selected)}
              </h2>
              {(thread[0]?.subject || selected.subject) && (
                <p className="mt-1 text-sm text-slate-400">
                  {thread[0]?.subject || selected.subject}
                </p>
              )}
              <div className="mt-5 max-h-[22rem] space-y-3 overflow-y-auto">
                {thread.map((msg) => {
                  const mine = isSuperAdmin
                    ? msg.sender_role === 'super_admin'
                    : msg.sender_role === 'school';
                  return (
                    <div
                      key={msg.id}
                      className={`rounded-2xl border px-4 py-3 ${
                        mine
                          ? 'ml-6 border-sky-500/25 bg-sky-500/10'
                          : 'mr-6 border-emerald-500/25 bg-emerald-500/10'
                      } ${msg._optimistic ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="font-semibold text-slate-200">{labelForMessage(msg)}</span>
                        <span>{formatWhen(msg.created_at)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-100">{msg.body}</p>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
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
