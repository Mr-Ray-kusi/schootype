import { fromMinorUnits } from './paystack.js';
import {
  getWallet,
  ensureWallet,
  transferBetweenWallets,
} from './schoolWalletStore.js';
import {
  getSmsSettings,
  setSmsUnitPrice,
  addSmsUnits,
  buildSmsQuote,
  listSmsSales,
  makeSmsSaleReference,
  getSchoolSmsBalance,
  ensureSchoolSmsBalance,
  creditSchoolSmsPurchase,
  consumeSchoolAndPlatformUnits,
} from './platformSmsStore.js';

async function findPlatformSchoolId(supabase) {
  if (process.env.PLATFORM_WALLET_SCHOOL_ID) {
    return process.env.PLATFORM_WALLET_SCHOOL_ID;
  }

  const { data: byRole } = await supabase
    .from('schools')
    .select('id, email, role')
    .eq('role', 'super_admin')
    .limit(1)
    .maybeSingle();

  if (byRole?.id) return byRole.id;

  const email = (process.env.DEV_SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL || 'superadmin@school.com')
    .trim()
    .toLowerCase();

  const { data: byEmail } = await supabase
    .from('schools')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  return byEmail?.id || null;
}

async function countSmsRecipients(supabase, schoolId, { sendMode, recipients, recipientPhone }) {
  if (sendMode === 'Individual') {
    return recipientPhone?.trim() ? 1 : 0;
  }

  const group = String(recipients || 'Parents');

  if (group === 'Parents' || group === 'All Parents' || group === 'All' || group.includes('Parents')) {
    const { count: withPhone } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .not('parent_phone', 'is', null)
      .neq('parent_phone', '');

    if (withPhone && withPhone > 0) return withPhone;

    const { count: students } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId);

    return students || 0;
  }

  if (group === 'Teachers' || group === 'Staff') {
    const { count } = await supabase
      .from('staffs')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId);
    return count || 0;
  }

  if (group === 'Non-Staff' || group === 'NonStaff') {
    const { count } = await supabase
      .from('nonstaffs')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId);
    return count || 0;
  }

  const { count } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId);
  return count || 0;
}

function formatSmsSettings(settings) {
  return {
    ...settings,
    unit_price_major: fromMinorUnits(settings.unit_price_minor),
    total_revenue_major: fromMinorUnits(settings.total_revenue_minor),
  };
}

async function getSchoolName(supabase, schoolId) {
  const { data } = await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle();
  return data?.name || null;
}

