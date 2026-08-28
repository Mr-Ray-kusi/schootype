import { randomUUID } from 'crypto';
import { supabase } from './supabaseClient.js';

const MEMORY_CAP = 8000;
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const SLOW_PAGE_MS = 3000;
const LOOKBACK_DAYS = 14;
const FETCH_LIMIT = 20000;

const CLIENT_EVENT_TYPES = new Set(['heartbeat', 'page_view', 'page_slow']);
const SERVER_EVENT_TYPES = new Set([
  'login',
  'login_failed',
  'signup',
  'payment_failed',
  'payment_success',
  'sms_sent',
]);

const memoryEvents = [];
let tableReady = false;
let tableChecked = false;

function isMissingTableError(error) {
  const msg = String(error?.message || error?.details || error?.hint || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    msg.includes('platform_events') ||
    msg.includes('does not exist') ||
    msg.includes('could not find')
  );
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date = new Date()) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function trimText(value, max = 180) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.slice(0, max);
}

function normalizePath(path) {
  const raw = String(path || '').split('?')[0].split('#')[0];
  if (!raw) return '/';
  const cleaned = raw.replace(/\/{2,}/g, '/');
  return cleaned.length > 160 ? cleaned.slice(0, 160) : cleaned;
}

export function pageLabel(path) {
  const p = normalizePath(path).toLowerCase();
  if (p === '/' || p === '/login' || p === '/signup') return 'Public';
  if (p.startsWith('/attendance')) return 'Attendance';
  if (p.startsWith('/fees-paid') || p.startsWith('/fees-unpaid') || p.startsWith('/fees')) return 'Fees';
  if (p.startsWith('/report-cards')) return 'Reports';
  if (p.startsWith('/students') || p.startsWith('/add-student')) return 'Students';
  if (p.startsWith('/staff')) return 'Staff';
  if (p.startsWith('/non-staff')) return 'Non-staff';
  if (p.startsWith('/scanner')) return 'Scanner';
  if (p.startsWith('/messages')) return 'Messages';
  if (p.startsWith('/classes')) return 'Setup';
  if (p.startsWith('/dashboard')) return 'Dashboard';
  if (p.startsWith('/school-wallet') || p.startsWith('/super-admin/platform-wallet')) return 'Wallet';
  if (p.startsWith('/bank-settings')) return 'Bank settings';
  if (p.startsWith('/notifications')) return 'Notifications';
  if (p.startsWith('/super-admin/analytics')) return 'Platform analytics';
  if (p.startsWith('/super-admin/monitor')) return 'Monitoring';
  if (p.startsWith('/super-admin')) return 'Platform admin';
  return p;
}

function remember(event) {
  memoryEvents.push(event);
  if (memoryEvents.length > MEMORY_CAP) {
    memoryEvents.splice(0, memoryEvents.length - MEMORY_CAP);
  }
}

function toRow(input) {
  const type = String(input.eventType || input.event_type || '').trim();
  if (!type) return null;
  const duration = Number(input.durationMs ?? input.duration_ms);
  return {
    id: input.id || randomUUID(),
    school_id: input.schoolId || input.school_id || null,
    school_name: trimText(input.schoolName || input.school_name, 120),
    email: trimText(input.email, 160)?.toLowerCase() || null,
    role: trimText(input.role, 40),
    event_type: type,
    path: input.path ? normalizePath(input.path) : null,
    duration_ms: Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : null,
    meta: input.meta && typeof input.meta === 'object' ? input.meta : null,
    created_at: input.createdAt || input.created_at || new Date().toISOString(),
  };
}

export async function initPlatformTelemetry() {
  if (!supabase || tableChecked) return tableReady;
  tableChecked = true;
  try {
    const { error } = await supabase.from('platform_events').select('id').limit(1);
    if (error) {
      if (isMissingTableError(error)) {
        console.warn(
          'platform_events table is missing. Super-admin analytics will use in-memory events until you run backend/migrations/add_platform_events.sql (also in database/migrations.sql).'
        );
        tableReady = false;
        return false;
      }
      console.warn('platform_events probe failed:', error.message || error);
      tableReady = false;
      return false;
    }
    tableReady = true;
    return true;
  } catch (err) {
    console.warn('platform telemetry init failed:', err.message || err);
    tableReady = false;
    return false;
  }
}

