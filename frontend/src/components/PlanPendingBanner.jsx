import { Clock, Lock } from 'lucide-react';
import { useAuth } from '../contexts/authcontext';
import { FEATURE_LABELS, getPlan } from '../constants/plans';

const PlanPendingBanner = () => {
  const { school, isPlanApproved } = useAuth();

  if (!school?.payment_plan || isPlanApproved) {
    return null;
  }

  const status = school.plan_status || 'pending';
  const isRejected = status === 'rejected';
  const planPrice = getPlan(school.payment_plan)?.price;

  return (
    <div className={`rounded-xl border p-5 mb-6 ${isRejected ? 'border-red-500/40 bg-red-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
      <div className="flex items-start gap-3">
        {isRejected ? (
          <Lock className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
        ) : (
          <Clock className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-white">
            {isRejected ? 'Plan not approved' : 'Awaiting admin approval'}
          </h3>
          <p className="text-sm text-slate-200 mt-1">
            {isRejected
              ? `Your ${school.plan_name || 'selected'} plan was not approved. Contact the platform admin.`
              : `Your ${school.plan_name || 'selected'} plan${planPrice ? ` ($${planPrice}/mo)` : ''} is pending review. Features below are locked until a super admin approves your account.`}
          </p>
          {school.pending_plan_features?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {school.pending_plan_features.map((feature) => (
                <span
                  key={feature}
                  className="px-2 py-1 text-xs rounded-full bg-slate-800/80 text-slate-200 border border-slate-600"
                >
                  {FEATURE_LABELS[feature] || feature}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanPendingBanner;
