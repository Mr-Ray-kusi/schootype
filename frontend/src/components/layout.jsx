import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/authcontext';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  UserCog,
  Calendar,
  QrCode,
  UserPlus,
  LogOut,
  Menu,
  X,
  School,
  BookOpen,
  MessageSquare,
  FileText,
  DollarSign,
  Receipt,
} from 'lucide-react';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { school, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigationSections = [
    {
      title: 'Main',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Academic',
      items: [
        { name: 'Students', href: '/students', icon: Users },
        { name: 'Staffs', href: '/staff', icon: Briefcase },
        { name: 'Classes', href: '/classes', icon: BookOpen },
        { name: 'Attendance', href: '/attendance', icon: Calendar },
        { name: 'Non-Staffs', href: '/non-staff', icon: UserCog },
        { name: 'Scanner', href: '/scanner', icon: QrCode },
        { name: 'Add Student', href: '/add-student', icon: UserPlus },
      ],
    },
    {
      title: 'Result',
      items: [
        { name: 'Report Cards', href: '/report-cards', icon: FileText },
        { name: 'Messages', href: '/messages', icon: MessageSquare },
      ],
    },
    {
      title: 'Finance',
      items: [
        { name: 'Fees Paid', href: '/fees-paid', icon: DollarSign },
        { name: 'Fees Unpaid', href: '/fees-unpaid', icon: Receipt },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 bg-slate-900 text-slate-100 rounded-lg shadow-md"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 shadow-xl transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2 p-6 border-b border-slate-700">
            <School className="w-8 h-8 text-indigo-400" />
            <div>
              <h1 className="text-xl font-bold text-white">SchoolMS</h1>
              <p className="text-xs text-slate-400">{school?.name}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-6">
            {navigationSections.map((section) => (
              <div key={section.title}>
                <h2 className="px-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {section.title}
                </h2>
                <div className="mt-2 space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Logout button */}
          <div className="p-4 border-t border-slate-700">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2 w-full text-red-400 rounded-lg hover:bg-red-800 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:ml-64">
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;