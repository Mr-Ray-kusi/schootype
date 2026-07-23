import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout';
import PlanPendingBanner from '../components/PlanPendingBanner';
import SubscriptionBanner from '../components/SubscriptionBanner';
import axios from 'axios';
import { format } from 'date-fns';
import { useAuth } from '../contexts/authcontext';
import {
  Users,
  UserCog,
  Briefcase,
  MessageSquare,
  Calendar,
  Lock,
  ArrowUpRight,
} from 'lucide-react';

const Dashboard = () => {
  const { school, includesPlanFeature, isPlanApproved, hasFeature } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalStaff: 0,
    totalNonStaff: 0,
    unreadMessages: 0,
    todayAttendance: 0,
  });
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    fetchDashboardData(selectedDate);
  }, [selectedDate, isPlanApproved]);

  const fetchDashboardData = async (date) => {
    try {
      const statsRes = await axios.get('/api/dashboard/stats');
      setStats(statsRes.data);

      if (isPlanApproved && includesPlanFeature('attendance')) {
        const attendanceRes = await axios.get(`/api/attendance/summary?date=${date}`);
        setAttendanceSummary(attendanceRes.data);
      } else {
        setAttendanceSummary(null);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const todayLabel = format(new Date(), 'EEEE, d MMMM yyyy');

  const statCards = [
    {
      title: 'Students',
      value: stats.totalStudents,
      icon: Users,
      accent: 'text-sky-300 bg-sky-500/15 border-sky-500/25',
      link: '/students#list',
      feature: 'students',
    },
    {
      title: 'Staff',
      value: stats.totalStaff,
      icon: Briefcase,
      accent: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/25',
      link: '/staff#list',
      feature: 'staff',
    },
    {
      title: 'Non-staff',
      value: stats.totalNonStaff,
      icon: UserCog,
      accent: 'text-amber-300 bg-amber-500/15 border-amber-500/25',
      link: '/non-staff#list',
      feature: 'non-staff',
    },
    {
      title: 'Unread messages',
      value: stats.unreadMessages,
      icon: MessageSquare,
      accent: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/25',
      link: '/messages#list',
      features: ['messages-sms', 'messages-email'],
    },
  ].filter((stat) => {
    if (stat.features) return stat.features.some((f) => includesPlanFeature(f));
    return includesPlanFeature(stat.feature);
  });

  const attendanceRows = attendanceSummary
    ? [
        {
          name: 'Students',
          present: attendanceSummary.students.present,
          total: attendanceSummary.students.total,
          percentage: attendanceSummary.students.percentage,
          color: 'bg-sky-500',
        },
        {
          name: 'Staff',
          present: attendanceSummary.staff.present,
          total: attendanceSummary.staff.total,
          percentage: attendanceSummary.staff.percentage,
          color: 'bg-emerald-500',
        },
        {
          name: 'Non-staff',
          present: attendanceSummary.nonStaff.present,
          total: attendanceSummary.nonStaff.total,
          percentage: attendanceSummary.nonStaff.percentage,
          color: 'bg-amber-500',
        },
      ]
    : [];

  if (loading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center text-slate-400">Loading dashboard…</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative space-y-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-6 -z-10 h-64"
          style={{
            background:
              'radial-gradient(ellipse 65% 55% at 0% 0%, rgba(14, 165, 233, 0.16), transparent 55%), radial-gradient(ellipse 40% 35% at 100% 10%, rgba(16, 185, 129, 0.1), transparent 50%)',
          }}
        />

        <PlanPendingBanner />
        <SubscriptionBanner />

        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            {school?.logo_url ? (
              <img
                src={school.logo_url}
                alt=""
                className="h-14 w-14 rounded-2xl object-cover border border-slate-600 shadow-lg"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-500/30 bg-sky-500/15 font-display text-xl font-bold text-sky-300">
                {(school?.name || 'N').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/90">
                Overview
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
                {school?.name || 'Dashboard'}
              </h1>
              <p className="mt-1.5 text-sm text-slate-400">{todayLabel}</p>
            </div>
          </div>
          {school?.plan_name && (
            <div className="rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-xs text-slate-300">
              Plan · <span className="font-semibold text-white">{school.plan_name}</span>
            </div>
          )}
        </header>

        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                At a glance
              </h2>
              <p className="mt-1 text-sm text-slate-500">Key counts for your school</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((stat) => {
              const locked = !isPlanApproved;
              const Icon = stat.icon;
              const content = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${stat.accent}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    {!locked && <ArrowUpRight className="h-4 w-4 text-slate-500" />}
                    {locked && <Lock className="h-4 w-4 text-amber-400/80" />}
                  </div>
                  <p className="mt-5 text-sm text-slate-400">{stat.title}</p>
                  <p className="mt-1 font-display text-3xl font-bold tabular-nums text-white">
                    {locked ? '—' : Number(stat.value || 0).toLocaleString()}
                  </p>
                  {locked && (
                    <p className="mt-2 text-xs text-amber-400/90">Locked until approved</p>
                  )}
                </>
              );

              const className = `rounded-2xl border border-slate-700/80 bg-slate-900/50 p-5 transition ${
                locked
                  ? 'opacity-80'
                  : 'hover:border-slate-500 hover:bg-slate-900/80'
              }`;

              if (locked) {
                return (
                  <div key={stat.title} className={className}>
                    {content}
                  </div>
                );
              }

              return (
                <Link key={stat.title} to={stat.link} className={className}>
                  {content}
                </Link>
              );
            })}
          </div>
        </section>

        {includesPlanFeature('attendance') && (
          <section className="rounded-3xl border border-slate-700/80 bg-slate-900/50 p-6 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Attendance
                </h2>
                <p className="mt-2 text-sm text-slate-500">Presence by group for the selected day</p>
              </div>
              {isPlanApproved && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2">
                  <Calendar className="h-4 w-4 text-sky-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-sm text-slate-100 outline-none"
                  />
                </div>
              )}
            </div>

            {!isPlanApproved ? (
              <div className="mt-8 flex items-center gap-2 text-sm text-slate-400">
                <Lock className="h-4 w-4" />
                Attendance unlocks after your plan is approved.
              </div>
            ) : !attendanceSummary ? (
              <p className="mt-8 text-sm text-slate-400">No attendance summary for this day.</p>
            ) : (
              <div className="mt-8 space-y-5">
                {attendanceRows.map((row) => (
                  <div key={row.name}>
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{row.name}</p>
                        <p className="text-xs text-slate-500">
                          {row.present} present · {row.total} total
                        </p>
                      </div>
                      <p className="font-display text-xl font-bold tabular-nums text-white">
                        {row.percentage}%
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${row.color} transition-all duration-500`}
                        style={{ width: `${Math.min(100, Math.max(0, row.percentage || 0))}%` }}
                      />
                    </div>
                  </div>
                ))}
                {hasFeature('attendance') && (
                  <Link
                    to="/attendance"
                    className="inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-sky-400 hover:text-sky-300"
                  >
                    Open attendance
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