export async function recordPlatformEvent(input) {
  const row = toRow(input);
  if (!row) return null;
  remember(row);

  if (!supabase) return row;
  if (!tableChecked) await initPlatformTelemetry();
  if (!tableReady) return row;

  try {
    const { error } = await supabase.from('platform_events').insert([row]);
    if (error) {
      if (isMissingTableError(error)) {
        tableReady = false;
        return row;
      }
      console.warn('Failed to persist platform event:', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to persist platform event:', err.message || err);
  }
  return row;
}

export function recordClientEvents(user, events) {
  if (String(user?.role || '').toLowerCase() === 'super_admin') {
    return Promise.resolve([]);
  }
  const list = Array.isArray(events) ? events : [events];
  const accepted = [];
  for (const raw of list.slice(0, 20)) {
    const type = String(raw?.type || raw?.eventType || raw?.event_type || '').trim();
    if (!CLIENT_EVENT_TYPES.has(type)) continue;
    const duration = Number(raw.durationMs ?? raw.duration_ms);
    if (type === 'page_slow' && Number.isFinite(duration) && duration < SLOW_PAGE_MS) {
      continue;
    }
    accepted.push(
      recordPlatformEvent({
        schoolId: user?.schoolId || null,
        schoolName: raw.schoolName || raw.school_name || null,
        email: user?.email || null,
        role: user?.role || null,
        eventType: type,
        path: raw.path,
        durationMs: duration,
        meta: raw.meta || null,
      })
    );
  }
  return Promise.all(accepted);
}

function isSchoolUsageEvent(event) {
  const role = String(event?.role || '').toLowerCase();
  if (role === 'super_admin') return false;
  const path = String(event?.path || '');
  if (path.startsWith('/super-admin')) return false;
  return true;
}

async function loadEventsSince(since) {
  const sinceMs = since.getTime();
  const fromMemory = memoryEvents.filter((event) => new Date(event.created_at).getTime() >= sinceMs);

  if (!supabase) return fromMemory;
  if (!tableChecked) await initPlatformTelemetry();
  if (!tableReady) return fromMemory;

  try {
    const { data, error } = await supabase
      .from('platform_events')
      .select('id, school_id, school_name, email, role, event_type, path, duration_ms, meta, created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT);

    if (error) {
      if (isMissingTableError(error)) tableReady = false;
      return fromMemory;
    }

    const byId = new Map();
    for (const event of data || []) byId.set(event.id, event);
    for (const event of fromMemory) {
      if (!byId.has(event.id)) byId.set(event.id, event);
    }
    return [...byId.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch {
    return fromMemory;
  }
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const current = map.get(key) || { key, count: 0, sample: item };
    current.count += 1;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function uniqueActiveUsers(events, now = Date.now()) {
  const cutoff = now - ACTIVE_WINDOW_MS;
  const byPerson = new Map();
  for (const event of events) {
    if (event.event_type !== 'heartbeat' && event.event_type !== 'page_view' && event.event_type !== 'login') {
      continue;
    }
    const at = new Date(event.created_at).getTime();
    if (at < cutoff) continue;
    const key = `${event.school_id || ''}|${event.email || event.role || event.id}`;
    const existing = byPerson.get(key);
    if (!existing || at > new Date(existing.lastSeen).getTime()) {
      byPerson.set(key, {
        schoolId: event.school_id,
        schoolName: event.school_name || (event.role === 'super_admin' ? 'Platform admin' : 'Unknown school'),
        email: event.email,
        role: event.role,
        path: event.path,
        page: pageLabel(event.path),
        lastSeen: event.created_at,
      });
    }
  }
  return [...byPerson.values()].sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

function loginAdoption(events, dayStart, weekStart) {
  const logins = events.filter((event) => event.event_type === 'login');
  const bySchool = new Map();
  for (const event of logins) {
    const key = event.school_id || event.email || event.school_name || 'unknown';
    const current = bySchool.get(key) || {
      schoolId: event.school_id,
      schoolName: event.school_name || event.email || 'Unknown school',
      email: event.email,
      daily: 0,
      weekly: 0,
    };
    const at = new Date(event.created_at);
    if (at >= weekStart) current.weekly += 1;
    if (at >= dayStart) current.daily += 1;
    bySchool.set(key, current);
  }
  return [...bySchool.values()]
    .filter((row) => row.weekly > 0)
    .sort((a, b) => b.daily - a.daily || b.weekly - a.weekly);
}

function eventLabel(event) {
  switch (event.event_type) {
    case 'login':
      return 'Signed in';
    case 'login_failed':
      return 'Failed login';
    case 'signup':
      return 'New school signed up';
    case 'payment_failed':
      return 'Payment failed';
    case 'payment_success':
      return 'Payment succeeded';
    case 'sms_sent':
      return 'SMS sent';
    case 'page_slow':
      return 'Slow page';
    case 'page_view':
      return `Visited ${pageLabel(event.path)}`;
    default:
      return event.event_type;
  }
}

async function safeCount(table, filters = {}) {
  if (!supabase) return 0;
  try {
    let query = supabase.from(table).select('id', { count: 'exact', head: true });
    if (filters.gte) query = query.gte(filters.gte.column, filters.gte.value);
    if (filters.eq) query = query.eq(filters.eq.column, filters.eq.value);
    const { count, error } = await query;
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

async function feesCollectedToday(dayStartIso) {
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase
      .from('fee_payments')
      .select('amount')
      .gte('created_at', dayStartIso)
      .limit(5000);
    if (error) return 0;
    return (data || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  } catch {
    return 0;
  }
}

async function newSchoolsSince(sinceIso) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, email, role, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return [];
    return (data || []).filter((school) => school.role !== 'super_admin');
  } catch {
    return [];
  }
}

export async function getPlatformAnalytics() {
  const now = new Date();
  const dayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const lookback = daysAgo(LOOKBACK_DAYS);
  const events = (await loadEventsSince(lookback)).filter(isSchoolUsageEvent);

  const inRange = (type, since) =>
    events.filter((event) => event.event_type === type && new Date(event.created_at) >= since);

  const pageViews = inRange('page_view', weekStart);
  const slowPages = inRange('page_slow', weekStart);
  const failedLoginsToday = inRange('login_failed', dayStart);
  const failedLoginsWeek = inRange('login_failed', weekStart);
  const failedPaymentsToday = inRange('payment_failed', dayStart);
  const failedPaymentsWeek = inRange('payment_failed', weekStart);
  const smsEventsToday = inRange('sms_sent', dayStart);
  const smsFromEvents = smsEventsToday.reduce((sum, event) => {
    const count = Number(event.meta?.count);
    return sum + (Number.isFinite(count) && count > 0 ? count : 1);
  }, 0);

  const [totalStudents, smsFromMessages, feesToday, recentSchools] = await Promise.all([
    safeCount('students'),
    safeCount('messages', {
      gte: { column: 'created_at', value: dayStart.toISOString() },
      eq: { column: 'delivery_channel', value: 'sms' },
    }),
    feesCollectedToday(dayStart.toISOString()),
    newSchoolsSince(weekStart.toISOString()),
  ]);

  const signupEvents = inRange('signup', weekStart);
  const newUsers = [];
  const seen = new Set();
  for (const school of recentSchools) {
    seen.add(school.email || school.id);
    newUsers.push({
      schoolId: school.id,
      schoolName: school.name,
      email: school.email,
      createdAt: school.created_at,
      source: 'school_record',
    });
  }
  for (const event of signupEvents) {
    const key = event.email || event.school_id;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    newUsers.push({
      schoolId: event.school_id,
      schoolName: event.school_name,
      email: event.email,
      createdAt: event.created_at,
      source: 'signup',
    });
  }

  const keyTypes = new Set(['login', 'login_failed', 'signup', 'payment_failed', 'payment_success', 'sms_sent', 'page_slow']);
  const keyEvents = events
    .filter((event) => keyTypes.has(event.event_type))
    .slice(0, 40)
    .map((event) => ({
      id: event.id,
      type: event.event_type,
      label: eventLabel(event),
      schoolName: event.school_name,
      email: event.email,
      path: event.path,
      page: pageLabel(event.path),
      durationMs: event.duration_ms,
      createdAt: event.created_at,
    }));

  const topPages = countBy(pageViews, (event) => pageLabel(event.path)).slice(0, 12).map((row) => ({
    page: row.key,
    count: row.count,
    path: row.sample.path,
  }));

  const slowPageRows = countBy(slowPages, (event) => pageLabel(event.path) || event.path).slice(0, 10).map((row) => {
    const matching = slowPages.filter((event) => pageLabel(event.path) === row.key);
    const avg = matching.reduce((sum, event) => sum + (Number(event.duration_ms) || 0), 0) / (matching.length || 1);
    return {
      page: row.key,
      count: row.count,
      avgMs: Math.round(avg),
      path: row.sample.path,
    };
  });

  return {
    generatedAt: now.toISOString(),
    tableReady,
    activeWindowMinutes: 5,
    slowPageMs: SLOW_PAGE_MS,
    activeUsers: uniqueActiveUsers(events, now.getTime()),
    eventCounts: {
      loginsToday: inRange('login', dayStart).length,
      loginsThisWeek: inRange('login', weekStart).length,
      pageViewsToday: inRange('page_view', dayStart).length,
      pageViewsThisWeek: pageViews.length,
      heartbeatsToday: inRange('heartbeat', dayStart).length,
    },
    loginsBySchool: loginAdoption(events, dayStart, weekStart),
    topPages,
    slowPages: slowPageRows,
    errors: {
      failedLoginsToday: failedLoginsToday.length,
      failedLoginsThisWeek: failedLoginsWeek.length,
      failedPaymentsToday: failedPaymentsToday.length,
      failedPaymentsThisWeek: failedPaymentsWeek.length,
      recent: [...failedLoginsWeek, ...failedPaymentsWeek]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 20)
        .map((event) => ({
          id: event.id,
          type: event.event_type,
          label: eventLabel(event),
          email: event.email,
          schoolName: event.school_name,
          createdAt: event.created_at,
        })),
    },
    dataStats: {
      totalStudents,
      feesCollectedToday: feesToday,
      smsSentToday: Math.max(smsFromEvents, smsFromMessages),
    },
    keyEvents,
    newUsers: newUsers.slice(0, 30),
  };
}

export { CLIENT_EVENT_TYPES, SERVER_EVENT_TYPES, SLOW_PAGE_MS };
