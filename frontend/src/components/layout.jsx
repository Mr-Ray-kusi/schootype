import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
  Lock,
  Landmark,
  Wallet,
  Mail,
} from 'lucide-react';
import toast from 'react-hot-toast';

/** True when pathname is exactly href, or a nested path under href (segment-safe). */
const isNavActive = (pathname, href) => {
  if (!href) return false;
  if (pathname === href) return true;
  // Avoid `/super-admin` matching every platform page
  if (href === '/super-admin' || href === '/') return false;
  return pathname.startsWith(`${href}/`);
};

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { school, logout, isSuperAdmin, hasFeature, includesPlanFeature, isPlanApproved } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const schoolNavSections = [
    {
      title: 'Main',
      items: [{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, featureKey: 'dashboard' }],
    },
    {
      title: 'Academic',
      items: [
        { name: 'Students', href: '/students', icon: Users, featureKey: 'students' },
        { name: 'Staffs', href: '/staff', icon: Briefcase, featureKey: 'staff' },
        { name: 'Classes', href: '/classes', icon: BookOpen, featureKey: 'classes' },
        { name: 'Attendance', href: '/attendance', icon: Calendar, featureKey: 'attendance' },
        { name: 'Non-Staffs', href: '/non-staff', icon: UserCog, featureKey: 'non-staff' },
        { name: 'Scanner', href: '/scanner', icon: QrCode, featureKey: 'scanner' },
        { name: 'Add Student', href: '/add-student', icon: UserPlus, featureKey: 'add-student' },
      ],
    },
    {
      title: 'Communication',
      items: [
        { name: 'Messages', href: '/messages', icon: MessageSquare, featureKeys: ['messages-sms', 'messages-email'] },
      ],
    },
    {
      title: 'Result',
      items: [
        { name: 'Report Cards', href: '/report-cards', icon: FileText, featureKey: 'report-cards' },
      ],
    },
    {
      title: 'Finance',
      items: [
        { name: 'Bank Settings', href: '/bank-settings', icon: Landmark, featureKey: 'bank-settings' },
        { name: 'School Wallet', href: '/school-wallet', icon: Wallet, featureKey: 'school-wallet' },
        { name: 'Fees Paid', href: '/fees-paid', icon: DollarSign, featureKey: 'fees-paid' },
        { name: 'Fees Unpaid', href: '/fees-unpaid', icon: Receipt, featureKey: 'fees-unpaid' },
      ],
    },
  ];

  const navigationSections = isSuperAdmin
    ? [
        {
          title: 'Platform',
          items: [
            { name: 'All Schools', href: '/super-admin', icon: LayoutDashboard },
            { name: 'Email Schools', href: '/super-admin/email-schools', icon: Mail },
            { name: 'SMS Units', href: '/super-admin/sms', icon: MessageSquare },
          ],
        },
        {
          title: 'Finance',
          items: [
            { name: 'Bank Settings', href: '/super-admin/bank-settings', icon: Landmark },
            { name: 'Platform Wallet', href: '/super-admin/platform-wallet', icon: Wallet },
          ],
        },
      ]
    : schoolNavSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            if (item.featureKeys) {
              return item.featureKeys.some((key) => includesPlanFeature(key));
            }
            return includesPlanFeature(item.featureKey);
          }),
        }))
        .filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 bg-slate-800 text-slate-50 rounded-lg shadow-md"
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-800 shadow-xl transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex items-center gap-2 p-6 border-b border-slate-600 shrink-0">
          {school?.logo_url ? (
            <img
              src={school.logo_url}
              alt={`${school.name} logo`}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <School className="w-8 h-8 text-primary-400" />
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">
              {isSuperAdmin ? 'NEXUS' : (school?.name || 'NEXUS')}
            </h1>
            <p className="text-xs text-slate-300 truncate">
              {isSuperAdmin
                ? 'The central connection point for all your school academic activities'
                : `${school?.plan_name || 'No plan'} · ${!isPlanApproved && school?.payment_plan ? 'Pending approval' : 'Admin'}`}
            </p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          {navigationSections.map((section) => (
            <div key={section.title}>
              <h2 className="px-4 text-xs font-semibold uppercase tracking-wide text-slate-300">
                {section.title}
              </h2>
              <div className="mt-2 space-y-1">
                {section.items.map((item) => {
                  const active = isNavActive(location.pathname, item.href);
                  const isLocked =
                    !isSuperAdmin &&
                    !isPlanApproved &&
                    (item.featureKeys
                      ? !item.featureKeys.some((key) => hasFeature(key))
                      : Boolean(item.featureKey) && !hasFeature(item.featureKey));

                  const itemClasses = `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                    isLocked
                      ? 'text-slate-400 cursor-not-allowed opacity-60'
                      : active
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-100 hover:bg-slate-700'
                  }`;

                  if (isLocked) {
                    return (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => {
                          setSidebarOpen(false);
                          toast.error('This feature is locked until your plan is approved by the admin.');
                        }}
                        className={`${itemClasses} w-full text-left`}
                      >
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span className="flex-1 truncate">{item.name}</span>
                        <Lock className="w-4 h-4 shrink-0" />
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={itemClasses}
                      aria-current={active ? 'page' : undefined}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-600 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2 w-full text-red-400 rounded-lg hover:bg-red-800 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="lg:ml-64 min-w-0">
        <main className="min-w-0 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
