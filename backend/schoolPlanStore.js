import { randomBytes } from 'crypto';
import { supabase } from './supabaseClient.js';

const SCHOOL_EXTRA_FIELDS = [
  'payment_plan',
  'plan_status',
  'plan_selected_at',
  'initial_password',
  'logo_url',
  'scanner_token',
  'next_payment_due',
  'last_payment_at',
  'subscription_frozen',
  'subscription_started_at',
  'total_paid',
];

const cache = new Map();

const isMissingColumnError = (error, column) => {
  const msg = String(error?.message || error?.details || error?.hint || '');
  return (
    msg.includes(column) &&
    (msg.includes('does not exist') ||
      msg.includes('Could not find') ||
      msg.includes('schema cache') ||
      error?.code === 'PGRST204')
  );
};

const toDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return null;
  }
};

const normalizeExtras = (row = {}) => ({
  school_id: row.id || row.school_id,
  payment_plan: row.payment_plan || null,
  plan_status: row.plan_status || null,
  plan_selected_at: row.plan_selected_at || null,
  initial_password: row.initial_password || null,
  logo_url: row.logo_url || null,
  scanner_token: row.scanner_token || null,
  next_payment_due: toDateOnly(row.next_payment_due),
  last_payment_at: toDateOnly(row.last_payment_at),
  subscription_frozen: Boolean(row.subscription_frozen),
  subscription_started_at: toDateOnly(row.subscription_started_at),
  total_paid: Number(row.total_paid) || 0,
  payment_records: Array.isArray(row.payment_records) ? row.payment_records : [],
});

async function updateSchoolColumns(schoolId, updates) {
  const payload = { ...updates };
  const optional = [...SCHOOL_EXTRA_FIELDS];

  for (let attempt = 0; attempt <= optional.length; attempt++) {
    const { data, error } = await supabase
      .from('schools')
      .update(payload)
      .eq('id', schoolId)
      .select('*')
      .maybeSingle();

    if (!error) {
      return { data, error: null };
    }

    const missingColumn = optional.find(
      (column) => payload[column] !== undefined && isMissingColumnError(error, column)
    );

    if (missingColumn) {
      delete payload[missingColumn];
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: { message: 'Failed to update school subscription fields' } };
}

async function loadPaymentRecords(schoolId) {
  const { data, error } = await supabase
    .from('subscription_payments')
    .select('amount, plan, plan_name, created_at, status')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingColumnError(error, 'subscription_payments') || error.code === '42P01') {
      return [];
    }
    console.warn('Failed to load subscription payments:', error.message);
    return [];
  }

  return (data || []).map((row) => ({
    amount: Number(row.amount) || 0,
    plan_id: row.plan || null,
    plan_name: row.plan_name || row.plan || null,
    recorded_at: row.created_at,
    status: row.status || 'approved',
  }));
}

export async function initSchoolPlanStore() {
  cache.clear();

  // On Vercel, skip preloading every school into memory — that made cold starts slow.
  // Plan fields are read from the schools row (and filled into cache on demand).
  if (process.env.VERCEL) {
    return;
  }

  const { data: schools, error } = await supabase.from('schools').select('*');
  if (error) {
    throw new Error(`School plan store init failed: ${error.message}`);
  }

  const { data: payments, error: payError } = await supabase
    .from('subscription_payments')
    .select('school_id, amount, plan, plan_name, created_at, status')
    .order('created_at', { ascending: false });

  if (payError && !(isMissingColumnError(payError, 'subscription_payments') || payError.code === '42P01')) {
    console.warn('subscription_payments unavailable:', payError.message);
  }

  const paymentsBySchool = new Map();
  for (const row of payments || []) {
    const list = paymentsBySchool.get(row.school_id) || [];
    list.push({
      amount: Number(row.amount) || 0,
      plan_id: row.plan || null,
      plan_name: row.plan_name || row.plan || null,
      recorded_at: row.created_at,
      status: row.status || 'approved',
    });
    paymentsBySchool.set(row.school_id, list);
  }

  for (const school of schools || []) {
    const extras = normalizeExtras(school);
    extras.payment_records = paymentsBySchool.get(school.id) || [];
    cache.set(school.id, extras);
  }
}

