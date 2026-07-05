import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout';
import axios from 'axios';
import { useAuth } from '../contexts/authcontext';
import { Building2, ChevronRight, Clock, DollarSign, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

const statusStyles = {
  approved: 'bg-green-500/20 text-green-300',
  rejected: 'bg-red-500/20 text-red-300',
  pending: 'bg-amber-500/20 text-amber-300',
  none: 'bg-slate-600/50 text-slate-300',
};

const subscriptionBadge = (school) => {
  if (!school.plan_approved) return null;
  if (school.subscription_frozen) return { label: 'Frozen', className: 'bg-red-500/20 text-red-300' };
  if (school.subscription_in_grace) return { label: 'Payment due', className: 'bg-amber-500/20 text-amber-300' };
  if (school.subscription_active === false) return { label: 'Overdue', className: 'bg-red-500/20 text-red-300' };
  return null;
};

const formatMoney = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount || 0);

const SuperAdmin = () => {
  const { school } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [overviewRes, schoolsRes] = await Promise.all([
        axios.get('/api/super-admin/overview'),
        axios.get('/api/super-admin/schools'),
      ]);
      setOverview(overviewRes.data);
      setSchools(schoolsRes.data);
    } catch (error) {
      console.error('Error fetching super admin data:', error);
      toast.error(error.response?.data?.error || 'Failed to load school accounts');
    } finally {
      setLoading(false);
    }
  };

  const sortedSchools = [...schools].sort((a, b) => {
    const order = { pending: 0, rejected: 1, approved: 2 };
    const aStatus = a.plan_status || (a.payment_plan ? 'pending' : 'none');
    const bStatus = b.plan_status || (b.payment_plan ? 'pending' : 'none');
    return (order[aStatus] ?? 3) - (order[bStatus] ?? 3);
  });

  const statCards = overview
    ? [
        { title: 'Total Revenue', value: formatMoney(overview.totalRevenue), icon: DollarSign, color: 'bg-emerald-500', subtitle: 'All recorded payments' },
        { title: 'Revenue This Month', value: formatMoney(overview.revenueThisMonth), icon: TrendingUp, color: 'bg-primary-500', subtitle: 'Subscription payments' },
        { title: 'Registered Schools', value: overview.totalSchools, icon: Building2, color: 'bg-primary-600', subtitle: `${overview.activeSubscriptions || 0} active subscriptions` },
      ]
    : [];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-300">Loading platform overview...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Super Admin Dashboard</h1>
          <p className="text-slate-300 mt-1">
            Welcome, {school?.name}. Revenue updates when you record subscription payments for each school.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statCards.map((stat) => (
            <div key={stat.title} className="bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-600">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-300">{stat.title}</p>
                  <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                  {stat.subtitle && (
                    <p className="text-xs text-slate-400 mt-1">{stat.subtitle}</p>
                  )}
                </div>
                <div className={`${stat.color} p-3 rounded-full shrink-0`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-600 overflow-hidden">
          <div className="p-6 border-b border-slate-600">
            <h2 className="text-lg font-semibold text-white">Registered Schools</h2>
            <p className="text-sm text-slate-300 mt-1">
              Click a school to view credentials, review their plan, record payments, and approve access.
            </p>
          </div>

          {schools.length === 0 ? (
            <div className="p-8 text-center text-slate-300">No schools registered yet.</div>
          ) : (
            <div className="divide-y divide-slate-600">
              {sortedSchools.map((item) => {
                const status = item.plan_status || (item.payment_plan ? 'pending' : 'none');
                const needsAction = status === 'pending' || status === 'none';
                const subBadge = subscriptionBadge(item);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/super-admin/schools/${item.id}`)}
                    className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-slate-700/60 transition-colors"
                  >
                    {item.logo_url ? (
                      <img
                        src={item.logo_url}
                        alt={`${item.name} logo`}
                        className="w-11 h-11 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-primary-500/20 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-primary-400" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white">{item.name}</span>
                        {needsAction && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-300">
                            <Clock className="w-3 h-3" />
                            Needs review
                          </span>
                        )}
                        {subBadge && (
                          <span className={`px-2 py-0.5 text-xs rounded-full ${subBadge.className}`}>
                            {subBadge.label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 truncate mt-0.5">{item.email}</p>
                    </div>

                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-medium text-emerald-300">
                        {formatMoney(item.total_paid)}
                        <span className="text-slate-400 font-normal text-xs ml-1">paid</span>
                      </span>
                      <span className="text-sm text-slate-200">
                        {item.plan_name || 'No plan'}
                        {item.plan_price ? ` · $${item.plan_price}/mo` : ''}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${statusStyles[status] || statusStyles.none}`}>
                        {status === 'none' ? 'awaiting plan' : status}
                      </span>
                    </div>

                    <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SuperAdmin;
