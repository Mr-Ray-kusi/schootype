import { getLocalDb } from './localDb.js';
import { v4 as uuidv4 } from 'uuid';

let initialized = false;

async function getDb() {
  const db = await getLocalDb();
  if (!initialized) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS fee_invoices (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        student_name TEXT,
        student_class TEXT,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        amount_paid REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'unpaid',
        due_date TEXT,
        term TEXT,
        created_at TEXT NOT NULL,
        paid_at TEXT
      )
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS fee_payments (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        school_id TEXT NOT NULL,
        amount REAL NOT NULL,
        method TEXT,
        paystack_reference TEXT UNIQUE,
        note TEXT,
        paid_at TEXT NOT NULL,
        recorded_by TEXT
      )
    `);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_fee_invoices_school ON fee_invoices(school_id)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_fee_invoices_status ON fee_invoices(school_id, status)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_fee_payments_invoice ON fee_payments(invoice_id)`);
    initialized = true;
  }
  return db;
}

export async function initFeeStore() {
  await getDb();
}

function computeStatus(amount, amountPaid) {
  const due = Number(amount) || 0;
  const paid = Number(amountPaid) || 0;
  if (paid <= 0) return 'unpaid';
  if (paid + 0.001 >= due) return 'paid';
  return 'partial';
}

function mapInvoice(row) {
  if (!row) return null;
  return {
    id: row.id,
    school_id: row.school_id,
    student_id: row.student_id,
    student_name: row.student_name,
    student_class: row.student_class,
    description: row.description,
    amount: Number(row.amount) || 0,
    amount_paid: Number(row.amount_paid) || 0,
    balance: Math.max(0, (Number(row.amount) || 0) - (Number(row.amount_paid) || 0)),
    status: row.status,
    due_date: row.due_date,
    term: row.term,
    created_at: row.created_at,
    paid_at: row.paid_at,
  };
}

export async function createFeeInvoice({
  schoolId,
  studentId,
  studentName,
  studentClass,
  description,
  amount,
  dueDate = null,
  term = null,
}) {
  const db = await getDb();
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const amt = Number(amount);

  await db.run(
    `INSERT INTO fee_invoices
      (id, school_id, student_id, student_name, student_class, description, amount, amount_paid, status, due_date, term, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'unpaid', ?, ?, ?)`,
    [id, schoolId, studentId, studentName || null, studentClass || null, description, amt, dueDate, term, createdAt]
  );

  return getFeeInvoice(id, schoolId);
}

export async function getFeeInvoice(id, schoolId = null) {
  const db = await getDb();
  const row = schoolId
    ? await db.get('SELECT * FROM fee_invoices WHERE id = ? AND school_id = ?', [id, schoolId])
    : await db.get('SELECT * FROM fee_invoices WHERE id = ?', [id]);
  return mapInvoice(row);
}

export async function listFeeInvoices(schoolId, { status } = {}) {
  const db = await getDb();
  let rows;
  if (status === 'paid') {
    rows = await db.all(
      `SELECT * FROM fee_invoices WHERE school_id = ? AND status = 'paid' ORDER BY paid_at DESC, created_at DESC`,
      [schoolId]
    );
  } else if (status === 'unpaid') {
    rows = await db.all(
      `SELECT * FROM fee_invoices WHERE school_id = ? AND status IN ('unpaid', 'partial') ORDER BY due_date ASC, created_at DESC`,
      [schoolId]
    );
  } else {
    rows = await db.all(
      `SELECT * FROM fee_invoices WHERE school_id = ? ORDER BY created_at DESC`,
      [schoolId]
    );
  }
  return rows.map(mapInvoice);
}

