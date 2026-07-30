import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'school-extras.db');

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_PER_EMAIL = 5;
const MAX_FAILED_PER_IP = 30;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
const MAX_SIGNUPS_PER_IP = 5;
const MIN_PASSWORD_LENGTH = 8;

let dbPromise = null;

async function getDb() {
  if (!dbPromise) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    dbPromise = open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS login_failures (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          ip TEXT,
          failed_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS signup_attempts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ip TEXT NOT NULL,
          attempted_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_login_failures_email ON login_failures(email, failed_at);
        CREATE INDEX IF NOT EXISTS idx_login_failures_ip ON login_failures(ip, failed_at);
        CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip ON signup_attempts(ip, attempted_at);
      `);
      return db;
    });
  }
  return dbPromise;
}

export async function initAuthSecurityStore() {
  await getDb();
}

const windowStartIso = (windowMs) => new Date(Date.now() - windowMs).toISOString();

async function pruneOldLoginFailures(db) {
  await db.run('DELETE FROM login_failures WHERE failed_at < ?', [windowStartIso(LOCKOUT_WINDOW_MS * 2)]);
}

async function pruneOldSignupAttempts(db) {
  await db.run('DELETE FROM signup_attempts WHERE attempted_at < ?', [windowStartIso(SIGNUP_WINDOW_MS * 2)]);
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return 'Password is required';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one letter and one number';
  }
  if (password.length > 128) {
    return 'Password is too long';
  }
  return null;
}

export async function checkLoginAllowed(email, ip) {
  const db = await getDb();
  await pruneOldLoginFailures(db);

  const since = windowStartIso(LOCKOUT_WINDOW_MS);
  const normalizedEmail = email?.trim().toLowerCase();

  const emailRow = await db.get(
    `SELECT COUNT(*) AS count, MAX(failed_at) AS last_failed
     FROM login_failures
     WHERE email = ? AND failed_at >= ?`,
    [normalizedEmail, since]
  );

  if ((emailRow?.count || 0) >= MAX_FAILED_PER_EMAIL) {
    const lastFailed = emailRow.last_failed ? new Date(emailRow.last_failed).getTime() : Date.now();
    const unlockAt = lastFailed + LOCKOUT_DURATION_MS;
    const retryAfterSec = Math.max(1, Math.ceil((unlockAt - Date.now()) / 1000));
    return {
      allowed: false,
      retryAfterSec,
      message: `Too many failed login attempts. Try again in ${Math.ceil(retryAfterSec / 60)} minute(s).`,
    };
  }

  if (ip && ip !== 'unknown') {
    const ipRow = await db.get(
      `SELECT COUNT(*) AS count FROM login_failures WHERE ip = ? AND failed_at >= ?`,
      [ip, since]
    );
    if ((ipRow?.count || 0) >= MAX_FAILED_PER_IP) {
      return {
        allowed: false,
        retryAfterSec: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        message: 'Too many login attempts from this network. Please wait before trying again.',
      };
    }
  }

  return { allowed: true };
}

export async function recordLoginFailure(email, ip) {
  const db = await getDb();
  await db.run('INSERT INTO login_failures (email, ip, failed_at) VALUES (?, ?, ?)', [
    email?.trim().toLowerCase(),
    ip || null,
    new Date().toISOString(),
  ]);
}

export async function clearLoginFailures(email) {
  const db = await getDb();
  await db.run('DELETE FROM login_failures WHERE email = ?', [email?.trim().toLowerCase()]);
}

export async function checkSignupAllowed(ip) {
  const db = await getDb();
  await pruneOldSignupAttempts(db);

  if (!ip || ip === 'unknown') {
    return { allowed: true };
  }

  const since = windowStartIso(SIGNUP_WINDOW_MS);
  const row = await db.get(
    `SELECT COUNT(*) AS count FROM signup_attempts WHERE ip = ? AND attempted_at >= ?`,
    [ip, since]
  );

  if ((row?.count || 0) >= MAX_SIGNUPS_PER_IP) {
    return {
      allowed: false,
      message: 'Too many sign-up attempts from this network. Please try again later.',
    };
  }

  return { allowed: true };
}

export async function recordSignupAttempt(ip) {
  const db = await getDb();
  await db.run('INSERT INTO signup_attempts (ip, attempted_at) VALUES (?, ?)', [
    ip || 'unknown',
    new Date().toISOString(),
  ]);
}

export function parseJwtExpiresInSeconds(value) {
  const raw = String(value || '24h').trim();
  const match = /^(\d+)\s*([smhd])?$/i.exec(raw);
  if (!match) return 24 * 60 * 60;
  const amount = parseInt(match[1], 10);
  const unit = (match[2] || 's').toLowerCase();
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * (multipliers[unit] || 1);
}
