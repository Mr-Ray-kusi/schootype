export const SUBSCRIPTION_GRACE_DAYS = 14;

export function addMonths(date, months) {
  const d = new Date(`${toDateString(date)}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function addYears(date, years) {
  const d = new Date(`${toDateString(date)}T12:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export function toDateString(date) {
  return new Date(date).toISOString().split('T')[0];
}

/** Set when a subscription is first approved — yearly billing cycle. */
export function initializeSubscription(startDate = new Date()) {
  const started = toDateString(startDate);
  return {
    subscription_started_at: started,
    last_payment_at: started,
    next_payment_due: toDateString(addYears(started, 1)),
  };
}

/**
 * Advance to the next yearly billing period on renewal.
 */
export function renewSubscription(school) {
  const periodEnd = school.next_payment_due;
  const anchor = school.subscription_started_at || school.last_payment_at;

  if (!periodEnd) {
    return initializeSubscription(anchor || new Date());
  }

  if (!anchor && !school.last_payment_at) {
    const started = toDateString(addYears(periodEnd, -1));
    const newPeriodStart = periodEnd;
    const newPeriodEnd = toDateString(addYears(periodEnd, 1));
    return {
      subscription_started_at: started,
      last_payment_at: newPeriodStart,
      next_payment_due: newPeriodEnd,
    };
  }

  let periodStart = periodEnd;
  let nextEnd = toDateString(addYears(periodEnd, 1));
  const now = new Date();

  while (new Date(`${nextEnd}T23:59:59`) <= now) {
    periodStart = nextEnd;
    nextEnd = toDateString(addYears(nextEnd, 1));
  }

  return {
    subscription_started_at: anchor || periodStart,
    last_payment_at: periodStart,
    next_payment_due: nextEnd,
  };
}

export function getSubscriptionInfo(school) {
  const frozen = school.subscription_frozen === true || school.subscription_frozen === 1;
  const planApproved = (school.plan_status || 'pending') === 'approved';
  const nextPaymentDue = school.next_payment_due || null;
  const lastPaymentAt = school.last_payment_at || null;
  const subscriptionStartedAt = school.subscription_started_at || lastPaymentAt || null;

  const base = {
    subscription_frozen: frozen,
    subscription_started_at: subscriptionStartedAt,
    next_payment_due: nextPaymentDue,
    last_payment_at: lastPaymentAt,
    grace_days: SUBSCRIPTION_GRACE_DAYS,
  };

  if (!planApproved) {
    return {
      ...base,
      subscription_active: false,
      reason: 'not_approved',
      in_grace_period: false,
      days_past_due: 0,
      days_until_due: null,
    };
  }

  if (frozen) {
    return {
      ...base,
      subscription_active: false,
      reason: 'frozen',
      in_grace_period: false,
      days_past_due: nextPaymentDue ? daysPastDue(nextPaymentDue) : 0,
      days_until_due: nextPaymentDue ? daysUntilDue(nextPaymentDue) : null,
    };
  }

  if (!nextPaymentDue) {
    return {
      ...base,
      subscription_active: true,
      reason: 'no_billing_date',
      in_grace_period: false,
      days_past_due: 0,
      days_until_due: null,
    };
  }

  const now = new Date();
  const due = new Date(`${nextPaymentDue}T23:59:59`);
  const graceEnd = new Date(due);
  graceEnd.setDate(graceEnd.getDate() + SUBSCRIPTION_GRACE_DAYS);

  const pastDue = daysPastDue(nextPaymentDue);
  const untilDue = daysUntilDue(nextPaymentDue);
  const inGracePeriod = now > due && now <= graceEnd;

  if (now > graceEnd) {
    return {
      ...base,
      subscription_active: false,
      reason: 'overdue',
      in_grace_period: false,
      days_past_due: pastDue,
      days_until_due: untilDue,
    };
  }

  return {
    ...base,
    subscription_active: true,
    reason: inGracePeriod ? 'grace_period' : 'current',
    in_grace_period: inGracePeriod,
    days_past_due: pastDue,
    days_until_due: untilDue,
  };
}

function daysPastDue(dueDateStr) {
  const due = new Date(`${dueDateStr}T23:59:59`);
  const now = new Date();
  if (now <= due) return 0;
  return Math.floor((now - due) / (1000 * 60 * 60 * 24));
}

function daysUntilDue(dueDateStr) {
  const due = new Date(`${dueDateStr}T23:59:59`);
  const now = new Date();
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  return diff;
}
