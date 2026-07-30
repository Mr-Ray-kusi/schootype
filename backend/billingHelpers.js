import { getPlan } from './plans.js';
import { initializeSubscription, renewSubscription } from './subscription.js';
import {
  getSchoolExtrasSync,
  parsePaymentRecords,
  upsertSchoolExtras,
  mergeSchoolWithExtras,
} from './schoolPlanStore.js';

/**
 * Apply a successful subscription payment (Paystack or manual).
 *
 * - First payment (not approved / no billing dates): approve + initialize period + record.
 * - Renewal (already approved with billing dates): renew period + record.
 * Idempotent when paystackReference matches an existing payment_records entry.
 */
export async function applySubscriptionPayment(schoolId, school, {
  source = 'manual',
  paystackReference = null,
  updateSchoolRecord = null,
} = {}) {
  const merged = mergeSchoolWithExtras(school);
  const plan = getPlan(merged.payment_plan);

  if (!plan) {
    const err = new Error('School has no valid payment plan');
    err.status = 400;
    throw err;
  }

  const extras = getSchoolExtrasSync(schoolId);
  const records = parsePaymentRecords(extras);

  if (paystackReference && records.some((r) => r.paystack_reference === paystackReference)) {
    return {
      alreadyProcessed: true,
      amount: plan.price,
      schoolId,
    };
  }

  const wasApproved = (merged.plan_status || 'pending') === 'approved';
  const hasBilling = Boolean(merged.next_payment_due);

  let billingUpdates;
  if (!wasApproved || !hasBilling) {
    billingUpdates = {
      plan_status: 'approved',
      ...initializeSubscription(),
      subscription_frozen: false,
    };
  } else {
    billingUpdates = {
      ...renewSubscription(merged),
      subscription_frozen: false,
    };
  }

  const amount = plan.price;
  records.unshift({
    amount,
    plan_id: merged.payment_plan,
    plan_name: plan.name,
    recorded_at: new Date().toISOString(),
    source,
    paystack_reference: paystackReference || null,
  });

  await upsertSchoolExtras(schoolId, {
    ...billingUpdates,
    total_paid: (Number(extras?.total_paid) || 0) + amount,
    payment_records: JSON.stringify(records),
  });

  // Always sync approval to Supabase so features unlock immediately after successful payment.
  if (typeof updateSchoolRecord === 'function') {
    await updateSchoolRecord(schoolId, { plan_status: 'approved' });
  }

  return {
    alreadyProcessed: false,
    amount,
    schoolId,
    approved: true,
    source,
  };
}