export async function getFeeSummary(schoolId) {
  const invoices = await listFeeInvoices(schoolId);
  const unpaid = invoices.filter((i) => i.status !== 'paid');
  const paid = invoices.filter((i) => i.status === 'paid');
  const totalOverdue = unpaid.reduce((sum, i) => sum + i.balance, 0);
  const totalCollected = paid.reduce((sum, i) => sum + i.amount_paid, 0);
  const studentsOwing = new Set(unpaid.map((i) => i.student_id)).size;

  const byClass = {};
  for (const inv of unpaid) {
    const key = inv.student_class || 'Unassigned';
    if (!byClass[key]) byClass[key] = { label: key, count: 0, balance: 0 };
    byClass[key].count += 1;
    byClass[key].balance += inv.balance;
  }
  const overdueByClass = Object.values(byClass).sort((a, b) => b.balance - a.balance);
  const maxBalance = Math.max(...overdueByClass.map((c) => c.balance), 1);
  overdueByClass.forEach((c) => {
    c.percent = Math.round((c.balance / maxBalance) * 100);
  });

  return {
    totalOverdue,
    studentsOwing,
    unpaidCount: unpaid.length,
    paidCount: paid.length,
    totalCollected,
    overdueByClass,
  };
}

/**
 * Apply a payment to an invoice. Idempotent when paystackReference is provided.
 */
export async function applyFeePayment({
  invoiceId,
  schoolId,
  amount,
  method = 'paystack',
  paystackReference = null,
  note = null,
  recordedBy = null,
}) {
  const db = await getDb();

  if (paystackReference) {
    const existing = await db.get(
      'SELECT * FROM fee_payments WHERE paystack_reference = ?',
      [paystackReference]
    );
    if (existing) {
      return { alreadyProcessed: true, invoice: await getFeeInvoice(invoiceId, schoolId), payment: existing };
    }
  }

  const invoice = await getFeeInvoice(invoiceId, schoolId);
  if (!invoice) {
    const err = new Error('Fee invoice not found');
    err.status = 404;
    throw err;
  }

  if (invoice.status === 'paid') {
    return { alreadyProcessed: true, invoice, payment: null };
  }

  const payAmount = Math.min(Number(amount), invoice.balance);
  if (!(payAmount > 0)) {
    const err = new Error('Invalid payment amount');
    err.status = 400;
    throw err;
  }

  const paymentId = uuidv4();
  const paidAt = new Date().toISOString();
  const newPaid = invoice.amount_paid + payAmount;
  const newStatus = computeStatus(invoice.amount, newPaid);

  await db.run(
    `INSERT INTO fee_payments
      (id, invoice_id, school_id, amount, method, paystack_reference, note, paid_at, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [paymentId, invoiceId, schoolId, payAmount, method, paystackReference, note, paidAt, recordedBy]
  );

  await db.run(
    `UPDATE fee_invoices
     SET amount_paid = ?, status = ?, paid_at = CASE WHEN ? = 'paid' THEN ? ELSE paid_at END
     WHERE id = ? AND school_id = ?`,
    [newPaid, newStatus, newStatus, paidAt, invoiceId, schoolId]
  );

  return {
    alreadyProcessed: false,
    invoice: await getFeeInvoice(invoiceId, schoolId),
    payment: {
      id: paymentId,
      invoice_id: invoiceId,
      amount: payAmount,
      method,
      paystack_reference: paystackReference,
      paid_at: paidAt,
    },
  };
}

export async function listFeePayments(schoolId, invoiceId = null) {
  const db = await getDb();
  const rows = invoiceId
    ? await db.all(
        `SELECT * FROM fee_payments WHERE school_id = ? AND invoice_id = ? ORDER BY paid_at DESC`,
        [schoolId, invoiceId]
      )
    : await db.all(
        `SELECT * FROM fee_payments WHERE school_id = ? ORDER BY paid_at DESC LIMIT 200`,
        [schoolId]
      );
  return rows;
}

export async function deleteFeeInvoice(id, schoolId) {
  const db = await getDb();
  const invoice = await getFeeInvoice(id, schoolId);
  if (!invoice) return false;
  if (invoice.amount_paid > 0) {
    const err = new Error('Cannot delete an invoice that has payments');
    err.status = 400;
    throw err;
  }
  await db.run('DELETE FROM fee_invoices WHERE id = ? AND school_id = ?', [id, schoolId]);
  return true;
}
