import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/layout';
import axios from 'axios';
import { FEATURE_LABELS } from '../constants/plans';
import {
  Building2,
  ArrowLeft,
  Eye,
  EyeOff,
  Users,
  Briefcase,
  UserCog,
  Mail,
  Calendar,
  ShieldCheck,
  CreditCard,
  Trash2,
  Snowflake,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

const formatMoney = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount || 0);

const statusStyles = {
  approved: 'bg-green-500/20 text-green-300 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  none: 'bg-slate-600/50 text-slate-300 border-slate-500',
};

const subscriptionStyles = {
  current: 'bg-green-500/20 text-green-300',
  grace_period: 'bg-amber-500/20 text-amber-300',
  overdue: 'bg-red-500/20 text-red-300',
  frozen: 'bg-red-500/20 text-red-300',
};

const SuperAdminSchool = () => {
  const { schoolId } = useParams();
  const navigate = useNavigate();
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [updatingApproval, setUpdatingApproval] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [updatingSubscription, setUpdatingSubscription] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSchool();
  }, [schoolId]);

  const fetchSchool = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/super-admin/schools/${schoolId}`);
      setSchool(response.data);
    } catch (error) {
      console.error('Error fetching school:', error);
      toast.error(error.response?.data?.error || 'Failed to load school');
      navigate('/super-admin');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalChange = async (status) => {
    setUpdatingApproval(true);
    try {
      const response = await axios.patch(`/api/super-admin/schools/${schoolId}/approval`, { status });
      setSchool(response.data);
      toast.success(status === 'approved' ? 'Plan approved — features unlocked' : 'Approval status updated');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update approval');
    } finally {
      setUpdatingApproval(false);
    }
  };

  const handleRecordPayment = async () => {
    setRecordingPayment(true);
    try {
      const response = await axios.post(`/api/super-admin/schools/${schoolId}/record-payment`);
      setSchool(response.data);
      const paid = response.data?.plan_price || 0;
      toast.success(
        paid
          ? `Payment recorded (${formatMoney(paid)}) — subscription renewed`
          : 'Subscription renewed — period dates updated'
      );
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleFreezeToggle = async () => {
    setUpdatingSubscription(true);
    try {
      const response = await axios.patch(`/api/super-admin/schools/${schoolId}/subscription`, {
        frozen: !school.subscription_frozen,
      });
      setSchool(response.data);
      toast.success(school.subscription_frozen ? 'Account unfrozen' : 'Account frozen — features locked');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update subscription');
    } finally {
      setUpdatingSubscription(false);
    }
  };

  const handleDeleteSchool = async () => {
    if (deleteConfirmName.trim() !== school.name) {
      toast.error('School name does not match');
      return;
    }
    setDeleting(true);
    try {
      await axios.delete(`/api/super-admin/schools/${schoolId}`, {
        data: { confirmName: deleteConfirmName.trim() },
      });
      toast.success('School account deleted');
      navigate('/super-admin');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete school');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-300">Loading school details...</div>
        </div>
      </Layout>
    );
  }

  if (!school) return null;

  const status = school.plan_status || (school.payment_plan ? 'pending' : 'none');
  const features = school.plan_approved && school.subscription_active !== false
    ? school.plan_features
    : school.pending_plan_features;
  const subStatus = school.subscription_frozen
    ? 'frozen'
    : !school.subscription_active && school.plan_approved
      ? 'overdue'
      : school.subscription_in_grace
        ? 'grace_period'
        : 'current';

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <Link
          to="/super-admin"
          className="inline-flex items-center gap-2 text-slate-300 hover:text-slate-100 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to all schools
        </Link>

        <div className="flex items-start gap-4">
          {school.logo_url ? (
            <img
              src={school.logo_url}
              alt={`${school.name} logo`}
              className="w-16 h-16 rounded-xl object-cover border border-slate-600"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-primary-500/20 flex items-center justify-center border border-slate-600">
              <Building2 className="w-8 h-8 text-primary-400" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-white">{school.name}</h1>
            <p className="text-slate-300 mt-1">{school.email}</p>
            <span className={`inline-block mt-2 px-3 py-1 text-xs rounded-full border capitalize ${statusStyles[status] || statusStyles.none}`}>
              {status === 'none' ? 'awaiting plan' : status}
            </span>
          </div>
        </div>

        {/* Account credentials */}
        <section className="bg-slate-800 rounded-xl border border-slate-600 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary-400" />
            Login Credentials
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Email</p>
              <p className="text-slate-100 font-mono text-sm">{school.email}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Password</p>
              <div className="flex items-center gap-2">
                <p className="text-slate-100 font-mono text-sm">
                  {school.initial_password
                    ? showPassword
                      ? school.initial_password
                      : '••••••••'
                    : '—'}
                </p>
                {school.initial_password && (
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-slate-300 hover:text-slate-100"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Registered</p>
              <p className="text-slate-100 text-sm flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                {school.created_at ? new Date(school.created_at).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }) : '—'}
              </p>
            </div>
          </div>
        </section>

        {/* Payment plan (read-only — chosen by the school) */}
        <section className="bg-slate-800 rounded-xl border border-slate-600 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary-400" />
            Payment Plan
          </h2>
          {school.payment_plan ? (
            <div className="rounded-lg bg-slate-900 border border-slate-600 p-4">
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <p className="text-lg font-semibold text-white">{school.plan_name}</p>
                {school.plan_price != null && (
                  <p className="text-emerald-300 font-semibold">{formatMoney(school.plan_price)}/month</p>
                )}
              </div>
              {school.plan_selected_at && (
                <p className="text-sm text-slate-300 mt-1">
                  Selected by school on{' '}
                  {new Date(school.plan_selected_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
            </div>
          ) : (
            <p className="text-amber-400 text-sm">
              This school has not selected a payment plan yet. They must choose one from their account before approval.
            </p>
          )}
          <p className="text-xs text-slate-400">
            Plans are selected by each school during signup or from their dashboard. Platform admins cannot change them.
          </p>
        </section>

        {/* Subscription billing */}
        {school.plan_approved && (
          <section className="bg-slate-800 rounded-xl border border-slate-600 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary-400" />
              Subscription &amp; Billing
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg bg-slate-900 border border-emerald-500/30 p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total paid</p>
                <p className="text-2xl font-bold text-emerald-300">{formatMoney(school.total_paid)}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {school.plan_price ? `${formatMoney(school.plan_price)} per renewal` : 'Recorded payments'}
                </p>
              </div>
              <div className="rounded-lg bg-slate-900 border border-slate-600 p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Subscription since</p>
                <p className="text-slate-100 font-medium">
                  {school.subscription_started_at
                    ? new Date(school.subscription_started_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Not set'}
                </p>
                <p className="text-xs text-slate-400 mt-1">Fixed billing anchor</p>
              </div>
              <div className="rounded-lg bg-slate-900 border border-slate-600 p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Current period started</p>
                <p className="text-slate-100 font-medium">
                  {school.last_payment_at
                    ? new Date(school.last_payment_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Not set'}
                </p>
              </div>
              <div className="rounded-lg bg-slate-900 border border-slate-600 p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Current period ends</p>
                <p className="text-slate-100 font-medium">
                  {school.next_payment_due
                    ? new Date(school.next_payment_due).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Not set'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1 text-xs rounded-full capitalize ${subscriptionStyles[subStatus] || subscriptionStyles.current}`}>
                {subStatus === 'grace_period'
                  ? `Grace period (${school.subscription_days_past_due || 0} days overdue)`
                  : subStatus.replace('_', ' ')}
              </span>
              {school.subscription_active === false && (
                <span className="inline-flex items-center gap-1 text-xs text-red-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Features locked
                </span>
              )}
            </div>

            <p className="text-sm text-slate-300">
              Billing runs monthly from the subscription date. When you record a renewal, the period start and end dates advance to the next fixed month on the schedule.
              Features lock {school.subscription_grace_days || 5} days after the period end if payment is not recorded.
            </p>

            {school.payment_records?.length > 0 && (
              <div className="rounded-lg bg-slate-900 border border-slate-600 overflow-hidden">
                <p className="text-xs text-slate-400 uppercase tracking-wide px-4 py-3 border-b border-slate-600">
                  Payment history
                </p>
                <ul className="divide-y divide-slate-700 max-h-48 overflow-y-auto">
                  {school.payment_records.map((record, index) => (
                    <li key={`${record.recorded_at}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                      <div>
                        <p className="text-slate-100 font-medium">{record.plan_name || 'Subscription'}</p>
                        <p className="text-xs text-slate-400">
                          {record.recorded_at
                            ? new Date(record.recorded_at).toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </p>
                      </div>
                      <span className="text-emerald-300 font-semibold shrink-0">
                        {formatMoney(record.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={recordingPayment}
                onClick={handleRecordPayment}
                className="px-4 py-2 text-sm rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                {recordingPayment
                  ? 'Recording…'
                  : school.plan_price
                    ? `Record payment (${formatMoney(school.plan_price)})`
                    : 'Renew subscription'}
              </button>
              <button
                type="button"
                disabled={updatingSubscription}
                onClick={handleFreezeToggle}
                className={`px-4 py-2 text-sm rounded-lg flex items-center gap-2 disabled:opacity-50 ${
                  school.subscription_frozen
                    ? 'bg-slate-600 hover:bg-slate-500 text-slate-100'
                    : 'bg-red-600/80 hover:bg-red-700 text-white'
                }`}
              >
                <Snowflake className="w-4 h-4" />
                {school.subscription_frozen ? 'Unfreeze account' : 'Freeze account'}
              </button>
            </div>
          </section>
        )}

        {/* Approval */}
        <section className="bg-slate-800 rounded-xl border border-slate-600 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary-400" />
            Plan Approval
          </h2>
          {!school.payment_plan ? (
            <p className="text-amber-400 text-sm">The school must select a payment plan before you can approve their account.</p>
          ) : (
            <p className="text-slate-300 text-sm">
              Approve to unlock all features included in the {school.plan_name} plan for this school.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {school.plan_status !== 'approved' && (
              <>
                <button
                  type="button"
                  disabled={!school.payment_plan || updatingApproval}
                  onClick={() => handleApprovalChange('approved')}
                  className="px-4 py-2 text-sm rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={updatingApproval}
                  onClick={() => handleApprovalChange('rejected')}
                  className="px-4 py-2 text-sm rounded-lg bg-red-600/80 hover:bg-red-700 text-white disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            )}
            {school.plan_status === 'approved' && (
              <button
                type="button"
                disabled={updatingApproval}
                onClick={() => handleApprovalChange('pending')}
                className="px-4 py-2 text-sm rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-100 disabled:opacity-50"
              >
                Revoke approval
              </button>
            )}
          </div>
        </section>

        {/* Plan features */}
        <section className="bg-slate-800 rounded-xl border border-slate-600 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Plan Features</h2>
          {features?.length ? (
            <div className="flex flex-wrap gap-2">
              {features.map((feature) => (
                <span
                  key={feature}
                  className={`px-3 py-1 text-xs rounded-full ${
                    school.plan_approved && school.subscription_active !== false
                      ? 'bg-primary-500/20 text-primary-300'
                      : 'bg-slate-700 text-slate-300 border border-slate-600'
                  }`}
                >
                  {FEATURE_LABELS[feature] || feature.replace(/-/g, ' ')}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No features — the school must select a payment plan first.</p>
          )}
        </section>

        {/* Usage */}
        <section className="bg-slate-800 rounded-xl border border-slate-600 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Usage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Students', value: school.stats?.students ?? 0, icon: Users, color: 'text-primary-400' },
              { label: 'Staff', value: school.stats?.staff ?? 0, icon: Briefcase, color: 'text-green-400' },
              { label: 'Non-Staff', value: school.stats?.nonStaff ?? 0, icon: UserCog, color: 'text-purple-400' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-slate-900 border border-slate-600 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                  <span className="text-sm text-slate-300">{item.label}</span>
                </div>
                <p className="text-2xl font-bold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Delete school */}
        <section className="bg-slate-800 rounded-xl border border-red-500/30 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-red-400 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Delete School Account
          </h2>
          <p className="text-sm text-slate-300">
            Permanently delete this school and all associated students, staff, attendance, and messages. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 text-sm rounded-lg bg-red-600/80 hover:bg-red-700 text-white"
          >
            Delete school account
          </button>
        </section>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-white">Confirm deletion</h3>
            <p className="text-sm text-slate-300">
              Type <span className="text-white font-medium">{school.name}</span> to permanently delete this school account.
            </p>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="School name"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded-lg text-white text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmName('');
                }}
                className="px-4 py-2 text-sm rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting || deleteConfirmName.trim() !== school.name}
                onClick={handleDeleteSchool}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default SuperAdminSchool;
