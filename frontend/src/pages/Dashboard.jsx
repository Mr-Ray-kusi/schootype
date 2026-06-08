import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { format } from 'date-fns';
import { UsersIcon, UserCircleIcon, ChatBubbleLeftRightIcon, CalendarDaysIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline';

const Dashboard = () => {
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
  }, [selectedDate]);

  const fetchDashboardData = async (date) => {
    try {
      const [statsRes, attendanceRes] = await Promise.all([
        axios.get('/api/dashboard/stats'),
        axios.get(`/api/attendance/summary?date=${date}`),
      ]);
      setStats(statsRes.data);
      setAttendanceSummary(attendanceRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: 'Total Students', value: stats.totalStudents, icon: UsersIcon, color: 'bg-blue-500', trend: '+12%', link: '/students#list' },
    { title: 'Total Staff', value: stats.totalStaff, icon: UserCircleIcon, color: 'bg-green-500', trend: '+5%', link: '/staff#list' },
    { title: 'Non-Staff', value: stats.totalNonStaff, icon: UsersIcon, color: 'bg-purple-500', trend: '+3%', link: '/non-staff#list' },
    { title: 'Unread Messages', value: stats.unreadMessages, icon: ChatBubbleLeftRightIcon, color: 'bg-yellow-500', trend: 'New', link: '/messages#list' },
  ];

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
    if (!attendanceSummary) {
      return <div className="text-slate-400">No attendance summary available.</div>;
    }

    const chartSections = attendanceData.map((item, index) => ({
      ...item,
      color: ['#3b82f6', '#10b981', '#f59e0b'][index % 3],
    }));

    if (chartType === 'poll') {
      return (
        <div className="space-y-4">
          {attendanceData.map((item, index) => (
            <div key={item.name} className="rounded-xl border border-slate-700 p-4 bg-slate-950">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-slate-400">{item.name}</p>
                <span className="text-sm font-semibold text-white">{item.percentage}%</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${['bg-blue-500', 'bg-green-500', 'bg-amber-500'][index % 3]}`}
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
            <div className="flex justify-between text-sm text-slate-400 mb-1">
              <span>{item.day}</span>
              <span>{item.attendance}%</span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${item.attendance}%` }} />
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
          <div className="text-slate-400">Loading dashboard...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Welcome back! Here's what's happening today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
            <div key={index} className="bg-slate-900 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{stat.title}</p>
                  <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                  {stat.trend && (
                    <p className="text-xs text-green-500 mt-1">{stat.trend} from last month</p>
                  )}
                </div>
                <Link to={stat.link} className={`${stat.color} p-3 rounded-full hover:opacity-90 transition-opacity`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Trend */}
          <div className="bg-slate-900 rounded-xl shadow-sm p-6 border border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Attendance Trend</h3>
                <p className="text-sm text-slate-400">Choose how to view attendance performance.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'bar', label: 'Bar Chart' },
                  { key: 'poll', label: 'Percentage Poll' },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setChartType(option.key)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${chartType === option.key ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {renderAttendanceChart()}
          </div>

          {/* Today's Attendance Summary */}
          <div className="bg-slate-900 rounded-xl shadow-sm p-6 border border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Today's Attendance</h3>
                <p className="text-sm text-slate-400">Select the day you want to view.</p>
              </div>
              <div className="flex items-center gap-3">
                <CalendarDaysIcon className="w-5 h-5 text-yellow-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="space-y-4">
              {attendanceData.map((item) => (
                <div key={item.name} className="rounded-lg border border-slate-700 p-4 bg-slate-950">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-white">{item.name}</p>
                    <span className="text-sm text-slate-400">{item.percentage}% present</span>
                  </div>
                  <div className="text-sm text-slate-400">Present: {item.present} / Total: {item.total}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-slate-900 rounded-xl shadow-sm p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-white">New student registered</p>
                <p className="text-xs text-slate-400">0 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-white">Attendance marked for 45 students</p>
                <p className="text-xs text-slate-400">0 munite ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-white">New message from Parent</p>
                <p className="text-xs text-slate-400">0 munite ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;