export function registerSmsBillingRoutes(app, {
  authenticateToken,
  enforcePlanApproval,
  requireSuperAdmin,
  supabase,
}) {
  app.get('/api/super-admin/sms', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const settings = await getSmsSettings();
      const sales = await listSmsSales({ limit: 50 });
      const platformSchoolId = await findPlatformSchoolId(supabase);
      let wallet = null;
      if (platformSchoolId) {
        await ensureWallet(platformSchoolId);
        wallet = await getWallet(platformSchoolId);
      }

      res.json({
        settings: formatSmsSettings(settings),
        sales: sales.map((s) => ({
          ...s,
          amount_major: fromMinorUnits(s.amount_minor),
        })),
        platform_wallet: wallet
          ? {
              ...wallet,
              available_balance_major: fromMinorUnits(wallet.available_balance),
            }
          : null,
      });
    } catch (err) {
      console.error('Get platform SMS error:', err);
      res.status(500).json({ error: 'Failed to load SMS settings' });
    }
  });

  app.patch('/api/super-admin/sms/price', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const major = Number(req.body?.unit_price);
      if (!Number.isFinite(major) || major <= 0) {
        return res.status(400).json({ error: 'unit_price must be a positive GHS amount (e.g. 0.05)' });
      }
      const settings = await setSmsUnitPrice(Math.round(major * 100));
      res.json({ settings: formatSmsSettings(settings) });
    } catch (err) {
      console.error('Set SMS price error:', err);
      res.status(500).json({ error: 'Failed to update SMS unit price' });
    }
  });

  app.post('/api/super-admin/sms/units', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const units = Math.round(Number(req.body?.units) || 0);
      if (units <= 0) {
        return res.status(400).json({ error: 'units must be a positive number' });
      }
      const settings = await addSmsUnits(units);
      res.json({ settings: formatSmsSettings(settings) });
    } catch (err) {
      console.error('Add SMS units error:', err);
      res.status(500).json({ error: 'Failed to add SMS units' });
    }
  });

  /** School: wallet + SMS unit balance + current price */
  app.get('/api/sms/balance', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      const settings = await getSmsSettings();
      await ensureWallet(req.user.schoolId);
      await ensureSchoolSmsBalance(req.user.schoolId);
      const wallet = await getWallet(req.user.schoolId);
      const smsBalance = await getSchoolSmsBalance(req.user.schoolId);

      res.json({
        sms_units: smsBalance.units_available,
        unit_price_minor: settings.unit_price_minor,
        unit_price_major: fromMinorUnits(settings.unit_price_minor),
        platform_units_available: settings.units_available,
        wallet: {
          available_balance: wallet.available_balance,
          available_balance_major: fromMinorUnits(wallet.available_balance),
        },
      });
    } catch (err) {
      console.error('SMS balance error:', err);
      res.status(500).json({ error: 'Failed to load SMS balance' });
    }
  });

  /**
   * Convert school wallet money → school SMS units.
   * Money goes to platform wallet / SMS revenue. Platform inventory is NOT reduced until send.
   */
  app.post('/api/sms/purchase', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      const units = Math.round(Number(req.body?.units) || 0);
      if (units < 1) {
        return res.status(400).json({ error: 'Enter how many SMS units to buy (at least 1)' });
      }

      const settings = await getSmsSettings();
      const amountMinor = units * settings.unit_price_minor;
      const platformSchoolId = await findPlatformSchoolId(supabase);

      if (!platformSchoolId) {
        return res.status(503).json({ error: 'Platform wallet is not configured' });
      }
      if (platformSchoolId === req.user.schoolId) {
        return res.status(400).json({ error: 'Use the platform SMS page to load inventory units' });
      }

      await ensureWallet(req.user.schoolId);
      await ensureWallet(platformSchoolId);
      const wallet = await getWallet(req.user.schoolId);
      if (wallet.available_balance < amountMinor) {
        return res.status(400).json({
          error: `Not enough wallet balance. Need GHS ${fromMinorUnits(amountMinor).toFixed(2)}, you have GHS ${fromMinorUnits(wallet.available_balance).toFixed(2)}.`,
          code: 'WALLET_INSUFFICIENT',
        });
      }

      const reference = makeSmsSaleReference('smsbuy');
      const schoolName = await getSchoolName(supabase, req.user.schoolId);

      await transferBetweenWallets({
        fromSchoolId: req.user.schoolId,
        toSchoolId: platformSchoolId,
        amountMinor,
        reference,
        description: `Buy ${units} SMS units`,
        metadata: { kind: 'sms_unit_purchase', units },
      });

      const result = await creditSchoolSmsPurchase({
        schoolId: req.user.schoolId,
        schoolName,
        units,
        amountMinor,
        reference,
      });

      res.json({
        success: true,
        units_purchased: units,
        amount_minor: amountMinor,
        amount_major: fromMinorUnits(amountMinor),
        sms_units: result.school_balance.units_available,
        settings: formatSmsSettings(result.settings),
        reference,
      });
    } catch (err) {
      console.error('SMS purchase error:', err);
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to buy SMS units' });
    }
  });

  /** Quote for a broadcast — checks school prepaid units + platform inventory */
  app.post('/api/sms/quote', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      const {
        message = '',
        sendMode = 'Group',
        recipients = 'Parents',
        recipientPhone = '',
      } = req.body || {};

      if (!String(message).trim()) {
        return res.status(400).json({ error: 'Message is required to calculate SMS cost' });
      }

      const settings = await getSmsSettings();
      const recipientCount = await countSmsRecipients(supabase, req.user.schoolId, {
        sendMode,
        recipients,
        recipientPhone,
      });

      if (recipientCount < 1) {
        return res.status(400).json({
          error:
            sendMode === 'Individual'
              ? 'Enter a recipient phone number'
              : 'No recipients found for this group. Add students/staff (and parent phones where possible).',
        });
      }

      const quote = buildSmsQuote({
        message,
        recipientCount,
        unitPriceMinor: settings.unit_price_minor,
      });

      await ensureSchoolSmsBalance(req.user.schoolId);
      const schoolSms = await getSchoolSmsBalance(req.user.schoolId);
      await ensureWallet(req.user.schoolId);
      const wallet = await getWallet(req.user.schoolId);

      const schoolHasUnits = schoolSms.units_available >= quote.units_required;
      const platformHasUnits = settings.units_available >= quote.units_required;

      res.json({
        quote: {
          ...quote,
          amount_major: fromMinorUnits(quote.amount_minor),
          unit_price_major: fromMinorUnits(quote.unit_price_minor),
        },
        school_sms_units: schoolSms.units_available,
        school_wallet: {
          available_balance: wallet.available_balance,
          available_balance_major: fromMinorUnits(wallet.available_balance),
        },
        platform: {
          units_available: settings.units_available,
        },
        school_has_units: schoolHasUnits,
        platform_has_units: platformHasUnits,
        can_send: schoolHasUnits && platformHasUnits,
        blockers: [
          !schoolHasUnits
            ? `Not enough school SMS units. Need ${quote.units_required}, you have ${schoolSms.units_available}. Convert wallet money to SMS units first.`
            : null,
          !platformHasUnits
            ? `Platform SMS units are low. Need ${quote.units_required}, available ${settings.units_available}. Contact super admin.`
            : null,
        ].filter(Boolean),
      });
    } catch (err) {
      console.error('SMS quote error:', err);
      res.status(500).json({ error: 'Failed to calculate SMS cost' });
    }
  });
}

/**
 * Consume prepaid school units + platform inventory (money already paid when units were bought).
 */
export async function settleSmsPayment({
  supabase,
  schoolId,
  schoolName,
  message,
  sendMode,
  recipients,
  recipientPhone,
}) {
  const settings = await getSmsSettings();
  const recipientCount = await countSmsRecipients(supabase, schoolId, {
    sendMode,
    recipients,
    recipientPhone,
  });

  if (recipientCount < 1) {
    const err = new Error('No SMS recipients found');
    err.status = 400;
    throw err;
  }

  const quote = buildSmsQuote({
    message,
    recipientCount,
    unitPriceMinor: settings.unit_price_minor,
  });

  const reference = makeSmsSaleReference('smsuse');
  const result = await consumeSchoolAndPlatformUnits({
    schoolId,
    schoolName,
    units: quote.units_required,
    recipientsCount: quote.recipients_count,
    segments: quote.segments,
    reference,
    messagePreview: message,
  });

  return {
    reference,
    quote: {
      ...quote,
      amount_major: fromMinorUnits(quote.amount_minor),
      unit_price_major: fromMinorUnits(quote.unit_price_minor),
    },
    school_sms_units: result.school_balance.units_available,
    settings: formatSmsSettings(result.settings),
  };
}
