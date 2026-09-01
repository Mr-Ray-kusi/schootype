import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PlanPendingBanner from '../components/PlanPendingBanner';
import SubscriptionBanner from '../components/SubscriptionBanner';
import axios from 'axios';
import { useAuth } from '../contexts/authcontext';
import { DASHBOARD_CACHE_MS, cachedGet, peekCache } from '../utils/requestCache';
import { schoolLocalDate, schoolLocalDateLabel } from '../utils/schoolDate';
import { useLivePoll } from '../hooks/useLivePoll';
import SchoolAnalyticsChart from '../components/SchoolAnalyticsChart';
import {
  Users,
  UserCog,
  Briefcase,
  MessageSquare,
  Lock,
  ArrowUpRight,
} from 'lucide-react';

const Dashboard = () => {
  const { school, includesPlanFeature, isPlanApproved } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalStaff: 0,
    totalNonStaff: 0,
    unreadMessages: 0,
    todayAttendance: 0,
  });
  const [loading, setLoading] = useState(true);
  const selectedDate = schoolLocalDate();

  const applyDashboardPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return;
    setStats(payload);
  };

  const fetchDashboardData = useCallback(async (date, { silent = false } = {}) => {
    const cacheKey = `dashboard:${date}`;
    try {
      if (!silent) {
        const cached = peekCache(cacheKey);
        if (cached) {
          applyDashboardPayload(cached);
          setLoading(false);
        }
      }
      const statsData = await cachedGet(
        cacheKey,
        async () => (await axios.get(`/api/dashboard/stats?date=${date}`)).data,
        silent ? 0 : DASHBOARD_CACHE_MS
      );
      applyDashboardPayload(statsData);
    } catch (error) {
      if (!silent) console.error('Error fetching dashboard data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(selectedDate, { silent: false });
  }, [selectedDate, isPlanApproved, fetchDashboardData]);

  useLivePoll(() => fetchDashboardData(selectedDate, { silent: true }), 8000, !loading);

  const todayLabel = schoolLocalDateLabel();

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
      link: '/staff#list',
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

  if (loading && !stats.totalStudents) {
    return (
      <>
        <div className="flex h-64 items-center justify-center text-slate-400">Loading dashboard…</div>
      </>
    );
  }

  return (
    <>
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
                loading="lazy"
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

        <SchoolAnalyticsChart />
      </div>
    </>
  );
};

export default Dashboard;
