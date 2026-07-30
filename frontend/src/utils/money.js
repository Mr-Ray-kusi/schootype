import { PLAN_CURRENCY } from '../constants/plans';

const LOCALE_BY_CURRENCY = {
  GHS: 'en-GH',
  USD: 'en-US',
  NGN: 'en-NG',
};

const SYMBOL_BY_CURRENCY = {
  GHS: '₵',
  USD: '$',
  NGN: '₦',
};

/** Format amounts in the active plan currency (default GHS). */
export function formatMoney(amount, { compact = false, currency = PLAN_CURRENCY } = {}) {
  const value = Number(amount) || 0;
  const code = currency || 'GHS';
  const locale = LOCALE_BY_CURRENCY[code] || 'en-GH';

  if (compact) {
    const symbol = SYMBOL_BY_CURRENCY[code] || `${code} `;
    return `${symbol}${value.toLocaleString(locale, { maximumFractionDigits: 0 })}`;
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(value);
}

/** @deprecated Use formatMoney */
export const formatNaira = formatMoney;
