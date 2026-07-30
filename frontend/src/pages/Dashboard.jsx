import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import PlanPendingBanner from '../components/PlanPendingBanner';
import SubscriptionBanner from '../components/SubscriptionBanner';
import axios from 'axios';
import { format } from 'date-fns';
import { useAuth } from '../contexts/authcontext';
import { LockClosedIcon, UsersIcon, UserCircleIcon, ChatBubbleLeftRightIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { school, includesPlanFeature, isPlanApproved } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalStaff: 0,
    totalNonStaff: 0,
    unreadMessages: 0,
    todayAttendance: 0,
  });
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('bar');
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

  const statCards = [
    { title: 'Total Students', value: stats.totalStudents, icon: UsersIcon, color: 'bg-primary-500', trend: '+12%', link: '/students#list', feature: 'students' },
    { title: 'Total Staff', value: stats.totalStaff, icon: UserCircleIcon, color: 'bg-green-500', trend: '+5%', link: '/staff#list', feature: 'staff' },
    { title: 'Non-Staff', value: stats.totalNonStaff, icon: UsersIcon, color: 'bg-purple-500', trend: '+3%', link: '/non-staff#list', feature: 'non-staff' },
    { title: 'Unread Messages', value: stats.unreadMessages, icon: ChatBubbleLeftRightIcon, color: 'bg-yellow-500', trend: 'New', link: '/messages#list', features: ['messages-sms', 'messages-email'] },
  ].filter((stat) => {
    if (stat.features) return stat.features.some((f) => includesPlanFeature(f));
    return includesPlanFeature(stat.feature);
  });

  const attendanceData = attendanceSummary ? [
    { name: 'Students', present: attendanceSummary.students.present, total: attendanceSummary.students.total, percentage: attendanceSummary.students.percentage },
    { name: 'Staff', present: attendanceSummary.staff.present, total: attendanceSummary.staff.total, percentage: attendanceSummary.staff.percentage },
    { name: 'Non-Staff', present: attendanceSummary.nonStaff.present, total: attendanceSummary.nonStaff.total, percentage: attendanceSummary.nonStaff.percentage },
  ] : [];

  const chartData = [
    { day: 'Mon', attendance: 85 },
    { day: 'Tue', attendance: 88 },
    { day: 'Wed', attendance: 92 },
    { day: 'Thu', attendance: 87 },
    { day: 'Fri', attendance: 90 },
  ];

  const renderAttendanceChart = () => {
    if (!isPlanApproved) {
      return (
        <div className="flex items-center gap-2 text-slate-300 text-sm">
          <LockClosedIcon className="w-4 h-4" />
          Attendance charts unlock after admin approval.
        </div>
      );
    }

    if (!attendanceSummary) {
      return <div className="text-slate-300">No attendance summary available.</div>;
    }

    if (chartType === 'poll') {
      return (
        <div className="space-y-4">
          {attendanceData.map((item, index) => (
            <div key={item.name} className="rounded-xl border border-slate-600 p-4 bg-slate-900">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-slate-300">{item.name}</p>
                <span className="text-sm font-semibold text-white">{item.percentage}%</span>
              </div>
              <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${['bg-primary-500', 'bg-green-500', 'bg-amber-500'][index % 3]}`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {chartData.map((item) => (
          <div key={item.day}>
            <div className="flex justify-between text-sm text-slate-300 mb-1">
              <span>{item.day}</span>
              <span>{item.attendance}%</span>
            </div>
            <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full" style={{ width: `${item.attendance}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-300">Loading dashboard...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PlanPendingBanner />
        <SubscriptionBanner />

        <div className="flex items-center gap-4">
          {school?.logo_url && (
            <img
              src={school.logo_url}
              alt={`${school.name} logo`}
              className="w-14 h-14 rounded-xl object-cover border border-slate-600"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-300 mt-1">
              Welcome back{school?.name ? ` to ${school.name}` : ''}! Here's what's happening today.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => {
            const locked = !isPlanApproved;
            return (
              <div key={index} className={`bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-600 ${locked ? 'opacity-75' : 'hover:shadow-md transition-shadow'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-300">{stat.title}</p>
                    <p className="text-2xl font-bold text-white mt-1">{locked ? '—' : stat.value}</p>
                    {stat.trend && !locked && (
                      <p className="text-xs text-green-500 mt-1">{stat.trend} from last month</p>
                    )}
                    {locked && (
                      <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                        <LockClosedIcon className="w-3 h-3" /> Locked until approved
                      </p>
                    )}
                  </div>
                  {locked ? (
                    <div className={`${stat.color} p-3 rounded-full opacity-50`}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                  ) : (
                    <Link to={stat.link} className={`${stat.color} p-3 rounded-full hover:opacity-90 transition-opacity`}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {includesPlanFeature('attendance') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-600">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Attendance Trend</h3>
                <p className="text-sm text-slate-300">Choose how to view attendance performance.</p>
              </div>
              {isPlanApproved && (
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'bar', label: 'Bar Chart' },
                    { key: 'poll', label: 'Percentage Poll' },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setChartType(option.key)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition ${chartType === option.key ? 'bg-primary-500 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {renderAttendanceChart()}
          </div>

          <div className="bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-600">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Today's Attendance</h3>
                <p className="text-sm text-slate-300">Select the day you want to view.</p>
              </div>
              {isPlanApproved && (
                <div className="flex items-center gap-3">
                  <CalendarDaysIcon className="w-5 h-5 text-yellow-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}
            </div>
            {!isPlanApproved ? (
              <div className="flex items-center gap-2 text-slate-300 text-sm">
                <LockClosedIcon className="w-4 h-4" />
                Attendance data unlocks after admin approval.
              </div>
            ) : (
              <div className="space-y-4">
                {attendanceData.map((item) => (
                  <div key={item.name} className="rounded-lg border border-slate-600 p-4 bg-slate-900">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-white">{item.name}</p>
                      <span className="text-sm text-slate-300">{item.percentage}% present</span>
                    </div>
                    <div className="text-sm text-slate-300">Present: {item.present} / Total: {item.total}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        <div className="bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-600">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {!isPlanApproved ? (
              <p className="text-sm text-slate-300">Activity will appear here once your plan is approved and you start using features.</p>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-white">New student registered</p>
                    <p className="text-xs text-slate-300">0 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg">
                  <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-white">Attendance marked for 45 students</p>
                    <p className="text-xs text-slate-300">0 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-white">New message from Parent</p>
                    <p className="text-xs text-slate-300">0 minutes ago</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
