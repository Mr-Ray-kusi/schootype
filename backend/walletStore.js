import { getLocalDb } from './localDb.js';
import { v4 as uuidv4 } from 'uuid';
import { getPaystackConfig } from './paystack.js';

let initialized = false;

async function getDb() {
  const db = await getLocalDb();
  if (!initialized) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS school_wallets (
        school_id TEXT PRIMARY KEY,
        balance REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'GHS',
        updated_at TEXT NOT NULL
      )
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS wallet_ledger (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        entry_type TEXT NOT NULL,
        direction TEXT NOT NULL,
        amount REAL NOT NULL,
        balance_after REAL NOT NULL,
        currency TEXT NOT NULL,
        reference TEXT,
        paystack_reference TEXT,
        counterparty_type TEXT,
        counterparty_id TEXT,
        counterparty_name TEXT,
        note TEXT,
        recorded_by TEXT,
        created_at TEXT NOT NULL
      )
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS wallet_payouts (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        person_type TEXT NOT NULL,
        person_id TEXT NOT NULL,
        person_name TEXT,
        person_role TEXT,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        note TEXT,
        ledger_id TEXT,
        status TEXT NOT NULL DEFAULT 'paid',
        paid_at TEXT NOT NULL,
        recorded_by TEXT
      )
    `);
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_ledger_paystack
      ON wallet_ledger(paystack_reference) WHERE paystack_reference IS NOT NULL`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_wallet_ledger_school ON wallet_ledger(school_id, created_at)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_wallet_payouts_school ON wallet_payouts(school_id, paid_at)`);

    // External MoMo/bank transfer metadata (safe to re-run)
    for (const sql of [
      `ALTER TABLE wallet_payouts ADD COLUMN channel TEXT`,
      `ALTER TABLE wallet_payouts ADD COLUMN account_hint TEXT`,
      `ALTER TABLE wallet_payouts ADD COLUMN transfer_code TEXT`,
      `ALTER TABLE wallet_payouts ADD COLUMN transfer_reference TEXT`,
    ]) {
      try {
        await db.exec(sql);
      } catch {
        /* column already exists */
      }
    }

    initialized = true;
  }
  return db;
}

/** Dedicated owner id for platform (super admin) revenue wallet — never a school id. */
export const PLATFORM_WALLET_ID = 'platform';

export async function initWalletStore() {
  await getDb();
}

function mapLedger(row) {
  if (!row) return null;
  return {
    id: row.id,
    school_id: row.school_id,
    entry_type: row.entry_type,
    direction: row.direction,
    amount: Number(row.amount) || 0,
    balance_after: Number(row.balance_after) || 0,
    currency: row.currency,
    reference: row.reference,
    paystack_reference: row.paystack_reference,
    counterparty_type: row.counterparty_type,
    counterparty_id: row.counterparty_id,
    counterparty_name: row.counterparty_name,
    note: row.note,
    recorded_by: row.recorded_by,
    created_at: row.created_at,
  };
}

function mapPayout(row) {
  if (!row) return null;
  return {
    id: row.id,
    school_id: row.school_id,
    person_type: row.person_type,
    person_id: row.person_id,
    person_name: row.person_name,
    person_role: row.person_role,
    amount: Number(row.amount) || 0,
    currency: row.currency,
    note: row.note,
    ledger_id: row.ledger_id,
    status: row.status,
    paid_at: row.paid_at,
    recorded_by: row.recorded_by,
    channel: row.channel || null,
    account_hint: row.account_hint || null,
    transfer_code: row.transfer_code || null,
    transfer_reference: row.transfer_reference || null,
  };
}

export async function getPlatformWallet() {
  return getWallet(PLATFORM_WALLET_ID);
}

export async function ensureWallet(schoolId) {
  const db = await getDb();
  const currency = getPaystackConfig().currency || 'GHS';
  const existing = await db.get('SELECT * FROM school_wallets WHERE school_id = ?', [schoolId]);
  if (existing) {
    return {
      school_id: existing.school_id,
      balance: Number(existing.balance) || 0,
      currency: existing.currency || currency,
      updated_at: existing.updated_at,
    };
  }
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO school_wallets (school_id, balance, currency, updated_at) VALUES (?, 0, ?, ?)`,
    [schoolId, currency, now]
  );
  return { school_id: schoolId, balance: 0, currency, updated_at: now };
}

export async function getWallet(schoolId) {
  return ensureWallet(schoolId);
}

