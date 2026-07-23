import {
  getPaystackConfig,
  listBanks,
  resolveAccountNumber,
  createTransferRecipient,
  initializeTransaction,
  chargeMobileMoney,
  verifyTransaction,
  initiateTransfer,
  verifyPaystackSignature,
  toMinorUnits,
  fromMinorUnits,
  momoProviderFromBankCode,
} from './paystack.js';
import {
  ensureWallet,
  getWallet,
  listWalletAccounts,
  getWalletAccount,
  createWalletAccount,
  updateWalletAccount,
  deleteWalletAccount,
  createWalletTransaction,
  getWalletTransactionByReference,
  listWalletTransactions,
  updateWalletTransaction,
  creditDeposit,
  reserveWithdrawal,
  completeWithdrawal,
  failWithdrawal,
  makeWalletReference,
} from './schoolWalletStore.js';

function formatMoney(wallet) {
  return {
    ...wallet,
    available_balance_major: fromMinorUnits(wallet.available_balance),
    pending_balance_major: fromMinorUnits(wallet.pending_balance),
  };
}

function formatTransaction(tx) {
  if (!tx) return null;
  return {
    ...tx,
    amount_major: fromMinorUnits(tx.amount),
    fee_major: fromMinorUnits(tx.fee),
  };
}

function handlePaystackError(res, err) {
  const status = err.status || 500;
  return res.status(status).json({
    error: err.message || 'Paystack request failed',
    code: err.code || 'PAYSTACK_ERROR',
    details: err.payload || undefined,
  });
}

