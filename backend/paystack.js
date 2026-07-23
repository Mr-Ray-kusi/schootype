import crypto from 'crypto';

const PAYSTACK_BASE = 'https://api.paystack.co';

export function getPaystackConfig() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY || '';
  const currency = (process.env.PAYSTACK_CURRENCY || 'GHS').toUpperCase();
  return {
    secretKey,
    publicKey,
    currency,
    configured: Boolean(secretKey),
  };
}

async function paystackRequest(path, { method = 'GET', body } = {}) {
  const { secretKey } = getPaystackConfig();
  if (!secretKey) {
    const err = new Error('Paystack is not configured. Set PAYSTACK_SECRET_KEY in backend/.env');
    err.code = 'PAYSTACK_NOT_CONFIGURED';
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

  const payload = await response.json().catch(() => ({}));

  // MoMo charge success responses use message "Charge attempted" with data.status
  // like pay_offline / pending / send_otp — that is NOT a failure.
  const chargeStarted =
    path === '/charge' &&
    payload?.data &&
    (payload.status === true ||
      String(payload.message || '').toLowerCase() === 'charge attempted');

  if (chargeStarted) {
    return {
      ...payload.data,
      _paystack_message: payload.message || null,
    };
  }

  if (!response.ok || payload.status === false) {
    const err = new Error(payload.message || `Paystack request failed (${response.status})`);
    err.code = 'PAYSTACK_API_ERROR';
    err.status = response.status >= 400 ? response.status : 502;
    err.payload = payload;
    throw err;
  }

  return payload.data;
}

export function toMinorUnits(amountMajor) {
  return Math.round(Number(amountMajor) * 100);
}

export function fromMinorUnits(amountMinor) {
  return Number(amountMinor || 0) / 100;
}

export function verifyPaystackSignature(rawBody, signature) {
  const { secretKey } = getPaystackConfig();
  if (!secretKey || !signature) return false;
  const hash = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');
  return hash === signature;
}

export async function listBanks({ currency = 'GHS', type } = {}) {
  const params = new URLSearchParams({ currency });
  if (type) params.set('type', type);
  return paystackRequest(`/bank?${params.toString()}`);
}

export async function resolveAccountNumber({ accountNumber, bankCode }) {
  const params = new URLSearchParams({
    account_number: String(accountNumber),
    bank_code: String(bankCode),
  });
  return paystackRequest(`/bank/resolve?${params.toString()}`);
}

export async function createTransferRecipient({ type, name, accountNumber, bankCode, currency }) {
  return paystackRequest('/transferrecipient', {
    method: 'POST',
    body: {
      type,
      name,
      account_number: String(accountNumber),
      bank_code: String(bankCode),
      currency,
    },
  });
}

export async function initializeTransaction({
  email,
  amountMinor,
  currency,
  reference,
  callbackUrl,
  channels,
  metadata,
}) {
  return paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: {
      email,
      amount: amountMinor,
      currency,
      reference,
      callback_url: callbackUrl,
      channels,
      metadata,
    },
  });
}

export async function chargeMobileMoney({
  email,
  amountMinor,
  currency,
  phone,
  provider,
  reference,
  metadata,
}) {
  return paystackRequest('/charge', {
    method: 'POST',
    body: {
      email,
      amount: amountMinor,
      currency,
      reference,
      metadata,
      mobile_money: {
        phone: normalizeGhanaPhone(phone),
        provider: String(provider).toLowerCase(),
      },
    },
  });
}

/** Ghana local format Paystack expects, e.g. 0551234567 */
export function normalizeGhanaPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length >= 12) {
    digits = `0${digits.slice(3)}`;
  }
  if (digits.length === 9) {
    digits = `0${digits}`;
  }
  return digits;
}

export async function verifyTransaction(reference) {
  return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export async function initiateTransfer({
  amountMinor,
  currency,
  recipientCode,
  reference,
  reason,
}) {
  return paystackRequest('/transfer', {
    method: 'POST',
    body: {
      source: 'balance',
      amount: amountMinor,
      currency,
      recipient: recipientCode,
      reference,
      reason,
    },
  });
}

export function momoProviderFromBankCode(bankCode) {
  const code = String(bankCode || '').toUpperCase();
  if (code === 'MTN' || code.includes('MTN')) return 'mtn';
  // Paystack accepts atl (docs) and some bank lists use ATL / AIRTELTIGO / TGO
  if (
    code === 'ATL' ||
    code === 'TGO' ||
    code.includes('AIRTEL') ||
    code.includes('TIGO') ||
    code.includes('AT ')
  ) {
    return 'atl';
  }
  if (code === 'VOD' || code.includes('VOD') || code.includes('TELECEL')) return 'vod';
  return String(bankCode || '').toLowerCase();
}
