import { getLocalDb } from './localDb.js';

let initialized = false;

async function getDb() {
  const db = await getLocalDb();
  if (!initialized) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS paystack_transactions (
        reference TEXT PRIMARY KEY,
        purpose TEXT NOT NULL,
        school_id TEXT NOT NULL,
        amount REAL NOT NULL,
        amount_kobo INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        metadata TEXT,
        invoice_id TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
      )
    `);
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_paystack_school ON paystack_transactions(school_id)
    `);
    initialized = true;
  }
  return db;
}

export async function initPaystackStore() {
  await getDb();
}

export async function createPendingTransaction({
  reference,
  purpose,
  schoolId,
  amountNgn,
  amountKobo,
  metadata = {},
  invoiceId = null,
}) {
  const db = await getDb();
  const createdAt = new Date().toISOString();
  await db.run(
    `INSERT INTO paystack_transactions
      (reference, purpose, school_id, amount, amount_kobo, status, metadata, invoice_id, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [
      reference,
      purpose,
      schoolId,
      amountNgn,
      amountKobo,
      JSON.stringify(metadata),
      invoiceId,
      createdAt,
    ]
  );
  return getTransaction(reference);
}

export async function getTransaction(reference) {
  const db = await getDb();
  const row = await db.get('SELECT * FROM paystack_transactions WHERE reference = ?', [reference]);
  if (!row) return null;
  return {
    ...row,
    metadata: safeJson(row.metadata),
  };
}

export async function markTransactionStatus(reference, status, { completedAt } = {}) {
  const db = await getDb();
  if (status === 'pending') {
    await db.run(
      `UPDATE paystack_transactions SET status = 'pending', completed_at = NULL WHERE reference = ?`,
      [reference]
    );
  } else {
    const doneAt = completedAt === undefined ? new Date().toISOString() : completedAt;
    await db.run(
      `UPDATE paystack_transactions
       SET status = ?, completed_at = COALESCE(?, completed_at)
       WHERE reference = ?`,
      [status, doneAt, reference]
    );
  }
  return getTransaction(reference);
}

/**
 * Atomically claim a pending transaction for processing.
 * Returns the row if claimed, or null if already success/claimed.
 */
export async function claimTransactionForProcessing(reference) {
  const db = await getDb();
  const existing = await getTransaction(reference);
  if (!existing) return { error: 'not_found' };
  if (existing.status === 'success') return { alreadyProcessed: true, transaction: existing };

  if (existing.status === 'processing') {
    await new Promise((r) => setTimeout(r, 1200));
    const again = await getTransaction(reference);
    if (again?.status === 'success') return { alreadyProcessed: true, transaction: again };
    if (again?.status === 'processing') {
      return { error: 'in_progress', transaction: again };
    }
  }

  const result = await db.run(
    `UPDATE paystack_transactions SET status = 'processing' WHERE reference = ? AND status = 'pending'`,
    [reference]
  );

  if (result.changes === 0) {
    const again = await getTransaction(reference);
    if (again?.status === 'success') {
      return { alreadyProcessed: true, transaction: again };
    }
    return { error: 'not_claimable', transaction: again };
  }

  return { transaction: await getTransaction(reference) };
}

function safeJson(value) {
  if (!value) return {};
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return {};
  }
}