export function registerWalletRoutes(app, { authenticateToken, enforcePlanApproval }) {
  app.get('/api/wallet', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      const schoolId = req.user.schoolId;
      const { currency } = getPaystackConfig();
      await ensureWallet(schoolId, currency);
      const [wallet, accounts, transactions] = await Promise.all([
        getWallet(schoolId),
        listWalletAccounts(schoolId),
        listWalletTransactions(schoolId, { limit: 20 }),
      ]);

      res.json({
        wallet: formatMoney(wallet),
        accounts,
        transactions: transactions.map(formatTransaction),
        paystack: {
          configured: getPaystackConfig().configured,
          public_key: getPaystackConfig().publicKey || null,
          currency: getPaystackConfig().currency,
        },
      });
    } catch (err) {
      console.error('Get wallet error:', err);
      res.status(500).json({ error: 'Failed to load wallet' });
    }
  });

  app.get('/api/wallet/banks', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      const type = req.query.type === 'mobile_money' ? 'mobile_money' : undefined;
      const { currency } = getPaystackConfig();
      const banks = await listBanks({ currency, type });
      res.json({ banks: banks || [] });
    } catch (err) {
      handlePaystackError(res, err);
    }
  });

  app.get('/api/wallet/accounts', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      const accounts = await listWalletAccounts(req.user.schoolId);
      res.json({ accounts });
    } catch (err) {
      console.error('List wallet accounts error:', err);
      res.status(500).json({ error: 'Failed to load bank settings' });
    }
  });

  app.post('/api/wallet/accounts', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      const schoolId = req.user.schoolId;
      const {
        type,
        label,
        account_name,
        account_number,
        bank_code,
        bank_name,
        is_default,
        resolve = true,
      } = req.body || {};

      if (!type || !['bank', 'mobile_money'].includes(type)) {
        return res.status(400).json({ error: 'type must be bank or mobile_money' });
      }
      if (!account_name || !account_number || !bank_code) {
        return res.status(400).json({ error: 'account_name, account_number, and bank_code are required' });
      }

      const { currency, configured } = getPaystackConfig();
      let resolvedName = account_name;
      let provider = type === 'mobile_money' ? momoProviderFromBankCode(bank_code) : null;
      let recipientCode = null;

      if (configured && type === 'bank' && resolve) {
        try {
          const resolved = await resolveAccountNumber({
            accountNumber: account_number,
            bankCode: bank_code,
          });
          if (resolved?.account_name) resolvedName = resolved.account_name;
        } catch (err) {
          // Ghana resolve may not always be available; continue with provided name
          console.warn('Account resolve skipped:', err.message);
        }
      }

      if (configured) {
        const recipientType = type === 'mobile_money' ? 'mobile_money' : 'ghipss';
        const recipient = await createTransferRecipient({
          type: recipientType,
          name: resolvedName,
          accountNumber: account_number,
          bankCode: bank_code,
          currency,
        });
        recipientCode = recipient?.recipient_code || null;
        if (type === 'mobile_money' && !provider) {
          provider = momoProviderFromBankCode(bank_code);
        }
      }

      const account = await createWalletAccount(schoolId, {
        type,
        label: label || (type === 'mobile_money' ? 'MoMo' : 'Bank account'),
        account_name: resolvedName,
        account_number: String(account_number).trim(),
        bank_code: String(bank_code).trim(),
        bank_name: bank_name || null,
        provider,
        currency,
        paystack_recipient_code: recipientCode,
        is_default: Boolean(is_default),
      });

      res.status(201).json({
        account,
        warning: configured
          ? null
          : 'Saved locally. Set PAYSTACK_SECRET_KEY to enable Paystack deposits and withdrawals.',
      });
    } catch (err) {
      if (err.code?.startsWith('PAYSTACK') || err.status) return handlePaystackError(res, err);
      console.error('Create wallet account error:', err);
      res.status(500).json({ error: 'Failed to save bank settings' });
    }
  });

  app.patch('/api/wallet/accounts/:id', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      const schoolId = req.user.schoolId;
      const account = await getWalletAccount(schoolId, req.params.id);
      if (!account) return res.status(404).json({ error: 'Account not found' });

      const patch = {};
      if (req.body.label !== undefined) patch.label = req.body.label;
      if (req.body.is_default) patch.is_default = true;

      const updated = await updateWalletAccount(schoolId, req.params.id, patch);
      res.json({ account: updated });
    } catch (err) {
      console.error('Update wallet account error:', err);
      res.status(500).json({ error: 'Failed to update bank settings' });
    }
  });

  app.delete('/api/wallet/accounts/:id', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      const deleted = await deleteWalletAccount(req.user.schoolId, req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Account not found' });
      res.json({ success: true });
    } catch (err) {
      console.error('Delete wallet account error:', err);
      res.status(500).json({ error: 'Failed to delete bank settings' });
    }
  });

  app.post('/api/wallet/deposit', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      const schoolId = req.user.schoolId;
      const { account_id, amount, callback_url } = req.body || {};
      const amountMajor = Number(amount);

      if (!account_id) return res.status(400).json({ error: 'account_id is required' });
      if (!Number.isFinite(amountMajor) || amountMajor < 1) {
        return res.status(400).json({ error: 'Minimum deposit is 1.00' });
      }

      const account = await getWalletAccount(schoolId, account_id);
      if (!account) return res.status(404).json({ error: 'Select a saved bank or MoMo account first' });

      const { currency, configured } = getPaystackConfig();
      if (!configured) {
        return res.status(503).json({
          error: 'Paystack is not configured. Add PAYSTACK_SECRET_KEY to backend/.env',
        });
      }

      const amountMinor = toMinorUnits(amountMajor);
      const reference = makeWalletReference('dep');
      const email = req.user.email;
      const metadata = {
        school_id: schoolId,
        account_id: account.id,
        wallet_action: 'deposit',
      };

      await createWalletTransaction(schoolId, {
        type: 'deposit',
        amount: amountMinor,
        status: 'pending',
        channel: account.type,
        account_id: account.id,
        reference,
        description: `Deposit from ${account.label || account.bank_name || account.type}`,
        metadata,
      });

      if (account.type === 'mobile_money') {
        const provider = account.provider || momoProviderFromBankCode(account.bank_code);
        try {
          const charge = await chargeMobileMoney({
            email,
            amountMinor,
            currency,
            phone: account.account_number,
            provider,
            reference,
            metadata,
          });

          await updateWalletTransaction(reference, {
            provider_reference: charge?.reference || reference,
            metadata: {
              display_text: charge?.display_text,
              paystack_status: charge?.status,
            },
          });

          return res.json({
            mode: 'mobile_money',
            reference,
            status: charge?.status || 'pay_offline',
            display_text:
              charge?.display_text ||
              'Approve the MoMo prompt on your phone to complete the deposit.',
            transaction: formatTransaction(await getWalletTransactionByReference(reference)),
          });
        } catch (momoErr) {
          console.warn('Direct MoMo charge unavailable, falling back to Paystack checkout:', momoErr.message);
          const init = await initializeTransaction({
            email,
            amountMinor,
            currency,
            reference,
            callbackUrl: callback_url || undefined,
            channels: ['mobile_money'],
            metadata: {
              ...metadata,
              momo_phone: account.account_number,
              momo_provider: provider,
            },
          });

          await updateWalletTransaction(reference, {
            provider_reference: init?.reference || reference,
            metadata: {
              authorization_url: init?.authorization_url,
              access_code: init?.access_code,
              fallback: 'checkout_mobile_money',
            },
          });

          return res.json({
            mode: 'bank',
            reference,
            authorization_url: init?.authorization_url,
            access_code: init?.access_code,
            public_key: getPaystackConfig().publicKey || null,
            transaction: formatTransaction(await getWalletTransactionByReference(reference)),
          });
        }
      }

      const init = await initializeTransaction({
        email,
        amountMinor,
        currency,
        reference,
        callbackUrl: callback_url || undefined,
        channels: ['bank', 'bank_transfer', 'card'],
        metadata,
      });

      await updateWalletTransaction(reference, {
        provider_reference: init?.reference || reference,
        metadata: {
          authorization_url: init?.authorization_url,
          access_code: init?.access_code,
        },
      });

      return res.json({
        mode: 'bank',
        reference,
        authorization_url: init?.authorization_url,
        access_code: init?.access_code,
        public_key: getPaystackConfig().publicKey || null,
        transaction: formatTransaction(await getWalletTransactionByReference(reference)),
      });
    } catch (err) {
      if (err.code?.startsWith('PAYSTACK') || err.status) return handlePaystackError(res, err);
      console.error('Deposit error:', err);
      res.status(500).json({ error: 'Failed to start deposit' });
    }
  });

  app.post('/api/wallet/withdraw', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      const schoolId = req.user.schoolId;
      const { account_id, amount, reason } = req.body || {};
      const amountMajor = Number(amount);

      if (!account_id) return res.status(400).json({ error: 'account_id is required' });
      if (!Number.isFinite(amountMajor) || amountMajor < 1) {
        return res.status(400).json({ error: 'Minimum withdrawal is 1.00' });
      }

      const account = await getWalletAccount(schoolId, account_id);
      if (!account) return res.status(404).json({ error: 'Select a saved bank or MoMo account first' });

      const { currency, configured } = getPaystackConfig();
      if (!configured) {
        return res.status(503).json({
          error: 'Paystack is not configured. Add PAYSTACK_SECRET_KEY to backend/.env',
        });
      }
      if (!account.paystack_recipient_code) {
        return res.status(400).json({
          error: 'This account has no Paystack recipient. Delete and re-add it after configuring Paystack.',
        });
      }

      const amountMinor = toMinorUnits(amountMajor);
      const reference = makeWalletReference('wdr');

      await reserveWithdrawal(schoolId, amountMinor);
      await createWalletTransaction(schoolId, {
        type: 'withdrawal',
        amount: amountMinor,
        status: 'processing',
        channel: account.type,
        account_id: account.id,
        reference,
        description: reason || `Withdrawal to ${account.label || account.bank_name || account.type}`,
        metadata: { school_id: schoolId, account_id: account.id, wallet_action: 'withdrawal' },
      });

      try {
        const transfer = await initiateTransfer({
          amountMinor,
          currency,
          recipientCode: account.paystack_recipient_code,
          reference,
          reason: reason || `School wallet withdrawal`,
        });

        await updateWalletTransaction(reference, {
          provider_reference: transfer?.transfer_code || transfer?.reference || reference,
          metadata: { paystack_status: transfer?.status },
        });

        if (transfer?.status === 'success') {
          await completeWithdrawal(reference);
        }

        return res.json({
          reference,
          status: transfer?.status || 'pending',
          wallet: formatMoney(await getWallet(schoolId)),
          transaction: formatTransaction(await getWalletTransactionByReference(reference)),
        });
      } catch (transferErr) {
        await failWithdrawal(reference, transferErr.message);
        return handlePaystackError(res, transferErr);
      }
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      if (err.code?.startsWith('PAYSTACK') || err.status) return handlePaystackError(res, err);
      console.error('Withdraw error:', err);
      res.status(500).json({ error: 'Failed to start withdrawal' });
    }
  });

  app.get('/api/wallet/transactions', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      const transactions = await listWalletTransactions(req.user.schoolId, { limit: 100 });
      res.json({ transactions: transactions.map(formatTransaction) });
    } catch (err) {
      console.error('List transactions error:', err);
      res.status(500).json({ error: 'Failed to load transactions' });
    }
  });

  app.post('/api/wallet/verify/:reference', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      const reference = req.params.reference;
      const tx = await getWalletTransactionByReference(reference);
      if (!tx || tx.school_id !== req.user.schoolId) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (tx.type === 'deposit' && tx.status !== 'success') {
        const verified = await verifyTransaction(reference);
        if (verified?.status === 'success') {
          await creditDeposit(reference);
        } else if (verified?.status === 'failed' || verified?.status === 'abandoned') {
          await updateWalletTransaction(reference, { status: 'failed' });
        }
      }

      res.json({
        wallet: formatMoney(await getWallet(req.user.schoolId)),
        transaction: formatTransaction(await getWalletTransactionByReference(reference)),
      });
    } catch (err) {
      if (err.code?.startsWith('PAYSTACK') || err.status) return handlePaystackError(res, err);
      console.error('Verify transaction error:', err);
      res.status(500).json({ error: 'Failed to verify transaction' });
    }
  });

  // Paystack webhooks — no JWT; signature verified with secret key
  app.post('/api/webhooks/paystack', async (req, res) => {
    try {
      const signature = req.headers['x-paystack-signature'];
      const rawBody = JSON.stringify(req.body);
      if (!verifyPaystackSignature(rawBody, signature)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const event = req.body?.event;
      const data = req.body?.data || {};
      const reference = data.reference || data.transfer_code;

      if (event === 'charge.success' || event === 'transaction.success') {
        const ref = data.reference;
        if (ref) await creditDeposit(ref);
      }

      if (event === 'transfer.success') {
        const ref = data.reference;
        if (ref) await completeWithdrawal(ref);
      }

      if (event === 'transfer.failed' || event === 'transfer.reversed') {
        const ref = data.reference;
        if (ref) await failWithdrawal(ref, data.reason || event);
      }

      // unused but keeps linter happy if reference used in future logging
      void reference;

      res.sendStatus(200);
    } catch (err) {
      console.error('Paystack webhook error:', err);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });
}
