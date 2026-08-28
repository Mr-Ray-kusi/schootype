import { Clock, Lock } from 'lucide-react';
import { useAuth } from '../contexts/authcontext';
import { FEATURE_LABELS, getPlan, formatPlanPriceGhs } from '../constants/plans';

const PlanPendingBanner = () => {
  const { school, isPlanApproved } = useAuth();

  if (!school?.payment_plan || isPlanApproved) {
    return null;
  }

  const status = school.plan_status || 'pending';
  const isRejected = status === 'rejected';
  const plan = getPlan(school.payment_plan);
  const planPriceLabel = formatPlanPriceGhs(plan);

  return (
    <div className={`rounded-xl border p-5 mb-6 ${isRejected ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-start gap-3">
        {isRejected ? (
          <Lock className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
        ) : (
          <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-[#111827]">
            {isRejected ? 'Plan not approved' : 'Awaiting admin approval'}
          </h3>
          <p className="text-sm text-[#6b7280] mt-1">
            {isRejected
              ? `Your ${school.plan_name || 'selected'} plan was not approved. Contact the platform admin.`
              : `Your ${school.plan_name || 'selected'} plan${planPriceLabel ? ` (${planPriceLabel}/yr)` : ''} is pending review. Features below are locked until a super admin approves your account.`}
          </p>
          {school.pending_plan_features?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {school.pending_plan_features.map((feature) => (
                <span
                  key={feature}
                  className="px-2 py-1 text-xs rounded-full bg-white text-[#111827] border border-[#e6ebf4]"
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
