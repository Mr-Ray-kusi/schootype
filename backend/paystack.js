import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const PAYSTACK_BASE = 'https://api.paystack.co';

const SUPPORTED_CURRENCIES = new Set(['GHS', 'USD', 'NGN', 'ZAR', 'KES']);

/**
 * Paystack merchant config from env.
 * Ghana merchants: PAYSTACK_CURRENCY=GHS (required for local test/live).
 * USD/NGN only work if that currency is enabled on the Paystack business.
 */
export function getPaystackConfig() {
  const secretKey = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  const publicKey = (process.env.PAYSTACK_PUBLIC_KEY || '').trim();
  const rawCurrency = (process.env.PAYSTACK_CURRENCY || 'GHS').toUpperCase().trim();
  const currency = SUPPORTED_CURRENCIES.has(rawCurrency) ? rawCurrency : 'GHS';
  const configured = Boolean(secretKey && publicKey);
  return { secretKey, publicKey, currency, configured };
}

/** Convert major currency units to Paystack minor units (×100). */
export function toMinorUnits(amountMajor) {
  return Math.round(Number(amountMajor) * 100);
}

export function fromMinorUnits(amountMinor) {
  return Number(amountMinor) / 100;
}

/** @deprecated Use toMinorUnits */
export const toKobo = toMinorUnits;
/** @deprecated Use fromMinorUnits */
export const fromKobo = fromMinorUnits;

async function paystackRequest(path, { method = 'GET', body } = {}) {
  const { secretKey, configured } = getPaystackConfig();
  if (!configured) {
    const err = new Error('Paystack is not configured. Set PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY.');
    err.status = 503;
    throw err;
  }

  const response = await fetch(`${PAYSTACK_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status === false) {
    const err = new Error(data.message || `Paystack request failed (${response.status})`);
    err.status = response.status >= 400 ? response.status : 502;
    err.paystack = data;
    throw err;
  }

  return data;
}

/**
 * Initialize a Paystack transaction.
 * @param {{ email: string, amount: number, reference: string, callbackUrl: string, metadata?: object, currency?: string }} params
 */
export async function initializeTransaction({
  email,
  amount,
  amountNgn, // legacy alias
  reference,
  callbackUrl,
  metadata = {},
  currency: currencyOverride,
}) {
  const { currency: configuredCurrency } = getPaystackConfig();
  const currency = (currencyOverride || configuredCurrency || 'GHS').toUpperCase();
  const major = amount ?? amountNgn;
  const amountMinor = toMinorUnits(major);

  if (!Number.isFinite(amountMinor) || amountMinor < 100) {
    const err = new Error('Invalid payment amount');
    err.status = 400;
    throw err;
  }

  const data = await paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: {
      email,
      amount: amountMinor,
      currency,
      reference,
      callback_url: callbackUrl,
      metadata,
    },
  });

  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
    amountKobo: amountMinor,
    amountMinor,
    amount: fromMinorUnits(amountMinor),
    amountNgn: fromMinorUnits(amountMinor), // legacy alias
    currency,
  };
}

export async function verifyTransaction(reference) {
  const data = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
  return data.data;
}

/**
 * Verify Paystack webhook signature (HMAC SHA512 of raw body with secret key).
 */
export function verifyWebhookSignature(rawBody, signatureHeader) {
  const { secretKey } = getPaystackConfig();
  if (!secretKey || !signatureHeader || !rawBody) return false;

  const hash = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(String(signatureHeader)));
  } catch {
    return false;
  }
}

export function createPaymentReference(prefix = 'sch') {
  const rand = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${Date.now()}_${rand}`;
}

/** List banks or MoMo telcos for transfers. type: ghipss | mobile_money */
export async function listTransferBanks({ currency = 'GHS', type = 'ghipss' } = {}) {
  const { currency: configured } = getPaystackConfig();
  const cur = (currency || configured || 'GHS').toUpperCase();
  const qs = new URLSearchParams({ currency: cur, type });
  const data = await paystackRequest(`/bank?${qs.toString()}`);
  return Array.isArray(data.data) ? data.data : [];
}

/**
 * Create a Paystack transfer recipient (Ghana bank or MoMo).
 * @param {{ type: 'mobile_money'|'ghipss', name: string, accountNumber: string, bankCode: string, currency?: string }} params
 */
export async function createTransferRecipient({
  type,
  name,
  accountNumber,
  bankCode,
  currency: currencyOverride,
}) {
  const { currency: configured } = getPaystackConfig();
  const currency = (currencyOverride || configured || 'GHS').toUpperCase();
  const recipientType = type === 'bank' ? 'ghipss' : type;

  if (!['mobile_money', 'ghipss'].includes(recipientType)) {
    const err = new Error('Recipient type must be mobile_money or bank (ghipss)');
    err.status = 400;
    throw err;
  }
  if (!name?.trim() || !accountNumber?.trim() || !bankCode?.trim()) {
    const err = new Error('name, accountNumber, and bankCode are required');
    err.status = 400;
    throw err;
  }

  const data = await paystackRequest('/transferrecipient', {
    method: 'POST',
    body: {
      type: recipientType,
      name: name.trim(),
      account_number: String(accountNumber).trim(),
      bank_code: String(bankCode).trim(),
      currency,
    },
  });

  return {
    recipientCode: data.data.recipient_code,
    type: data.data.type,
    name: data.data.name,
    details: data.data.details || {},
    currency: data.data.currency || currency,
  };
}

/**
 * Initiate a Paystack transfer to a recipient (uses merchant Paystack balance).
 * @param {{ amount: number, recipientCode: string, reason?: string, reference?: string, currency?: string }} params
 */
export async function initiateTransfer({
  amount,
  recipientCode,
  reason = 'Wallet payout',
  reference,
  currency: currencyOverride,
}) {
  const { currency: configured } = getPaystackConfig();
  const currency = (currencyOverride || configured || 'GHS').toUpperCase();
  const amountMinor = toMinorUnits(amount);

  if (!Number.isFinite(amountMinor) || amountMinor < 100) {
    const err = new Error('Invalid transfer amount');
    err.status = 400;
    throw err;
  }
  if (!recipientCode) {
    const err = new Error('recipientCode is required');
    err.status = 400;
    throw err;
  }

  const body = {
    source: 'balance',
    amount: amountMinor,
    recipient: recipientCode,
    reason,
    currency,
  };
  if (reference) body.reference = reference;

  const data = await paystackRequest('/transfer', {
    method: 'POST',
    body,
  });

  return {
    transferCode: data.data.transfer_code,
    reference: data.data.reference,
    status: data.data.status,
    amount: fromMinorUnits(data.data.amount ?? amountMinor),
    amountMinor: data.data.amount ?? amountMinor,
    currency: data.data.currency || currency,
    recipient: data.data.recipient,
  };
}
