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
      <div className="relative space-y-5 md:space-y-8">
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

        <header className="sticky top-16 z-20 -mx-4 mb-2 flex flex-col gap-3 border-b border-slate-800/80 bg-slate-900/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 md:static md:z-auto md:mx-0 md:mb-0 md:flex-row md:items-end md:justify-between md:gap-5 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          <div className="flex min-w-0 items-start gap-3 md:gap-4">
            {school?.logo_url ? (
              <img
                src={school.logo_url}
                alt=""
                loading="lazy"
                className="h-11 w-11 rounded-2xl border border-slate-600 object-cover shadow-lg md:h-14 md:w-14"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-500/30 bg-sky-500/15 font-display text-lg font-bold text-sky-300 md:h-14 md:w-14 md:text-xl">
                {(school?.name || 'N').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300/90 md:text-xs">
                Overview
              </p>
              <h1 className="mt-0.5 truncate font-display text-2xl font-bold tracking-tight text-white md:mt-1 md:text-3xl lg:text-4xl">
                {school?.name || 'Dashboard'}
              </h1>
              <p className="mt-1 text-sm text-slate-400">{todayLabel}</p>
            </div>
          </div>
          {school?.plan_name && (
            <div className="w-fit rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 md:px-4 md:py-2">
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

          <div className="grid grid-cols-2 gap-2 md:gap-3 xl:grid-cols-4">
            {statCards.map((stat) => {
              const locked = !isPlanApproved;
              const Icon = stat.icon;
              const content = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border md:h-10 md:w-10 md:rounded-xl ${stat.accent}`}
                    >
                      <Icon className="h-4 w-4 md:h-5 md:w-5" />
                    </div>
                    {!locked && <ArrowUpRight className="hidden h-4 w-4 text-slate-500 md:block" />}
                    {locked && <Lock className="h-3.5 w-3.5 text-amber-400/80 md:h-4 md:w-4" />}
                  </div>
                  <p className="mt-2 text-[11px] leading-tight text-slate-400 md:mt-5 md:text-sm">
                    {stat.title}
                  </p>
                  <p className="mt-0.5 font-display text-xl font-bold tabular-nums text-white md:mt-1 md:text-3xl">
                    {locked ? '—' : Number(stat.value || 0).toLocaleString()}
                  </p>
                  {locked && (
                    <p className="mt-1 text-[10px] text-amber-400/90 md:mt-2 md:text-xs">Locked until approved</p>
                  )}
                </>
              );

              const className = `rounded-xl border border-slate-700/80 bg-slate-900/50 p-3 transition md:rounded-2xl md:p-5 ${
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
