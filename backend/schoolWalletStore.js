import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'school-extras.db');

let dbPromise = null;

async function getDb() {
  if (!dbPromise) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    dbPromise = open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS school_wallets (
          school_id TEXT PRIMARY KEY,
          available_balance INTEGER NOT NULL DEFAULT 0,
          pending_balance INTEGER NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'GHS',
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS wallet_accounts (
          id TEXT PRIMARY KEY,
          school_id TEXT NOT NULL,
          type TEXT NOT NULL,
          label TEXT,
          account_name TEXT NOT NULL,
          account_number TEXT NOT NULL,
          bank_code TEXT NOT NULL,
          bank_name TEXT,
          provider TEXT,
          currency TEXT NOT NULL DEFAULT 'GHS',
          paystack_recipient_code TEXT,
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id TEXT PRIMARY KEY,
          school_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount INTEGER NOT NULL,
          fee INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL,
          channel TEXT,
          account_id TEXT,
          reference TEXT UNIQUE NOT NULL,
          provider_reference TEXT,
          description TEXT,
          metadata TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_wallet_accounts_school ON wallet_accounts(school_id);
        CREATE INDEX IF NOT EXISTS idx_wallet_tx_school ON wallet_transactions(school_id);
        CREATE INDEX IF NOT EXISTS idx_wallet_tx_reference ON wallet_transactions(reference);
      `);
      return db;
    });
  }
  return dbPromise;
}

function nowIso() {
  return new Date().toISOString();
}

function parseMetadata(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function mapAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    school_id: row.school_id,
    type: row.type,
    label: row.label,
    account_name: row.account_name,
    account_number: row.account_number,
    bank_code: row.bank_code,
    bank_name: row.bank_name,
    provider: row.provider,
    currency: row.currency,
    paystack_recipient_code: row.paystack_recipient_code,
    is_default: row.is_default === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapTransaction(row) {
  if (!row) return null;
  return {
    id: row.id,
    school_id: row.school_id,
    type: row.type,
    amount: row.amount,
    fee: row.fee,
    status: row.status,
    channel: row.channel,
    account_id: row.account_id,
    reference: row.reference,
    provider_reference: row.provider_reference,
    description: row.description,
    metadata: parseMetadata(row.metadata),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function initSchoolWalletStore() {
  await getDb();
}

export async function ensureWallet(schoolId, currency = 'GHS') {
  const db = await getDb();
  const existing = await db.get('SELECT * FROM school_wallets WHERE school_id = ?', [schoolId]);
  if (existing) return existing;

  const updatedAt = nowIso();
  await db.run(
    `INSERT INTO school_wallets (school_id, available_balance, pending_balance, currency, updated_at)
     VALUES (?, 0, 0, ?, ?)`,
    [schoolId, currency, updatedAt]
  );
  return db.get('SELECT * FROM school_wallets WHERE school_id = ?', [schoolId]);
}

export async function getWallet(schoolId) {
  const wallet = await ensureWallet(schoolId);
  return {
    school_id: wallet.school_id,
    available_balance: wallet.available_balance || 0,
    pending_balance: wallet.pending_balance || 0,
    currency: wallet.currency || 'GHS',
    updated_at: wallet.updated_at,
  };
}

export async function listWalletAccounts(schoolId) {
  const db = await getDb();
  const rows = await db.all(
    `SELECT * FROM wallet_accounts WHERE school_id = ? ORDER BY is_default DESC, created_at DESC`,
    [schoolId]
  );
  return rows.map(mapAccount);
}

export async function getWalletAccount(schoolId, accountId) {
  const db = await getDb();
  const row = await db.get(
    `SELECT * FROM wallet_accounts WHERE school_id = ? AND id = ?`,
    [schoolId, accountId]
  );
  return mapAccount(row);
}

export async function createWalletAccount(schoolId, data) {
  const db = await getDb();
  const id = randomUUID();
  const timestamp = nowIso();
  const existing = await listWalletAccounts(schoolId);
  const makeDefault = existing.length === 0 || Boolean(data.is_default);

  if (makeDefault) {
    await db.run(`UPDATE wallet_accounts SET is_default = 0 WHERE school_id = ?`, [schoolId]);
  }

  await db.run(
    `INSERT INTO wallet_accounts (
      id, school_id, type, label, account_name, account_number, bank_code, bank_name,
      provider, currency, paystack_recipient_code, is_default, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      schoolId,
      data.type,
      data.label || null,
      data.account_name,
      data.account_number,
      data.bank_code,
      data.bank_name || null,
      data.provider || null,
      data.currency || 'GHS',
      data.paystack_recipient_code || null,
      makeDefault ? 1 : 0,
      timestamp,
      timestamp,
    ]
  );

  return getWalletAccount(schoolId, id);
}

export async function updateWalletAccount(schoolId, accountId, patch) {
  const db = await getDb();
  const existing = await getWalletAccount(schoolId, accountId);
  if (!existing) return null;

  const next = {
    ...existing,
    ...patch,
    updated_at: nowIso(),
  };

  if (patch.is_default) {
    await db.run(`UPDATE wallet_accounts SET is_default = 0 WHERE school_id = ?`, [schoolId]);
  }

  await db.run(
    `UPDATE wallet_accounts SET
      label = ?, account_name = ?, account_number = ?, bank_code = ?, bank_name = ?,
      provider = ?, currency = ?, paystack_recipient_code = ?, is_default = ?, updated_at = ?
     WHERE school_id = ? AND id = ?`,
    [
      next.label || null,
      next.account_name,
      next.account_number,
      next.bank_code,
      next.bank_name || null,
      next.provider || null,
      next.currency || 'GHS',
      next.paystack_recipient_code || null,
      (next.is_default || patch.is_default) ? 1 : 0,
      next.updated_at,
      schoolId,
      accountId,
    ]
  );

  return getWalletAccount(schoolId, accountId);
}

export async function deleteWalletAccount(schoolId, accountId) {
  const db = await getDb();
  const existing = await getWalletAccount(schoolId, accountId);
  if (!existing) return false;

  await db.run(`DELETE FROM wallet_accounts WHERE school_id = ? AND id = ?`, [schoolId, accountId]);

  if (existing.is_default) {
    const remaining = await listWalletAccounts(schoolId);
    if (remaining[0]) {
      await db.run(
        `UPDATE wallet_accounts SET is_default = 1, updated_at = ? WHERE id = ?`,
        [nowIso(), remaining[0].id]
      );
    }
  }

  return true;
}

export async function createWalletTransaction(schoolId, data) {
  const db = await getDb();
  const id = randomUUID();
  const timestamp = nowIso();

  await db.run(
    `INSERT INTO wallet_transactions (
      id, school_id, type, amount, fee, status, channel, account_id, reference,
      provider_reference, description, metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      schoolId,
      data.type,
      data.amount,
      data.fee || 0,
      data.status,
      data.channel || null,
      data.account_id || null,
      data.reference,
      data.provider_reference || null,
      data.description || null,
      JSON.stringify(data.metadata || {}),
      timestamp,
      timestamp,
    ]
  );

  return getWalletTransactionByReference(data.reference);
}

export async function getWalletTransactionByReference(reference) {
  const db = await getDb();
  const row = await db.get(`SELECT * FROM wallet_transactions WHERE reference = ?`, [reference]);
  return mapTransaction(row);
}

export async function listWalletTransactions(schoolId, { limit = 50 } = {}) {
  const db = await getDb();
  const rows = await db.all(
    `SELECT * FROM wallet_transactions WHERE school_id = ? ORDER BY created_at DESC LIMIT ?`,
    [schoolId, limit]
  );
  return rows.map(mapTransaction);
}

export async function updateWalletTransaction(reference, patch) {
  const db = await getDb();
  const existing = await getWalletTransactionByReference(reference);
  if (!existing) return null;

  const metadata = patch.metadata !== undefined
    ? { ...existing.metadata, ...patch.metadata }
    : existing.metadata;

  await db.run(
    `UPDATE wallet_transactions SET
      status = COALESCE(?, status),
      provider_reference = COALESCE(?, provider_reference),
      description = COALESCE(?, description),
      metadata = ?,
      updated_at = ?
     WHERE reference = ?`,
    [
      patch.status ?? null,
      patch.provider_reference ?? null,
      patch.description ?? null,
      JSON.stringify(metadata || {}),
      nowIso(),
      reference,
    ]
  );

  return getWalletTransactionByReference(reference);
}

/**
 * Apply a successful deposit once (idempotent by reference status).
 */
export async function creditDeposit(reference) {
  const db = await getDb();
  const tx = await getWalletTransactionByReference(reference);
  if (!tx) return null;
  if (tx.status === 'success') return { wallet: await getWallet(tx.school_id), transaction: tx };

  await ensureWallet(tx.school_id);
  await db.run('BEGIN');
  try {
    await db.run(
      `UPDATE school_wallets
       SET available_balance = available_balance + ?, updated_at = ?
       WHERE school_id = ?`,
      [tx.amount, nowIso(), tx.school_id]
    );
    await db.run(
      `UPDATE wallet_transactions SET status = 'success', updated_at = ? WHERE reference = ?`,
      [nowIso(), reference]
    );
    await db.run('COMMIT');
  } catch (err) {
    await db.run('ROLLBACK');
    throw err;
  }

  return {
    wallet: await getWallet(tx.school_id),
    transaction: await getWalletTransactionByReference(reference),
  };
}

/**
 * Move available → pending when withdrawal is initiated.
 */
export async function reserveWithdrawal(schoolId, amountMinor) {
  const db = await getDb();
  await ensureWallet(schoolId);
  const wallet = await getWallet(schoolId);
  if (wallet.available_balance < amountMinor) {
    const err = new Error('Insufficient wallet balance');
    err.status = 400;
    throw err;
  }

  await db.run(
    `UPDATE school_wallets
     SET available_balance = available_balance - ?,
         pending_balance = pending_balance + ?,
         updated_at = ?
     WHERE school_id = ?`,
    [amountMinor, amountMinor, nowIso(), schoolId]
  );

  return getWallet(schoolId);
}

export async function completeWithdrawal(reference) {
  const db = await getDb();
  const tx = await getWalletTransactionByReference(reference);
  if (!tx) return null;
  if (tx.status === 'success') return { wallet: await getWallet(tx.school_id), transaction: tx };

  await db.run('BEGIN');
  try {
    await db.run(
      `UPDATE school_wallets
       SET pending_balance = CASE WHEN pending_balance >= ? THEN pending_balance - ? ELSE 0 END,
           updated_at = ?
       WHERE school_id = ?`,
      [tx.amount, tx.amount, nowIso(), tx.school_id]
    );
    await db.run(
      `UPDATE wallet_transactions SET status = 'success', updated_at = ? WHERE reference = ?`,
      [nowIso(), reference]
    );
    await db.run('COMMIT');
  } catch (err) {
    await db.run('ROLLBACK');
    throw err;
  }

  return {
    wallet: await getWallet(tx.school_id),
    transaction: await getWalletTransactionByReference(reference),
  };
}

export async function failWithdrawal(reference, reason) {
  const db = await getDb();
  const tx = await getWalletTransactionByReference(reference);
  if (!tx) return null;
  if (tx.status === 'success' || tx.status === 'failed') {
    return { wallet: await getWallet(tx.school_id), transaction: tx };
  }

  await db.run('BEGIN');
  try {
    await db.run(
      `UPDATE school_wallets
       SET pending_balance = CASE WHEN pending_balance >= ? THEN pending_balance - ? ELSE 0 END,
           available_balance = available_balance + ?,
           updated_at = ?
       WHERE school_id = ?`,
      [tx.amount, tx.amount, tx.amount, nowIso(), tx.school_id]
    );
    await db.run(
      `UPDATE wallet_transactions
       SET status = 'failed', description = COALESCE(?, description), updated_at = ?
       WHERE reference = ?`,
      [reason || tx.description, nowIso(), reference]
    );
    await db.run('COMMIT');
  } catch (err) {
    await db.run('ROLLBACK');
    throw err;
  }

  return {
    wallet: await getWallet(tx.school_id),
    transaction: await getWalletTransactionByReference(reference),
  };
}

export function makeWalletReference(prefix = 'wlt') {
  return `${prefix}_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

/**
 * Move funds from one school wallet to another (internal transfer).
 * Creates paired ledger rows on both wallets.
 */
export async function transferBetweenWallets({
  fromSchoolId,
  toSchoolId,
  amountMinor,
  reference,
  description,
  metadata = {},
}) {
  const amount = Math.round(Number(amountMinor) || 0);
  if (amount <= 0) {
    const err = new Error('Transfer amount must be greater than zero');
    err.status = 400;
    throw err;
  }
  if (!fromSchoolId || !toSchoolId || fromSchoolId === toSchoolId) {
    const err = new Error('Invalid transfer wallets');
    err.status = 400;
    throw err;
  }

  const db = await getDb();
  await ensureWallet(fromSchoolId);
  await ensureWallet(toSchoolId);

  const fromWallet = await getWallet(fromSchoolId);
  if (fromWallet.available_balance < amount) {
    const err = new Error(
      `Not enough wallet balance. Need GHS ${(amount / 100).toFixed(2)}, available GHS ${(fromWallet.available_balance / 100).toFixed(2)}.`
    );
    err.status = 400;
    err.code = 'WALLET_INSUFFICIENT';
    throw err;
  }

  const debitRef = `${reference}_out`;
  const creditRef = `${reference}_in`;
  const timestamp = nowIso();

  await db.run('BEGIN');
  try {
    await db.run(
      `UPDATE school_wallets
       SET available_balance = available_balance - ?, updated_at = ?
       WHERE school_id = ?`,
      [amount, timestamp, fromSchoolId]
    );
    await db.run(
      `UPDATE school_wallets
       SET available_balance = available_balance + ?, updated_at = ?
       WHERE school_id = ?`,
      [amount, timestamp, toSchoolId]
    );

    await db.run(
      `INSERT INTO wallet_transactions (
        id, school_id, type, amount, fee, status, channel, account_id, reference,
        provider_reference, description, metadata, created_at, updated_at
      ) VALUES (?, ?, 'debit', ?, 0, 'success', 'internal', NULL, ?, NULL, ?, ?, ?, ?)`,
      [
        randomUUID(),
        fromSchoolId,
        amount,
        debitRef,
        description || 'Internal transfer out',
        JSON.stringify({ ...metadata, direction: 'out', counterpart: toSchoolId }),
        timestamp,
        timestamp,
      ]
    );
    await db.run(
      `INSERT INTO wallet_transactions (
        id, school_id, type, amount, fee, status, channel, account_id, reference,
        provider_reference, description, metadata, created_at, updated_at
      ) VALUES (?, ?, 'credit', ?, 0, 'success', 'internal', NULL, ?, NULL, ?, ?, ?, ?)`,
      [
        randomUUID(),
        toSchoolId,
        amount,
        creditRef,
        description || 'Internal transfer in',
        JSON.stringify({ ...metadata, direction: 'in', counterpart: fromSchoolId }),
        timestamp,
        timestamp,
      ]
    );
    await db.run('COMMIT');
  } catch (err) {
    await db.run('ROLLBACK');
    throw err;
  }

  return {
    from_wallet: await getWallet(fromSchoolId),
    to_wallet: await getWallet(toSchoolId),
    reference,
    amount_minor: amount,
  };
}