export function parsePaymentRecords(extras) {
  if (!extras?.payment_records) return [];
  if (Array.isArray(extras.payment_records)) return extras.payment_records;
  try {
    const records = JSON.parse(extras.payment_records);
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

export function getSchoolExtrasSync(schoolId) {
  return cache.get(schoolId) || null;
}

export function mergeSchoolWithExtras(school) {
  if (!school) return school;

  const extras = getSchoolExtrasSync(school.id) || {};
  const paymentPlan = school.payment_plan || extras.payment_plan || null;

  return {
    ...school,
    payment_plan: paymentPlan,
    plan_status: school.plan_status || extras.plan_status || (paymentPlan ? 'pending' : null),
    plan_selected_at: school.plan_selected_at || extras.plan_selected_at || null,
    initial_password: school.initial_password || extras.initial_password || null,
    logo_url: school.logo_url || extras.logo_url || null,
    scanner_token: school.scanner_token || extras.scanner_token || null,
    next_payment_due: toDateOnly(school.next_payment_due || extras.next_payment_due),
    last_payment_at: toDateOnly(school.last_payment_at || extras.last_payment_at),
    subscription_frozen: Boolean(
      school.subscription_frozen !== undefined && school.subscription_frozen !== null
        ? school.subscription_frozen
        : extras.subscription_frozen
    ),
    subscription_started_at: toDateOnly(
      school.subscription_started_at || extras.subscription_started_at
    ),
    total_paid: Number(school.total_paid ?? extras.total_paid) || 0,
    payment_records: parsePaymentRecords(extras),
  };
}

export async function upsertSchoolExtras(schoolId, extras) {
  const existing = cache.get(schoolId) || { school_id: schoolId, payment_records: [] };

  const merged = {
    school_id: schoolId,
    payment_plan: extras.payment_plan !== undefined ? extras.payment_plan : existing.payment_plan || null,
    plan_status: extras.plan_status !== undefined ? extras.plan_status : existing.plan_status || null,
    plan_selected_at:
      extras.plan_selected_at !== undefined ? extras.plan_selected_at : existing.plan_selected_at || null,
    initial_password:
      extras.initial_password !== undefined ? extras.initial_password : existing.initial_password || null,
    logo_url: extras.logo_url !== undefined ? extras.logo_url : existing.logo_url || null,
    scanner_token:
      extras.scanner_token !== undefined ? extras.scanner_token : existing.scanner_token || null,
    next_payment_due:
      extras.next_payment_due !== undefined
        ? toDateOnly(extras.next_payment_due)
        : existing.next_payment_due || null,
    last_payment_at:
      extras.last_payment_at !== undefined
        ? toDateOnly(extras.last_payment_at)
        : existing.last_payment_at || null,
    subscription_frozen:
      extras.subscription_frozen !== undefined
        ? Boolean(extras.subscription_frozen)
        : Boolean(existing.subscription_frozen),
    subscription_started_at:
      extras.subscription_started_at !== undefined
        ? toDateOnly(extras.subscription_started_at)
        : existing.subscription_started_at || null,
    total_paid:
      extras.total_paid !== undefined ? Number(extras.total_paid) : Number(existing.total_paid) || 0,
    payment_records: existing.payment_records || [],
  };

  const schoolUpdate = {
    payment_plan: merged.payment_plan,
    plan_status: merged.plan_status,
    plan_selected_at: merged.plan_selected_at,
    initial_password: merged.initial_password,
    logo_url: merged.logo_url,
    scanner_token: merged.scanner_token,
    next_payment_due: merged.next_payment_due,
    last_payment_at: merged.last_payment_at,
    subscription_frozen: merged.subscription_frozen,
    subscription_started_at: merged.subscription_started_at,
    total_paid: merged.total_paid,
  };

  const { data, error } = await updateSchoolColumns(schoolId, schoolUpdate);
  if (error) {
    // Keep serving plan/subscription fields from memory when Supabase schema/RLS
    // cannot store them yet (missing columns or blocked updates).
    console.warn(
      'School extras DB update failed; using in-memory cache until SQL migrations are applied:',
      error.message || error
    );
  } else if (!data) {
    console.warn(
      'School extras DB update returned no row (often RLS). Using in-memory cache; run database/supabase_backend_access.sql or set SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  // Optional: append a payment history row when caller passes serialized records
  if (extras.payment_records !== undefined) {
    let records = extras.payment_records;
    if (typeof records === 'string') {
      try {
        records = JSON.parse(records);
      } catch {
        records = [];
      }
    }
    if (Array.isArray(records) && records.length) {
      const newest = records[0];
      const alreadyCached = (existing.payment_records || []).some(
        (r) => r.recorded_at === newest.recorded_at && Number(r.amount) === Number(newest.amount)
      );
      if (!alreadyCached && newest) {
        const { error: payError } = await supabase.from('subscription_payments').insert([
          {
            school_id: schoolId,
            plan: newest.plan_id || merged.payment_plan,
            plan_name: newest.plan_name || null,
            amount: Number(newest.amount) || 0,
            currency: 'GHS',
            status: 'approved',
            created_at: newest.recorded_at || new Date().toISOString(),
            approved_at: newest.recorded_at || new Date().toISOString(),
          },
        ]);
        if (payError && !(isMissingColumnError(payError, 'subscription_payments') || payError.code === '42P01')) {
          console.warn('Failed to insert subscription payment:', payError.message);
        }
      }
      merged.payment_records = records;
    }
  } else {
    merged.payment_records = await loadPaymentRecords(schoolId);
  }

  cache.set(schoolId, merged);
  return merged;
}

export async function deleteSchoolExtras(schoolId) {
  cache.delete(schoolId);
}

function createScannerToken() {
  return randomBytes(24).toString('hex');
}

export function getScannerTokenSync(schoolId) {
  return getSchoolExtrasSync(schoolId)?.scanner_token || null;
}

export async function getSchoolIdByScannerToken(token) {
  if (!token) return null;

  const { data, error } = await supabase
    .from('schools')
    .select('id')
    .eq('scanner_token', token)
    .maybeSingle();

  if (error) {
    console.warn('Scanner token lookup failed:', error.message);
    return null;
  }

  return data?.id || null;
}

export async function ensureScannerToken(schoolId) {
  const existing = getScannerTokenSync(schoolId);
  if (existing) return existing;

  const token = createScannerToken();
  await upsertSchoolExtras(schoolId, { scanner_token: token });
  return token;
}

export async function regenerateScannerToken(schoolId) {
  const token = createScannerToken();
  await upsertSchoolExtras(schoolId, { scanner_token: token });
  return token;
}
