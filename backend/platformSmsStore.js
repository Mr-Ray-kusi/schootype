import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'school-extras.db');

const SETTINGS_ID = 'platform';
/** Default: 0.05 GHS per SMS unit (5 pesewas). */
const DEFAULT_UNIT_PRICE_MINOR = 5;

let dbPromise = null;

async function getDb() {
  if (!dbPromise) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    dbPromise = open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS platform_sms_settings (
          id TEXT PRIMARY KEY,
          units_available INTEGER NOT NULL DEFAULT 0,
          unit_price_minor INTEGER NOT NULL DEFAULT ${DEFAULT_UNIT_PRICE_MINOR},
          total_revenue_minor INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS platform_sms_sales (
          id TEXT PRIMARY KEY,
          school_id TEXT NOT NULL,
          school_name TEXT,
          units INTEGER NOT NULL,
          amount_minor INTEGER NOT NULL,
          recipients_count INTEGER NOT NULL,
          segments INTEGER NOT NULL,
          reference TEXT UNIQUE NOT NULL,
          message_preview TEXT,
          sale_type TEXT NOT NULL DEFAULT 'broadcast',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS school_sms_balances (
          school_id TEXT PRIMARY KEY,
          units_available INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_sms_sales_school ON platform_sms_sales(school_id);
        CREATE INDEX IF NOT EXISTS idx_sms_sales_created ON platform_sms_sales(created_at);
      `);

      try {
        await db.exec(`ALTER TABLE platform_sms_sales ADD COLUMN sale_type TEXT NOT NULL DEFAULT 'broadcast'`);
      } catch {
        // column exists
      }

      const existing = await db.get(
        'SELECT id FROM platform_sms_settings WHERE id = ?',
        [SETTINGS_ID]
      );
      if (!existing) {
        await db.run(
          `INSERT INTO platform_sms_settings
            (id, units_available, unit_price_minor, total_revenue_minor, updated_at)
           VALUES (?, 0, ?, 0, ?)`,
          [SETTINGS_ID, DEFAULT_UNIT_PRICE_MINOR, new Date().toISOString()]
        );
      }
      return db;
    });
  }
  return dbPromise;
}

function nowIso() {
  return new Date().toISOString();
}

export async function initPlatformSmsStore() {
  await getDb();
}

export async function getSmsSettings() {
  const db = await getDb();
  const row = await db.get('SELECT * FROM platform_sms_settings WHERE id = ?', [SETTINGS_ID]);
  return {
    units_available: row?.units_available || 0,
    unit_price_minor: row?.unit_price_minor ?? DEFAULT_UNIT_PRICE_MINOR,
    total_revenue_minor: row?.total_revenue_minor || 0,
    updated_at: row?.updated_at || null,
  };
}

export async function setSmsUnitPrice(unitPriceMinor) {
  const db = await getDb();
  const price = Math.max(1, Math.round(Number(unitPriceMinor) || DEFAULT_UNIT_PRICE_MINOR));
  await db.run(
    `UPDATE platform_sms_settings
     SET unit_price_minor = ?, updated_at = ?
     WHERE id = ?`,
    [price, nowIso(), SETTINGS_ID]
  );
  return getSmsSettings();
}

export async function addSmsUnits(units) {
  const db = await getDb();
  const add = Math.max(0, Math.round(Number(units) || 0));
  if (!add) return getSmsSettings();
  await db.run(
    `UPDATE platform_sms_settings
     SET units_available = units_available + ?, updated_at = ?
     WHERE id = ?`,
    [add, nowIso(), SETTINGS_ID]
  );
  return getSmsSettings();
}

/**
 * GSM-ish segment estimate: 160 chars per unit for basic Latin.
 * Longer Unicode messages cost more in reality; keep simple for billing.
 */
export function estimateSmsSegments(message) {
  const text = String(message || '');
  if (!text.length) return 1;
  const hasUnicode = /[^\x00-\x7F]/.test(text);
  const perSegment = hasUnicode ? 70 : 160;
  return Math.max(1, Math.ceil(text.length / perSegment));
}

export function buildSmsQuote({ message, recipientCount, unitPriceMinor }) {
  const recipients = Math.max(0, Math.round(Number(recipientCount) || 0));
  const segments = estimateSmsSegments(message);
  const units = recipients * segments;
  const price = Math.max(1, Math.round(Number(unitPriceMinor) || DEFAULT_UNIT_PRICE_MINOR));
  const amountMinor = units * price;
  return {
    recipients_count: recipients,
    segments,
    units_required: units,
    unit_price_minor: price,
    amount_minor: amountMinor,
  };
}

/**
 * Deduct platform units + record sale. Revenue optional (0 for usage after prepaid purchase).
 */
export async function consumeSmsUnitsAndRecordSale({
  schoolId,
  schoolName,
  units,
  amountMinor,
  recipientsCount,
  segments,
  reference,
  messagePreview,
  saleType = 'broadcast',
  deductPlatformUnits = true,
  addRevenue = true,
}) {
  const db = await getDb();
  const settings = await getSmsSettings();
  if (deductPlatformUnits && settings.units_available < units) {
    const err = new Error(
      `Not enough platform SMS units. Need ${units}, available ${settings.units_available}.`
    );
    err.status = 400;
    err.code = 'SMS_UNITS_INSUFFICIENT';
    throw err;
  }

  const id = randomUUID();
  const createdAt = nowIso();
  const revenueAdd = addRevenue ? amountMinor : 0;

  await db.run('BEGIN');
  try {
    if (deductPlatformUnits || revenueAdd) {
      await db.run(
        `UPDATE platform_sms_settings
         SET units_available = units_available - ?,
             total_revenue_minor = total_revenue_minor + ?,
             updated_at = ?
         WHERE id = ?`,
        [deductPlatformUnits ? units : 0, revenueAdd, createdAt, SETTINGS_ID]
      );
    }
    await db.run(
      `INSERT INTO platform_sms_sales (
        id, school_id, school_name, units, amount_minor, recipients_count,
        segments, reference, message_preview, sale_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        schoolId,
        schoolName || null,
        units,
        amountMinor,
        recipientsCount,
        segments,
        reference,
        messagePreview ? String(messagePreview).slice(0, 120) : null,
        saleType,
        createdAt,
      ]
    );
    await db.run('COMMIT');
  } catch (err) {
    await db.run('ROLLBACK');
    throw err;
  }

  return {
    sale_id: id,
    settings: await getSmsSettings(),
  };
}

export async function getSchoolSmsBalance(schoolId) {
  const db = await getDb();
  const row = await db.get(
    'SELECT * FROM school_sms_balances WHERE school_id = ?',
    [schoolId]
  );
  return {
    school_id: schoolId,
    units_available: row?.units_available || 0,
    updated_at: row?.updated_at || null,
  };
}

export async function ensureSchoolSmsBalance(schoolId) {
  const db = await getDb();
  const existing = await db.get(
    'SELECT school_id FROM school_sms_balances WHERE school_id = ?',
    [schoolId]
  );
  if (!existing) {
    await db.run(
      `INSERT INTO school_sms_balances (school_id, units_available, updated_at) VALUES (?, 0, ?)`,
      [schoolId, nowIso()]
    );
  }
  return getSchoolSmsBalance(schoolId);
}

/**
 * After wallet payment: credit school units + record purchase revenue (platform inventory unchanged until send).
 */
export async function creditSchoolSmsPurchase({
  schoolId,
  schoolName,
  units,
  amountMinor,
  reference,
}) {
  const db = await getDb();
  await ensureSchoolSmsBalance(schoolId);
  const id = randomUUID();
  const createdAt = nowIso();

  await db.run('BEGIN');
  try {
    await db.run(
      `UPDATE school_sms_balances
       SET units_available = units_available + ?, updated_at = ?
       WHERE school_id = ?`,
      [units, createdAt, schoolId]
    );
    await db.run(
      `UPDATE platform_sms_settings
       SET total_revenue_minor = total_revenue_minor + ?, updated_at = ?
       WHERE id = ?`,
      [amountMinor, createdAt, SETTINGS_ID]
    );
    await db.run(
      `INSERT INTO platform_sms_sales (
        id, school_id, school_name, units, amount_minor, recipients_count,
        segments, reference, message_preview, sale_type, created_at
      ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, 'purchase', ?)`,
      [
        id,
        schoolId,
        schoolName || null,
        units,
        amountMinor,
        reference,
        `Purchased ${units} SMS units`,
        createdAt,
      ]
    );
    await db.run('COMMIT');
  } catch (err) {
    await db.run('ROLLBACK');
    throw err;
  }

  return {
    sale_id: id,
    school_balance: await getSchoolSmsBalance(schoolId),
    settings: await getSmsSettings(),
  };
}

/**
 * On send: deduct school prepaid units + platform inventory (no extra money charge).
 */
export async function consumeSchoolAndPlatformUnits({
  schoolId,
  schoolName,
  units,
  recipientsCount,
  segments,
  reference,
  messagePreview,
}) {
  const db = await getDb();
  await ensureSchoolSmsBalance(schoolId);
  const schoolBal = await getSchoolSmsBalance(schoolId);
  const settings = await getSmsSettings();

  if (schoolBal.units_available < units) {
    const err = new Error(
      `Not enough school SMS units. Need ${units}, you have ${schoolBal.units_available}. Convert wallet money to SMS units first.`
    );
    err.status = 400;
    err.code = 'SCHOOL_SMS_INSUFFICIENT';
    throw err;
  }
  if (settings.units_available < units) {
    const err = new Error(
      `Not enough platform SMS units. Need ${units}, available ${settings.units_available}. Contact super admin.`
    );
    err.status = 400;
    err.code = 'SMS_UNITS_INSUFFICIENT';
    throw err;
  }

  const id = randomUUID();
  const createdAt = nowIso();

  await db.run('BEGIN');
  try {
    await db.run(
      `UPDATE school_sms_balances
       SET units_available = units_available - ?, updated_at = ?
       WHERE school_id = ?`,
      [units, createdAt, schoolId]
    );
    await db.run(
      `UPDATE platform_sms_settings
       SET units_available = units_available - ?, updated_at = ?
       WHERE id = ?`,
      [units, createdAt, SETTINGS_ID]
    );
    await db.run(
      `INSERT INTO platform_sms_sales (
        id, school_id, school_name, units, amount_minor, recipients_count,
        segments, reference, message_preview, sale_type, created_at
      ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 'usage', ?)`,
      [
        id,
        schoolId,
        schoolName || null,
        units,
        recipientsCount,
        segments,
        reference,
        messagePreview ? String(messagePreview).slice(0, 120) : null,
        createdAt,
      ]
    );
    await db.run('COMMIT');
  } catch (err) {
    await db.run('ROLLBACK');
    throw err;
  }

  return {
    sale_id: id,
    school_balance: await getSchoolSmsBalance(schoolId),
    settings: await getSmsSettings(),
  };
}

export async function listSmsSales({ limit = 50 } = {}) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM platform_sms_sales ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

export function makeSmsSaleReference(prefix = 'sms') {
  return `${prefix}_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}
