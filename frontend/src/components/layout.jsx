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

  Lock,

  Landmark,

  Wallet,

} from 'lucide-react';

import toast from 'react-hot-toast';



const Layout = ({ children }) => {

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { school, logout, isSuperAdmin, hasFeature, includesPlanFeature, isPlanApproved } = useAuth();

  const navigate = useNavigate();



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

          items: [{ name: 'All Schools', href: '/super-admin', icon: LayoutDashboard }],

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

        >

          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}

        </button>

      </div>



      <div

        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-800 shadow-xl transform transition-transform duration-300 ease-in-out ${

          sidebarOpen ? 'translate-x-0' : '-translate-x-full'

        } lg:translate-x-0`}

      >

        <div className="flex flex-col h-full">

          <div className="flex items-center gap-2 p-6 border-b border-slate-600">

            {school?.logo_url ? (

              <img

                src={school.logo_url}

                alt={`${school.name} logo`}

                className="w-10 h-10 rounded-lg object-cover"

              />

            ) : (

              <School className="w-8 h-8 text-primary-400" />

            )}

            <div>

              <h1 className="text-xl font-bold text-white">{isSuperAdmin ? 'SchoolMS' : (school?.name || 'SchoolMS')}</h1>

              <p className="text-xs text-slate-300">

                {isSuperAdmin
                  ? 'Platform Admin'
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

                    const isLocked = !isSuperAdmin && !isPlanApproved && (item.featureKeys

                      ? !item.featureKeys.some((key) => hasFeature(key))

                      : Boolean(item.featureKey) && !hasFeature(item.featureKey));

                    const itemClasses = `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${

                      isLocked

                        ? 'text-slate-400 cursor-not-allowed opacity-60'

                        : 'text-slate-100 hover:bg-slate-700'

                    }`;

                    if (isLocked) {

                      return (

                        <button

                          key={item.name}

                          type="button"

                          onClick={() => {

                            setSidebarOpen(false);

                            toast.error('This feature is locked until your plan is approved by the admin.');

                          }}

                          className={`${itemClasses} w-full text-left`}

                        >

                          <item.icon className="w-5 h-5" />

                          <span className="flex-1">{item.name}</span>

                          <Lock className="w-4 h-4 shrink-0" />

                        </button>

                      );

                    }

                    return (

                      <Link

                        key={item.name}

                        to={item.href}

                        onClick={() => setSidebarOpen(false)}

                        className={itemClasses}

                      >

                        <item.icon className="w-5 h-5" />

                        <span>{item.name}</span>

                      </Link>

                    );

                  })}

                </div>

              </div>

            ))}

          </nav>



          <div className="p-4 border-t border-slate-600">

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



      <div className="lg:ml-64">

        <main className="p-6">{children}</main>

      </div>

    </div>

  );

};



export default Layout;

