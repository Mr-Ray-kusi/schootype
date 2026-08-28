import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
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
  ClipboardList,
  Bell,
  Activity,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import OfflineBanner from './OfflineBanner';
import useLiteMode from '../hooks/useLiteMode';
import usePlatformTelemetry from '../hooks/usePlatformTelemetry';

/** True when pathname is exactly href, or a nested path under href (segment-safe). */
const isNavActive = (pathname, href) => {
  if (!href) return false;
  if (pathname === href) return true;
  if (href === '/super-admin' || href === '/') return false;
  return pathname.startsWith(`${href}/`);
};

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const { school, logout, isSuperAdmin, hasFeature, includesPlanFeature, isPlanApproved, token } =
    useAuth();
  const { liteMode, toggleLiteMode } = useLiteMode();
  const navigate = useNavigate();
  const location = useLocation();
  usePlatformTelemetry();

  const refreshUnread = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await axios.get('/api/notifications/unread-count');
      setUnread(Number(data.unread) || 0);
    } catch {
      // Table may not exist until migration is applied.
    }
  }, [token]);

  useEffect(() => {
    refreshUnread();
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refreshUnread();
    }, 30000);
    return () => clearInterval(id);
  }, [refreshUnread, location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const schoolNavSections = [
    {
      title: 'Main',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, featureKey: 'dashboard' },
        { name: 'Notifications', href: '/notifications', icon: Bell },
      ],
    },
    {
      title: 'Academic',
      items: [
        { name: 'Students', href: '/students', icon: Users, featureKey: 'students' },
        { name: 'Staffs', href: '/staff', icon: Briefcase, featureKey: 'staff' },
        { name: 'Setup', href: '/classes', icon: BookOpen, featureKey: 'classes' },
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
            { name: 'Analytics', href: '/super-admin/analytics', icon: Activity },
            { name: 'Monitoring', href: '/super-admin/monitor', icon: ClipboardList },
            { name: 'Notifications', href: '/super-admin/notifications', icon: Bell },
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
            if (!item.featureKey && !item.featureKeys) return true;
            if (item.featureKeys) {
              return item.featureKeys.some((key) => includesPlanFeature(key));
            }
            return includesPlanFeature(item.featureKey);
          }),
        }))
        .filter((section) => section.items.length > 0);

  const notificationsHref = isSuperAdmin ? '/super-admin/notifications' : '/notifications';
  const searchHref = isSuperAdmin ? '/super-admin' : '/students';

  return (
    <div className="console-shell p-0 lg:p-3">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="console-frame relative">
        <aside
          className={`console-sidebar fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center gap-2.5 px-6 pb-2 pt-7">
            {school?.logo_url ? (
              <img
                src={school.logo_url}
                alt={`${school.name} logo`}
                loading="lazy"
                className="h-9 w-9 rounded-lg object-cover"
              />
            ) : (
              <School className="h-7 w-7 text-white" />
            )}
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-white">
                {isSuperAdmin ? 'Schooltype' : school?.name || 'Schooltype'}
              </h1>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-5 pl-3">
            {navigationSections.map((section) => (
              <div key={section.title} className="mb-5">
                <h2 className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                  {section.title}
                </h2>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isNavActive(location.pathname, item.href);
                    const isLocked =
                      !isSuperAdmin &&
                      Boolean(item.featureKey || item.featureKeys) &&
                      !isPlanApproved &&
                      (item.featureKeys
                        ? !item.featureKeys.some((key) => hasFeature(key))
                        : Boolean(item.featureKey) && !hasFeature(item.featureKey));

                    const itemClasses = `console-nav-item w-full text-left ${
                      isLocked ? 'is-locked' : active ? 'is-active' : ''
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
                          className={itemClasses}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 truncate">{item.name}</span>
                          <Lock className="h-3.5 w-3.5 shrink-0" />
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
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate">{item.name}</span>
                        {item.name === 'Notifications' && unread > 0 && (
                          <span className="rounded-full bg-[#ff6a3c] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="space-y-3 px-6 py-5 text-xs text-white/80">
            <button type="button" onClick={toggleLiteMode} className="block hover:text-white">
              Lite mode {liteMode ? 'on' : 'off'}
            </button>
            <button type="button" onClick={handleLogout} className="inline-flex items-center gap-1.5 hover:text-white">
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </aside>

        <div className="console-main min-w-0 flex-1 bg-white">
          <div className="flex items-center justify-between px-4 pb-2 pt-4 sm:px-8">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              className="rounded-lg p-2 text-[#111827] lg:hidden"
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="ml-auto flex items-center gap-2">
              <Link
                to={notificationsHref}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#111827] hover:bg-[#f3f6fb]"
                aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#ff6a3c]" />
                )}
              </Link>
              <Link
                to={searchHref}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#111827] hover:bg-[#f3f6fb]"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </Link>
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#2f6eff] text-xs font-bold text-white">
                {school?.logo_url ? (
                  <img src={school.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (school?.name || 'S').charAt(0).toUpperCase()
                )}
              </span>
            </div>
          </div>

          <main className="min-w-0 overflow-x-hidden px-4 pb-8 pt-2 sm:px-8">
            <OfflineBanner />
            {children ?? <Outlet />}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
