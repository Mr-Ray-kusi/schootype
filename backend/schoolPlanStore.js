import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { randomBytes } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'school-extras.db');

const OPTIONAL_COLUMNS = [
  'scanner_token',
  'next_payment_due',
  'last_payment_at',
  'subscription_frozen',
  'subscription_started_at',
  'total_paid',
  'payment_records',
];

let dbPromise = null;
const cache = new Map();

async function getDb() {
  if (!dbPromise) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    dbPromise = open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS school_extras (
          school_id TEXT PRIMARY KEY,
          payment_plan TEXT,
          plan_status TEXT,
          plan_selected_at TEXT,
          initial_password TEXT,
          logo_url TEXT,
          scanner_token TEXT,
          next_payment_due TEXT,
          last_payment_at TEXT,
          subscription_frozen INTEGER DEFAULT 0,
          subscription_started_at TEXT,
          total_paid REAL DEFAULT 0,
          payment_records TEXT
        )
      `);
      for (const column of OPTIONAL_COLUMNS) {
        try {
          if (column === 'subscription_frozen') {
            await db.exec(`ALTER TABLE school_extras ADD COLUMN subscription_frozen INTEGER DEFAULT 0`);
          } else if (column === 'total_paid') {
            await db.exec(`ALTER TABLE school_extras ADD COLUMN total_paid REAL DEFAULT 0`);
          } else {
            await db.exec(`ALTER TABLE school_extras ADD COLUMN ${column} TEXT`);
          }
        } catch {
          // column already exists
        }
      }
      return db;
    });
  }
  return dbPromise;
}

export async function initSchoolPlanStore() {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM school_extras');
  cache.clear();
  rows.forEach((row) => cache.set(row.school_id, row));
}

export function parsePaymentRecords(extras) {
  if (!extras?.payment_records) return [];
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

  const extras = getSchoolExtrasSync(school.id);
  if (!extras) return school;

  const paymentPlan = school.payment_plan || extras.payment_plan || null;

  return {
    ...school,
    payment_plan: paymentPlan,
    plan_status: school.plan_status || extras.plan_status || (paymentPlan ? 'pending' : null),
    plan_selected_at: school.plan_selected_at || extras.plan_selected_at || null,
    initial_password: school.initial_password || extras.initial_password || null,
    logo_url: school.logo_url || extras.logo_url || null,
    scanner_token: extras.scanner_token || null,
    next_payment_due: extras.next_payment_due || null,
    last_payment_at: extras.last_payment_at || null,
    subscription_frozen: extras.subscription_frozen === 1,
    subscription_started_at: extras.subscription_started_at || null,
    total_paid: Number(extras.total_paid) || 0,
    payment_records: parsePaymentRecords(extras),
  };
}

export async function upsertSchoolExtras(schoolId, extras) {
  const db = await getDb();
  const existing = cache.get(schoolId) || {};

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
      extras.next_payment_due !== undefined ? extras.next_payment_due : existing.next_payment_due || null,
    last_payment_at:
      extras.last_payment_at !== undefined ? extras.last_payment_at : existing.last_payment_at || null,
    subscription_frozen:
      extras.subscription_frozen !== undefined
        ? extras.subscription_frozen
          ? 1
          : 0
        : existing.subscription_frozen || 0,
    subscription_started_at:
      extras.subscription_started_at !== undefined
        ? extras.subscription_started_at
        : existing.subscription_started_at || null,
    total_paid:
      extras.total_paid !== undefined ? Number(extras.total_paid) : Number(existing.total_paid) || 0,
    payment_records:
      extras.payment_records !== undefined
        ? extras.payment_records
        : existing.payment_records || null,
  };

  await db.run(
    `INSERT INTO school_extras (
      school_id, payment_plan, plan_status, plan_selected_at, initial_password,
      logo_url, scanner_token, next_payment_due, last_payment_at, subscription_frozen,
      subscription_started_at, total_paid, payment_records
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(school_id) DO UPDATE SET
      payment_plan = excluded.payment_plan,
      plan_status = excluded.plan_status,
      plan_selected_at = excluded.plan_selected_at,
      initial_password = COALESCE(excluded.initial_password, school_extras.initial_password),
      logo_url = COALESCE(excluded.logo_url, school_extras.logo_url),
      scanner_token = COALESCE(excluded.scanner_token, school_extras.scanner_token),
      next_payment_due = COALESCE(excluded.next_payment_due, school_extras.next_payment_due),
      last_payment_at = COALESCE(excluded.last_payment_at, school_extras.last_payment_at),
      subscription_frozen = excluded.subscription_frozen,
      subscription_started_at = COALESCE(excluded.subscription_started_at, school_extras.subscription_started_at),
      total_paid = COALESCE(excluded.total_paid, school_extras.total_paid),
      payment_records = COALESCE(excluded.payment_records, school_extras.payment_records)`,
    [
      merged.school_id,
      merged.payment_plan,
      merged.plan_status,
      merged.plan_selected_at,
      merged.initial_password,
      merged.logo_url,
      merged.scanner_token,
      merged.next_payment_due,
      merged.last_payment_at,
      merged.subscription_frozen,
      merged.subscription_started_at,
      merged.total_paid,
      merged.payment_records,
    ]
  );

  cache.set(schoolId, merged);
  return merged;
}

export async function deleteSchoolExtras(schoolId) {
  const db = await getDb();
  await db.run('DELETE FROM school_extras WHERE school_id = ?', [schoolId]);
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
  const db = await getDb();
  const row = await db.get('SELECT school_id FROM school_extras WHERE scanner_token = ?', [token]);
  return row?.school_id || null;
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
