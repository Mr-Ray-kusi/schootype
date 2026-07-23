import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Building2,
  Clock3,
  Download,
  Landmark,
  RefreshCw,
  Smartphone,
  Wallet,
} from 'lucide-react';
import Layout from '../components/layout';
import { useAuth } from '../contexts/authcontext';

const formatGhs = (value) =>
  `GHS ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const escapeCsv = (value) => {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const downloadWalletCsv = (rows, filename) => {
  const header = ['Date', 'Type', 'Amount (GHS)', 'Status', 'Channel', 'Reference', 'Description'];
  const lines = [
    header.join(','),
    ...rows.map((tx) =>
      [
        escapeCsv(tx.created_at ? new Date(tx.created_at).toLocaleString() : ''),
        escapeCsv(tx.type || ''),
        escapeCsv(Number(tx.amount_major ?? 0).toFixed(2)),
        escapeCsv(tx.status || ''),
        escapeCsv(tx.channel || ''),
        escapeCsv(tx.reference || ''),
        escapeCsv(tx.description || ''),
      ].join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const fieldClass =
  'w-full rounded-xl border border-slate-600/80 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-primary-500/60 focus:ring-2 focus:ring-primary-500/30';

const statusStyles = {
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  failed: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
  pending: 'bg-amber-500/15 text-amber-200 border-amber-500/25',
  processing: 'bg-sky-500/15 text-sky-200 border-sky-500/25',
};

const SchoolWallet = () => {
  const { isSuperAdmin } = useAuth();
  const bankSettingsPath = isSuperAdmin ? '/super-admin/bank-settings' : '/bank-settings';
  const title = isSuperAdmin ? 'Platform Wallet' : 'School Wallet';
  const [searchParams, setSearchParams] = useSearchParams();
  const [wallet, setWallet] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [paystack, setPaystack] = useState({ configured: false, currency: 'GHS' });
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [momoHint, setMomoHint] = useState('');
  const [action, setAction] = useState('deposit');
  const [downloading, setDownloading] = useState(false);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) || null,
    [accounts, accountId]
  );

  const momoAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'mobile_money'),
    [accounts]
  );

  const selectableAccounts = action === 'deposit' ? momoAccounts : accounts;

  useEffect(() => {
    if (!selectableAccounts.length) {
      setAccountId('');
      return;
    }
    const stillValid = selectableAccounts.some((a) => a.id === accountId);
    if (!stillValid) {
      const preferred =
        selectableAccounts.find((a) => a.is_default)?.id || selectableAccounts[0].id;
      setAccountId(preferred);
    }
  }, [action, selectableAccounts, accountId]);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/wallet');
      setWallet(data.wallet);
      setAccounts(data.accounts || []);
      setTransactions(data.transactions || []);
      setPaystack(data.paystack || { configured: false });
      const momo = (data.accounts || []).filter((a) => a.type === 'mobile_money');
      const pool = action === 'deposit' ? momo : data.accounts || [];
      const preferred = pool.find((a) => a.is_default)?.id || pool[0]?.id || '';
      setAccountId((prev) => (pool.some((a) => a.id === prev) ? prev : preferred));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, [action]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  useEffect(() => {
    const ref = searchParams.get('reference') || searchParams.get('trxref');
    if (!ref) return;

    (async () => {
      try {
        await axios.post(`/api/wallet/verify/${encodeURIComponent(ref)}`);
        toast.success('Deposit verified');
        await loadWallet();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Could not verify deposit');
      } finally {
        searchParams.delete('reference');
        searchParams.delete('trxref');
        setSearchParams(searchParams, { replace: true });
      }
    })();
  }, [searchParams, setSearchParams, loadWallet]);

  const handleDeposit = async () => {
    if (!momoAccounts.length) {
      toast.error('Add a MoMo account in Bank Settings first');
      return;
    }
    if (!accountId) {
      toast.error('Select a MoMo account');
      return;
    }
    if (selectedAccount?.type !== 'mobile_money') {
      toast.error('Load money works with MoMo only');
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 1) {
      toast.error('Enter an amount of at least 1.00');
      return;
    }

    setBusy(true);
    setMomoHint('');
    try {
      const { data } = await axios.post('/api/wallet/deposit', {
        account_id: accountId,
        amount: value,
      });

      if (data.status === 'success') {
        toast.success('Deposit credited to wallet');
        setAmount('');
        setMomoHint('');
        await loadWallet();
        return;
      }

      const hint =
        data.display_text ||
        'Approve the MoMo payment prompt on your phone to complete this deposit.';
      setMomoHint(hint);
      toast.success('Payment sent — confirm on your phone');

      const reference = data.reference;
      for (let i = 0; i < 15; i += 1) {
        await new Promise((r) => setTimeout(r, 4000));
        const verified = await axios.post(`/api/wallet/verify/${encodeURIComponent(reference)}`);
        if (verified.data.transaction?.status === 'success') {
          toast.success('Payment confirmed — wallet credited');
          setAmount('');
          setMomoHint('');
          await loadWallet();
          return;
        }
        if (verified.data.transaction?.status === 'failed') {
          toast.error('Payment failed or was declined');
          setMomoHint('');
          await loadWallet();
          return;
        }
      }
      toast('Still waiting for phone confirmation. Keep this page open or refresh later.', {
        icon: '⏳',
      });
      await loadWallet();
    } catch (err) {
      const raw = err.response?.data?.error || err.response?.data?.message || '';
      // Paystack's normal MoMo start message — treat as prompt sent, not failure
      if (/charge attempted/i.test(String(raw))) {
        setMomoHint(
          'A payment prompt was sent to your MoMo number. Approve it on your phone to complete the deposit.'
        );
        toast.success('Payment sent — confirm on your phone');
        await loadWallet();
        return;
      }
      toast.error(raw || 'Deposit failed');
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!accounts.length) {
      toast.error('Add a bank or MoMo account in Bank Settings first');
      return;
    }
    if (!accountId) {
      toast.error('Select an account');
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 1) {
      toast.error('Enter an amount of at least 1.00');
      return;
    }

    setBusy(true);
    try {
      const { data } = await axios.post('/api/wallet/withdraw', {
        account_id: accountId,
        amount: value,
        reason: isSuperAdmin ? 'Platform wallet withdrawal' : 'School wallet withdrawal',
      });
      toast.success(data.status === 'success' ? 'Withdrawal completed' : 'Withdrawal submitted');
      setAmount('');
      await loadWallet();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Withdrawal failed');
      await loadWallet();
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadRecords = async (filter = 'all') => {
    setDownloading(true);
    try {
      let rows = transactions;
      try {
        const { data } = await axios.get('/api/wallet/transactions');
        if (Array.isArray(data.transactions) && data.transactions.length) {
          rows = data.transactions;
        }
      } catch {
        // Fall back to already-loaded recent transactions
      }

      if (filter === 'deposit') {
        rows = rows.filter((tx) => tx.type === 'deposit');
      } else if (filter === 'withdrawal') {
        rows = rows.filter((tx) => tx.type === 'withdrawal');
      }

      if (!rows.length) {
        toast.error(
          filter === 'deposit'
            ? 'No load-money records to download'
            : filter === 'withdrawal'
              ? 'No withdrawal records to download'
              : 'No wallet records to download'
        );
        return;
      }

      const stamp = new Date().toISOString().slice(0, 10);
      const label =
        filter === 'deposit' ? 'deposits' : filter === 'withdrawal' ? 'withdrawals' : 'transactions';
      const prefix = isSuperAdmin ? 'platform-wallet' : 'school-wallet';
      downloadWalletCsv(rows, `${prefix}-${label}-${stamp}.csv`);
      toast.success(`Downloaded ${rows.length} record${rows.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to download records');
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = () => {
    if (action === 'deposit') handleDeposit();
    else handleWithdraw();
  };

  return (
    <Layout>
      <div className="relative min-h-[calc(100vh-3rem)] overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 70% 45% at 0% 0%, rgba(16, 185, 129, 0.16), transparent 55%), radial-gradient(ellipse 55% 40% at 100% 10%, rgba(14, 165, 233, 0.14), transparent 50%)',
          }}
        />

        <header className="mb-10 animate-[fadeIn_0.45s_ease-out]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
                Finance
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
                {title}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-slate-300">
                {isSuperAdmin
                  ? 'Load funds with MoMo via Paystack — confirm on your phone. Withdraw to MoMo or bank when needed.'
                  : 'Load school funds with MoMo via Paystack — confirm on your phone. Withdraw to MoMo or bank when needed.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-start">
              <button
                type="button"
                onClick={loadWallet}
                disabled={loading || busy}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/70 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <Link
                to={bankSettingsPath}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-900/30 transition hover:bg-primary-500"
              >
                <Landmark className="h-4 w-4" />
                Bank Settings
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            {isSuperAdmin ? (
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${
                  paystack.configured
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    paystack.configured ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                {paystack.configured ? 'Paystack ready' : 'Paystack not configured'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                MoMo deposits available
              </span>
            )}
            <span className="text-slate-400">{paystack.currency || 'GHS'}</span>
          </div>
        </header>

        <div className="space-y-10">
          <div className="grid items-stretch gap-6 lg:grid-cols-2 lg:gap-8">
            <section className="animate-[fadeIn_0.55s_ease-out]">
              <div className="flex h-full min-h-[220px] flex-col justify-between overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-slate-900/80 to-slate-950 p-6 md:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
                      Available balance
                    </p>
                    <p className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
                      {loading ? '—' : formatGhs(wallet?.available_balance_major)}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                    <Wallet className="h-6 w-6" />
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-400">
                      <Clock3 className="h-3.5 w-3.5" />
                      Pending
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-100">
                      {loading ? '—' : formatGhs(wallet?.pending_balance_major)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Currency</p>
                    <p className="mt-2 text-lg font-semibold text-slate-100">
                      {paystack.currency || 'GHS'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="animate-[fadeIn_0.55s_ease-out]">
              <div className="flex h-full min-h-[220px] flex-col rounded-3xl border border-slate-700/80 bg-slate-900/50 p-6 md:p-8">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Recent activity
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Deposits and withdrawals on this wallet.
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {transactions.length} record{transactions.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={downloading || (!transactions.length && !loading)}
                    onClick={() => handleDownloadRecords('all')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {downloading ? 'Preparing…' : 'Download all'}
                  </button>
                  <button
                    type="button"
                    disabled={downloading}
                    onClick={() => handleDownloadRecords('deposit')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    Loads
                  </button>
                  <button
                    type="button"
                    disabled={downloading}
                    onClick={() => handleDownloadRecords('withdrawal')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary-500/30 bg-primary-500/10 px-3 py-1.5 text-xs font-medium text-primary-200 transition hover:bg-primary-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowUpFromLine className="h-3.5 w-3.5" />
                    Withdrawals
                  </button>
                </div>

                <div className="mt-5 flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: '280px' }}>
                  {loading ? (
                    <div className="space-y-3">
                      {[0, 1].map((i) => (
                        <div
                          key={i}
                          className="h-16 animate-pulse rounded-2xl border border-slate-700/60 bg-slate-800/40"
                        />
                      ))}
                    </div>
                  ) : !transactions.length ? (
                    <div className="flex h-full min-h-[140px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-600 bg-slate-950/30 px-4 py-8 text-center">
                      <Wallet className="h-7 w-7 text-slate-500" />
                      <p className="mt-3 text-sm font-medium text-slate-300">No activity yet</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Load money to see your first transaction.
                      </p>
                    </div>
                  ) : (
                    transactions.map((tx) => {
                      const isDeposit = tx.type === 'deposit';
                      const style = statusStyles[tx.status] || statusStyles.pending;
                      return (
                        <article
                          key={tx.id}
                          className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-3.5 transition hover:border-slate-500/80"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                isDeposit
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-primary-500/15 text-primary-300'
                              }`}
                            >
                              {isDeposit ? (
                                <ArrowDownToLine className="h-4 w-4" />
                              ) : (
                                <ArrowUpFromLine className="h-4 w-4" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold capitalize text-white">
                                  {tx.type}
                                </h3>
                                <p
                                  className={`text-sm font-semibold ${
                                    isDeposit ? 'text-emerald-300' : 'text-slate-100'
                                  }`}
                                >
                                  {isDeposit ? '+' : '−'}
                                  {formatGhs(tx.amount_major)}
                                </p>
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${style}`}
                                >
                                  {tx.status}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {new Date(tx.created_at).toLocaleString()}
                                </span>
                              </div>
                              <p className="mt-1.5 truncate font-mono text-[10px] text-slate-500">
                                {tx.reference}
                              </p>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </div>

          <section className="animate-[fadeIn_0.7s_ease-out] border-t border-slate-700/80 pt-8">
            <h2 className="text-lg font-semibold text-white">Move money</h2>
            <p className="mt-1 text-sm text-slate-400">
              Load money with MoMo only — Paystack sends a prompt and you confirm on your phone.
              Withdrawals can go to MoMo or bank.
            </p>

            {(action === 'deposit' ? !momoAccounts.length : !accounts.length) ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-600 bg-slate-950/30 px-6 py-12 text-center">
                <Smartphone className="mx-auto h-8 w-8 text-slate-500" />
                <p className="mt-4 text-sm font-medium text-slate-300">
                  {action === 'deposit' ? 'No MoMo account yet' : 'No funding account yet'}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {action === 'deposit'
                    ? 'Save a Mobile Money account in Bank Settings before loading money.'
                    : 'Save a MoMo or bank account before withdrawing.'}
                </p>
                <Link
                  to={bankSettingsPath}
                  className="mt-5 inline-flex rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-500"
                >
                  Open Bank Settings
                </Link>
              </div>
            ) : (
              <div className="mt-6 max-w-3xl space-y-5">
                <div
                  role="tablist"
                  aria-label="Wallet action"
                  className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-700 bg-slate-950/50 p-1.5"
                >
                  {[
                    {
                      id: 'deposit',
                      label: 'Load money',
                      hint: 'MoMo only · confirm on phone',
                      icon: ArrowDownToLine,
                    },
                    {
                      id: 'withdraw',
                      label: 'Withdraw',
                      hint: 'Send to MoMo or bank',
                      icon: ArrowUpFromLine,
                    },
                  ].map((opt) => {
                    const active = action === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setAction(opt.id);
                          setMomoHint('');
                        }}
                        className={`rounded-xl px-4 py-3 text-left transition ${
                          active
                            ? 'bg-slate-800 text-white shadow-md ring-1 ring-emerald-500/35'
                            : 'text-slate-400 hover:bg-slate-900/80 hover:text-slate-200'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${active ? 'text-emerald-300' : ''}`} />
                          <span className="text-sm font-semibold">{opt.label}</span>
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">{opt.hint}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                      {action === 'deposit' ? 'MoMo account' : 'Payout account'}
                    </label>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className={fieldClass}
                    >
                      {selectableAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {(account.label || account.bank_name || account.type) +
                            ` · ${account.account_number}` +
                            (account.is_default ? ' (default)' : '')}
                        </option>
                      ))}
                    </select>
                    {selectedAccount && (
                      <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                        {selectedAccount.type === 'mobile_money' ? (
                          <Smartphone className="h-3.5 w-3.5 text-sky-300" />
                        ) : (
                          <Building2 className="h-3.5 w-3.5 text-violet-300" />
                        )}
                        {selectedAccount.type === 'mobile_money' ? 'MoMo' : 'Bank'} ·{' '}
                        {selectedAccount.account_name}
                        {action === 'deposit' &&
                          ' · Approve the Paystack prompt on this phone'}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                      Amount (GHS)
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                        GHS
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="100.00"
                        className={`${fieldClass} pl-14 text-lg font-semibold tracking-tight`}
                      />
                    </div>
                  </div>
                </div>

                {momoHint && (
                  <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                    <p className="font-medium text-sky-50">Confirm on your phone</p>
                    <p className="mt-1">{momoHint}</p>
                    {busy && (
                      <p className="mt-2 text-xs text-sky-200/80">
                        Waiting for confirmation… keep your phone nearby.
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSubmit}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[220px] ${
                    action === 'deposit'
                      ? 'bg-emerald-600 shadow-emerald-900/20 hover:bg-emerald-500'
                      : 'bg-primary-600 shadow-primary-900/20 hover:bg-primary-500'
                  }`}
                >
                  {busy ? (
                    action === 'deposit' ? 'Waiting for phone…' : 'Processing…'
                  ) : action === 'deposit' ? (
                    <>
                      <Smartphone className="h-4 w-4" />
                      Load via MoMo
                    </>
                  ) : (
                    <>
                      <ArrowUpFromLine className="h-4 w-4" />
                      Withdraw
                    </>
                  )}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Layout>
  );
};

export default SchoolWallet;
