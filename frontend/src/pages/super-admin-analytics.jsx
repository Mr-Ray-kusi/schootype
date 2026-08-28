import React, { useCallback, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  AlertTriangle,
  Clock,
  DollarSign,
  Gauge,
  LogIn,
  MessageSquare,
  MousePointerClick,
  UserPlus,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLivePoll } from '../hooks/useLivePoll';

const formatMoney = (amount) =>
  new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 2 }).format(
    amount || 0
  );

const formatTime = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const relativeTime = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const delta = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(delta / 60000));
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const StatCard = ({ title, value, subtitle, icon: Icon, color }) => (
  <div className="rounded-xl border border-slate-600 bg-slate-800 p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-slate-300">{title}</p>
        <p className="mt-1 text-2xl font-bold text-white">{value}</p>
        {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
      </div>
      <div className={`${color} shrink-0 rounded-full p-3`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </div>
);

const PanelTab = ({ title, value, subtitle, icon: Icon, color, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`min-w-[9.5rem] flex-1 rounded-xl border p-4 text-left transition ${
      active
        ? 'border-sky-400 bg-slate-700 ring-1 ring-sky-400/60'
        : 'border-slate-600 bg-slate-800 hover:border-slate-500'
    }`}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-300 sm:text-sm">{title}</p>
        <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{value}</p>
        {subtitle ? <p className="mt-1 hidden truncate text-xs text-slate-400 lg:block">{subtitle}</p> : null}
      </div>
      <div className={`${color} shrink-0 rounded-full p-2 sm:p-3`}>
        <Icon className="h-4 w-4 text-white sm:h-5 sm:w-5" />
      </div>
    </div>
  </button>
);

const EmptyRow = ({ text }) => (
  <p className="px-4 py-6 text-center text-sm text-slate-400">{text}</p>
);

const SuperAdminAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPanel, setSelectedPanel] = useState('active');

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    try {
      const { data: payload } = await axios.get('/api/super-admin/analytics');
      setData(payload);
    } catch (error) {
      if (!silent) {
        toast.error(error.response?.data?.error || 'Failed to load analytics');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useLivePoll(() => fetchData({ silent: true }), 20000, true);

  React.useEffect(() => {
    fetchData({ silent: false });
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-300">Loading platform analytics...</div>
    );
  }

  const activeUsers = data?.activeUsers || [];
  const loginsBySchool = data?.loginsBySchool || [];
  const topPages = data?.topPages || [];
  const slowPages = data?.slowPages || [];
  const errors = data?.errors || {};
  const keyEvents = data?.keyEvents || [];
  const newUsers = data?.newUsers || [];
  const stats = data?.dataStats || {};
  const counts = data?.eventCounts || {};

  const panels = [
    {
      id: 'active',
      title: 'Active users now',
      value: activeUsers.length,
      subtitle: `Seen in the last ${data?.activeWindowMinutes || 5} minutes`,
      icon: Users,
      color: 'bg-emerald-500',
    },
    {
      id: 'logins',
      title: 'Daily / weekly logins',
      value: counts.loginsToday || 0,
      subtitle: `${counts.loginsThisWeek || 0} this week`,
      icon: LogIn,
      color: 'bg-sky-500',
    },
    {
      id: 'pages',
      title: 'Pages most visited',
      value: counts.pageViewsThisWeek || 0,
      subtitle: `${counts.pageViewsToday || 0} today`,
      icon: MousePointerClick,
      color: 'bg-primary-500',
    },
    {
      id: 'slow',
      title: 'Slow pages',
      value: slowPages.length,
      subtitle: `Slower than ${data?.slowPageMs || 3000} ms`,
      icon: Gauge,
      color: 'bg-amber-500',
    },
    {
      id: 'events',
      title: 'Key events',
      value: keyEvents.length,
      subtitle: 'Logins, signups, payments',
      icon: Activity,
      color: 'bg-indigo-500',
    },
    {
      id: 'newUsers',
      title: 'New users',
      value: newUsers.length,
      subtitle: 'Schools that joined this week',
      icon: UserPlus,
      color: 'bg-fuchsia-500',
    },
  ];

  const selected = panels.find((panel) => panel.id === selectedPanel) || panels[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Platform analytics</h1>
        <p className="mt-1 text-sm text-slate-400">
          Live usage for GES / municipality oversight — who is signed in, what they use, and where the system is slow.
        </p>
        {data?.tableReady === false && (
          <p className="mt-2 text-xs text-amber-300">
            Event table is not in the database yet. Run <code>database/migrations.sql</code> in Supabase so history is stored.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total students"
          value={stats.totalStudents || 0}
          subtitle="Across all schools"
          icon={Users}
          color="bg-indigo-500"
        />
        <StatCard
          title="Fees collected today"
          value={formatMoney(stats.feesCollectedToday)}
          subtitle="Parent fee payments recorded today"
          icon={DollarSign}
          color="bg-emerald-600"
        />
        <StatCard
          title="SMS sent today"
          value={stats.smsSentToday || 0}
          subtitle="Messages delivered today"
          icon={MessageSquare}
          color="bg-amber-500"
        />
        <StatCard
          title="Errors this week"
          value={(errors.failedLoginsThisWeek || 0) + (errors.failedPaymentsThisWeek || 0)}
          subtitle={`${errors.failedLoginsToday || 0} failed logins today · ${errors.failedPaymentsToday || 0} failed payments today`}
          icon={AlertTriangle}
          color="bg-rose-500"
        />
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {panels.map((panel) => (
          <PanelTab
            key={panel.id}
            title={panel.title}
            value={panel.value}
            subtitle={panel.subtitle}
            icon={panel.icon}
            color={panel.color}
            active={selectedPanel === panel.id}
            onClick={() => setSelectedPanel(panel.id)}
          />
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-600 bg-slate-800">
        <div className="border-b border-slate-600 p-5">
          <h2 className="text-lg font-semibold text-white">{selected.title}</h2>
          <p className="text-xs text-slate-400">{selected.subtitle}</p>
        </div>

        {selectedPanel === 'active' &&
          (activeUsers.length === 0 ? (
            <EmptyRow text="Nobody is active right now." />
          ) : (
            <ul className="divide-y divide-slate-700">
              {activeUsers.map((user) => (
                <li key={`${user.schoolId || ''}-${user.email || user.lastSeen}`} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{user.schoolName || 'Unknown school'}</p>
                      <p className="truncate text-sm text-slate-300">{user.email || 'No email'}</p>
                      <p className="text-xs text-slate-400">
                        {user.role === 'super_admin' ? 'Platform admin' : user.role || 'admin'} · {user.page || user.path || '—'}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-emerald-300">{relativeTime(user.lastSeen)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {selectedPanel === 'logins' &&
          (loginsBySchool.length === 0 ? (
            <EmptyRow text="No school logins recorded yet this week." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3">School</th>
                    <th className="px-5 py-3">Today</th>
                    <th className="px-5 py-3">This week</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {loginsBySchool.map((row) => (
                    <tr key={row.schoolId || row.email}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-white">{row.schoolName}</p>
                        <p className="text-xs text-slate-400">{row.email}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-200">{row.daily}</td>
                      <td className="px-5 py-3 text-slate-200">{row.weekly}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {selectedPanel === 'pages' &&
          (topPages.length === 0 ? (
            <EmptyRow text="No page visits recorded this week." />
          ) : (
            <ul className="divide-y divide-slate-700">
              {topPages.map((row) => {
                const max = topPages[0]?.count || 1;
                return (
                  <li key={row.page} className="px-5 py-3">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="font-medium text-white">{row.page}</span>
                      <span className="text-sm text-slate-300">{row.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{ width: `${Math.max(8, Math.round((row.count / max) * 100))}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ))}

        {selectedPanel === 'slow' &&
          (slowPages.length === 0 ? (
            <EmptyRow text="No slow pages this week." />
          ) : (
            <ul className="divide-y divide-slate-700">
              {slowPages.map((row) => (
                <li key={row.page} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="font-medium text-white">{row.page}</p>
                    <p className="text-xs text-slate-400">
                      {row.count} slow load{row.count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="text-sm text-amber-300">{(row.avgMs / 1000).toFixed(1)}s avg</span>
                </li>
              ))}
            </ul>
          ))}

        {selectedPanel === 'events' &&
          (keyEvents.length === 0 ? (
            <EmptyRow text="No key events yet." />
          ) : (
            <ul className="divide-y divide-slate-700">
              {keyEvents.map((event) => (
                <li key={event.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-white">{event.label}</p>
                      <p className="truncate text-sm text-slate-300">
                        {event.schoolName || event.email || 'Unknown'}
                        {event.page ? ` · ${event.page}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{relativeTime(event.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {selectedPanel === 'newUsers' &&
          (newUsers.length === 0 ? (
            <EmptyRow text="No new schools this week." />
          ) : (
            <ul className="divide-y divide-slate-700">
              {newUsers.map((user) => (
                <li key={user.schoolId || user.email} className="px-5 py-3">
                  <p className="font-medium text-white">{user.schoolName || 'New school'}</p>
                  <p className="text-sm text-slate-300">{user.email}</p>
                  <p className="text-xs text-slate-400">{formatTime(user.createdAt)}</p>
                </li>
              ))}
            </ul>
          ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-600 bg-slate-800">
        <div className="border-b border-slate-600 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Clock className="h-5 w-5 text-rose-300" />
            Errors
          </h2>
          <p className="text-xs text-slate-400">Failed logins and failed payments</p>
        </div>
        {(errors.recent || []).length === 0 ? (
          <EmptyRow text="No failed logins or payments this week." />
        ) : (
          <ul className="divide-y divide-slate-700">
            {errors.recent.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-medium text-white">{event.label}</p>
                  <p className="text-sm text-slate-300">{event.schoolName || event.email || 'Unknown'}</p>
                </div>
                <span className="text-xs text-slate-400">{relativeTime(event.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default SuperAdminAnalytics;
