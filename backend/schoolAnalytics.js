import { supabase } from './supabaseClient.js';
import { resolveFeePeriod } from './academicTerms.js';
import { isSuccessfulFeeStatus, resolveStudentFeeAmount, roundMoney } from './feePayments.js';
import {
  analyticsRangeWindow,
  enumerateBuckets,
  normalizeAnalyticsRange,
  startOfUnit,
} from './platformTelemetry.js';

const safeQuery = async (fn, fallback) => {
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

const toPoints = (buckets, map) =>
  buckets.map((bucket) => ({
    t: bucket.t,
    label: bucket.label,
    value: map.get(bucket.t) || 0,
  }));

const bump = (map, key, amount = 1) => {
  map.set(key, (map.get(key) || 0) + amount);
};

export async function getSchoolAnalytics(schoolId, options = {}) {
  const now = new Date();
  const range = normalizeAnalyticsRange(options.range);
  const { start, unit } = analyticsRangeWindow(range, now);
  const buckets = enumerateBuckets(start, now, unit);
  const known = new Set(buckets.map((bucket) => bucket.t));
  const sinceIso = start.toISOString();

  const [attendanceRes, paymentsRes, messagesRes, studentsRes, classesRes, eventsRes] = await Promise.all([
    safeQuery(
      () =>
        supabase
          .from('attendance')
          .select('id, date, timestamp, user_name, user_type')
          .eq('school_id', schoolId)
          .gte('date', sinceIso.slice(0, 10))
          .order('timestamp', { ascending: false })
          .limit(8000),
      { data: [] }
    ),
    safeQuery(
      () =>
        supabase
          .from('fee_payments')
          .select('id, amount, status, payer_id, payer_name, payment_method, channel, payment_month, created_at')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(8000),
      { data: [] }
    ),
    safeQuery(
      () =>
        supabase
          .from('messages')
          .select('id, delivery_channel, created_at, recipients, sender_name')
          .eq('school_id', schoolId)
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(4000),
      { data: [] }
    ),
    safeQuery(
      () => supabase.from('students').select('id, name, class, monthly_fee').eq('school_id', schoolId),
      { data: [] }
    ),
    safeQuery(
      () => supabase.from('classes').select('name, fee_amount').eq('school_id', schoolId),
      { data: [] }
    ),
    safeQuery(
      () =>
        supabase
          .from('platform_events')
          .select('id, event_type, meta, created_at')
          .eq('school_id', schoolId)
          .eq('event_type', 'sms_sent')
          .gte('created_at', sinceIso)
          .limit(4000),
      { data: [] }
    ),
  ]);

  const attendance = attendanceRes.data || [];
  const payments = paymentsRes.data || [];
  const messages = messagesRes.data || [];
  const students = studentsRes.data || [];
  const classes = classesRes.data || [];
  const smsEvents = eventsRes.data || [];

  const attendanceMap = new Map();
  const feesPaidMap = new Map();
  const smsSentMap = new Map();
  const smsDeliveredMap = new Map();

  for (const row of attendance) {
    const at = new Date(row.timestamp || `${row.date}T12:00:00`);
    if (Number.isNaN(at.getTime()) || at < start) continue;
    const key = startOfUnit(at, unit).toISOString();
    if (!known.has(key)) continue;
    bump(attendanceMap, key);
  }

  const successfulPayments = payments.filter((row) => isSuccessfulFeeStatus(row.status));
  for (const row of successfulPayments) {
    const at = new Date(row.created_at);
    if (Number.isNaN(at.getTime()) || at < start) continue;
    const key = startOfUnit(at, unit).toISOString();
    if (!known.has(key)) continue;
    bump(feesPaidMap, key, Number(row.amount) || 0);
  }

  const smsMessages = messages.filter((row) => String(row.delivery_channel || 'sms') !== 'email');
  for (const row of smsMessages) {
    const at = new Date(row.created_at);
    if (Number.isNaN(at.getTime()) || at < start) continue;
    const key = startOfUnit(at, unit).toISOString();
    if (!known.has(key)) continue;
    bump(smsSentMap, key);
  }

  for (const event of smsEvents) {
    const at = new Date(event.created_at);
    if (Number.isNaN(at.getTime()) || at < start) continue;
    const key = startOfUnit(at, unit).toISOString();
    if (!known.has(key)) continue;
    const delivered = Number(event.meta?.delivered ?? event.meta?.count);
    bump(smsDeliveredMap, key, Number.isFinite(delivered) && delivered > 0 ? delivered : 1);
  }

  if (![...smsDeliveredMap.values()].some((value) => value > 0)) {
    for (const [key, value] of smsSentMap.entries()) {
      smsDeliveredMap.set(key, value);
    }
  }

  const classFeeByName = new Map((classes || []).map((row) => [row.name, Number(row.fee_amount) || 0]));
  let periodKey = null;
  try {
    const period = await resolveFeePeriod(schoolId);
    periodKey = period?.key || null;
  } catch {
    periodKey = null;
  }

  const totalBilled = (students || []).reduce((sum, student) => {
    return sum + resolveStudentFeeAmount(student, classFeeByName.get(student.class) || 0);
  }, 0);

  const termPayments = successfulPayments.filter((row) => !periodKey || row.payment_month === periodKey);
  const unpaidMap = new Map();
  for (const bucket of buckets) {
    const end = new Date(bucket.t);
    const paidSoFar = termPayments
      .filter((row) => new Date(row.created_at) <= end)
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    unpaidMap.set(bucket.t, roundMoney(Math.max(0, totalBilled - paidSoFar)));
  }

  const feesPaidInRange = successfulPayments
    .filter((row) => new Date(row.created_at) >= start)
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const feesUnpaidNow = unpaidMap.get(buckets[buckets.length - 1]?.t) || 0;
  const attendanceInRange = attendance.filter((row) => {
    const at = new Date(row.timestamp || `${row.date}T12:00:00`);
    return !Number.isNaN(at.getTime()) && at >= start;
  }).length;

  const unpaidStudents = (students || [])
    .map((student) => {
      const feeAmount = resolveStudentFeeAmount(student, classFeeByName.get(student.class) || 0);
      const paid = termPayments
        .filter((row) => row.payer_id === student.id)
        .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      return {
        id: student.id,
        name: student.name,
        className: student.class,
        outstanding: roundMoney(Math.max(0, feeAmount - paid)),
      };
    })
    .filter((row) => row.outstanding >= 0.01)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 12);

  return {
    generatedAt: now.toISOString(),
    range,
    unit,
    start: sinceIso,
    totals: {
      attendanceInRange,
      feesPaidInRange: roundMoney(feesPaidInRange),
      feesUnpaidNow: roundMoney(feesUnpaidNow),
      smsSentInRange: smsMessages.length,
      smsDeliveredInRange: [...smsDeliveredMap.values()].reduce((sum, value) => sum + value, 0),
    },
    chart: {
      range,
      unit,
      series: {
        attendance: toPoints(buckets, attendanceMap),
        feesPaid: toPoints(buckets, feesPaidMap).map((point) => ({ ...point, value: roundMoney(point.value) })),
        feesUnpaid: toPoints(buckets, unpaidMap),
        smsSent: toPoints(buckets, smsSentMap),
        smsDelivered: toPoints(buckets, smsDeliveredMap),
      },
    },
    previews: {
      attendance: attendance.slice(0, 12).map((row) => ({
        id: row.id,
        name: row.user_name || 'Marked',
        type: row.user_type,
        createdAt: row.timestamp || row.date,
      })),
      feesPaid: successfulPayments
        .filter((row) => new Date(row.created_at) >= start)
        .slice(0, 12)
        .map((row) => ({
          id: row.id,
          name: row.payer_name || 'Fee payment',
          amount: roundMoney(row.amount),
          method: row.channel || row.payment_method || 'Paystack',
          createdAt: row.created_at,
        })),
      feesUnpaid: unpaidStudents,
      smsSent: smsMessages.slice(0, 12).map((row) => ({
        id: row.id,
        name: row.sender_name || 'SMS',
        recipients: row.recipients,
        createdAt: row.created_at,
      })),
      smsDelivered: smsEvents.slice(0, 12).map((row) => ({
        id: row.id,
        count: Number(row.meta?.delivered ?? row.meta?.count) || 1,
        createdAt: row.created_at,
      })),
    },
  };
}