async function applyEntry(db, {
  schoolId,
  entryType,
  direction,
  amount,
  reference = null,
  paystackReference = null,
  counterpartyType = null,
  counterpartyId = null,
  counterpartyName = null,
  note = null,
  recordedBy = null,
}) {
  const wallet = await ensureWallet(schoolId);
  const amt = Math.round(Number(amount) * 100) / 100;
  if (!(amt > 0)) {
    const err = new Error('Amount must be greater than zero');
    err.status = 400;
    throw err;
  }

  const current = Number(wallet.balance) || 0;
  const nextBalance =
    direction === 'credit' ? current + amt : current - amt;

  if (direction === 'debit' && nextBalance < -0.001) {
    const err = new Error('Insufficient wallet balance');
    err.status = 400;
    throw err;
  }

  if (paystackReference) {
    const dup = await db.get(
      'SELECT id FROM wallet_ledger WHERE paystack_reference = ?',
      [paystackReference]
    );
    if (dup) {
      return {
        alreadyProcessed: true,
        wallet: await getWallet(schoolId),
        entry: mapLedger(await db.get('SELECT * FROM wallet_ledger WHERE id = ?', [dup.id])),
      };
    }
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const currency = wallet.currency || getPaystackConfig().currency || 'GHS';
  const roundedBalance = Math.round(nextBalance * 100) / 100;

  await db.run('BEGIN IMMEDIATE');
  try {
    await db.run(
      `UPDATE school_wallets SET balance = ?, updated_at = ? WHERE school_id = ?`,
      [roundedBalance, createdAt, schoolId]
    );
    await db.run(
      `INSERT INTO wallet_ledger
        (id, school_id, entry_type, direction, amount, balance_after, currency, reference,
         paystack_reference, counterparty_type, counterparty_id, counterparty_name, note, recorded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        schoolId,
        entryType,
        direction,
        amt,
        roundedBalance,
        currency,
        reference,
        paystackReference,
        counterpartyType,
        counterpartyId,
        counterpartyName,
        note,
        recordedBy,
        createdAt,
      ]
    );
    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK').catch(() => {});
    if (String(error.message || '').includes('UNIQUE')) {
      return {
        alreadyProcessed: true,
        wallet: await getWallet(schoolId),
        entry: null,
      };
    }
    throw error;
  }

  const entry = mapLedger(await db.get('SELECT * FROM wallet_ledger WHERE id = ?', [id]));
  return {
    alreadyProcessed: false,
    wallet: { school_id: schoolId, balance: roundedBalance, currency, updated_at: createdAt },
    entry,
  };
}

/** Credit wallet after Paystack top-up (idempotent on paystackReference). */
export async function creditWalletTopup({
  schoolId,
  amount,
  paystackReference,
  note = 'Paystack wallet top-up',
  recordedBy = 'paystack',
}) {
  const db = await getDb();
  return applyEntry(db, {
    schoolId,
    entryType: 'topup',
    direction: 'credit',
    amount,
    paystackReference,
    reference: paystackReference,
    note,
    recordedBy,
    counterpartyType: 'paystack',
    counterpartyName: 'Paystack',
  });
}

/** Super-admin / manual credit. */
export async function creditWalletManual({
  schoolId,
  amount,
  note = null,
  recordedBy = null,
}) {
  const db = await getDb();
  return applyEntry(db, {
    schoolId,
    entryType: 'adjustment_credit',
    direction: 'credit',
    amount,
    note: note || 'Manual wallet credit',
    recordedBy,
    counterpartyType: 'platform',
    counterpartyName: 'Platform admin',
  });
}

/** Super-admin manual debit (clawback). */
export async function debitWalletManual({
  schoolId,
  amount,
  note = null,
  recordedBy = null,
}) {
  const db = await getDb();
  return applyEntry(db, {
    schoolId,
    entryType: 'adjustment_debit',
    direction: 'debit',
    amount,
    note: note || 'Manual wallet debit',
    recordedBy,
    counterpartyType: 'platform',
    counterpartyName: 'Platform admin',
  });
}

/** Pay platform subscription from school wallet. */
export async function debitWalletForSubscription({
  schoolId,
  amount,
  planName = null,
  recordedBy = null,
  reference = null,
}) {
  const db = await getDb();
  return applyEntry(db, {
    schoolId,
    entryType: 'subscription',
    direction: 'debit',
    amount,
    reference: reference || `sub_wallet_${Date.now()}`,
    note: planName ? `Subscription payment — ${planName}` : 'Subscription payment to platform',
    recordedBy,
    counterpartyType: 'platform',
    counterpartyName: 'Schooltype platform',
  });
}

/** Pay staff or non-staff from wallet. */
export async function payPersonFromWallet({
  schoolId,
  personType,
  personId,
  personName,
  personRole = null,
  amount,
  note = null,
  recordedBy = null,
}) {
  if (!['staff', 'non_staff'].includes(personType)) {
    const err = new Error('personType must be staff or non_staff');
    err.status = 400;
    throw err;
  }

  const db = await getDb();
  const result = await applyEntry(db, {
    schoolId,
    entryType: personType === 'staff' ? 'payout_staff' : 'payout_non_staff',
    direction: 'debit',
    amount,
    note: note || `Payout to ${personName || personType}`,
    recordedBy,
    counterpartyType: personType,
    counterpartyId: personId,
    counterpartyName: personName,
  });

  if (result.alreadyProcessed) return result;

  const payoutId = uuidv4();
  const paidAt = new Date().toISOString();
  const currency = result.wallet.currency || getPaystackConfig().currency || 'GHS';

  await db.run(
    `INSERT INTO wallet_payouts
      (id, school_id, person_type, person_id, person_name, person_role, amount, currency, note, ledger_id, status, paid_at, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?)`,
    [
      payoutId,
      schoolId,
      personType,
      personId,
      personName || null,
      personRole || null,
      Number(amount),
      currency,
      note || null,
      result.entry?.id || null,
      paidAt,
      recordedBy,
    ]
  );

  const payout = mapPayout(await db.get('SELECT * FROM wallet_payouts WHERE id = ?', [payoutId]));
  return { ...result, payout };
}

export async function listLedger(schoolId, { limit = 50, offset = 0 } = {}) {
  const db = await getDb();
  await ensureWallet(schoolId);
  const rows = await db.all(
    `SELECT * FROM wallet_ledger WHERE school_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [schoolId, Math.min(Number(limit) || 50, 200), Number(offset) || 0]
  );
  return rows.map(mapLedger);
}

export async function listPayouts(schoolId, { limit = 50, offset = 0 } = {}) {
  const db = await getDb();
  const rows = await db.all(
    `SELECT * FROM wallet_payouts WHERE school_id = ? ORDER BY paid_at DESC LIMIT ? OFFSET ?`,
    [schoolId, Math.min(Number(limit) || 50, 200), Number(offset) || 0]
  );
  return rows.map(mapPayout);
}

/** Sum of subscription debits received by platform from school wallets. */
export async function getPlatformWalletRevenue() {
  const db = await getDb();
  const row = await db.get(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM wallet_ledger
     WHERE entry_type = 'subscription' AND direction = 'debit'
       AND school_id != ?`,
    [PLATFORM_WALLET_ID]
  );
  return Number(row?.total) || 0;
}

/** Credit platform revenue wallet (subscription income or platform top-up). */
export async function creditPlatformRevenue({
  amount,
  note = 'Subscription revenue',
  recordedBy = null,
  paystackReference = null,
  entryType = 'revenue',
  counterpartyName = null,
}) {
  const db = await getDb();
  return applyEntry(db, {
    schoolId: PLATFORM_WALLET_ID,
    entryType,
    direction: 'credit',
    amount,
    paystackReference,
    reference: paystackReference,
    note,
    recordedBy,
    counterpartyType: 'school',
    counterpartyName: counterpartyName || 'Subscription',
  });
}

/**
 * Debit a wallet for an outgoing Paystack MoMo/bank transfer, then record payout.
 * Caller should initiate the Paystack transfer; on failure call creditWalletManual to refund.
 */
export async function debitForExternalTransfer({
  ownerId,
  amount,
  recipientName,
  channel,
  accountHint,
  note = null,
  recordedBy = null,
  transferCode = null,
  transferReference = null,
}) {
  const db = await getDb();
  const result = await applyEntry(db, {
    schoolId: ownerId,
    entryType: channel === 'mobile_money' ? 'transfer_momo' : 'transfer_bank',
    direction: 'debit',
    amount,
    note: note || `Paystack ${channel} transfer to ${recipientName}`,
    recordedBy,
    counterpartyType: channel,
    counterpartyName: recipientName,
    reference: transferReference,
  });

  if (result.alreadyProcessed) return result;

  const payoutId = uuidv4();
  const paidAt = new Date().toISOString();
  const currency = result.wallet.currency || getPaystackConfig().currency || 'GHS';

  await db.run(
    `INSERT INTO wallet_payouts
      (id, school_id, person_type, person_id, person_name, person_role, amount, currency, note,
       ledger_id, status, paid_at, recorded_by, channel, account_hint, transfer_code, transfer_reference)
     VALUES (?, ?, 'external', ?, ?, NULL, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, ?)`,
    [
      payoutId,
      ownerId,
      transferReference || payoutId,
      recipientName || null,
      Number(amount),
      currency,
      note || null,
      result.entry?.id || null,
      paidAt,
      recordedBy,
      channel || null,
      accountHint || null,
      transferCode || null,
      transferReference || null,
    ]
  );

  const payout = mapPayout(await db.get('SELECT * FROM wallet_payouts WHERE id = ?', [payoutId]));
  return { ...result, payout };
}
