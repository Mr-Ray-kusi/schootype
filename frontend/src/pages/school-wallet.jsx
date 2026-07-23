import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';

const formatGhs = (value) =>
  `GHS ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SchoolWallet = () => {
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

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) || null,
    [accounts, accountId]
  );

  const loadWallet = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/wallet');
      setWallet(data.wallet);
      setAccounts(data.accounts || []);
      setTransactions(data.transactions || []);
      setPaystack(data.paystack || { configured: false });
      const preferred =
        data.accounts?.find((a) => a.is_default)?.id || data.accounts?.[0]?.id || '';
      setAccountId((prev) => prev || preferred);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, []);

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
    setMomoHint('');
    try {
      const callbackUrl = `${window.location.origin}/school-wallet`;
      const { data } = await axios.post('/api/wallet/deposit', {
        account_id: accountId,
        amount: value,
        callback_url: callbackUrl,
      });

      if (data.mode === 'mobile_money') {
        setMomoHint(data.display_text || 'Approve the MoMo prompt on your phone.');
        toast.success('MoMo prompt sent — approve on your phone');
        const reference = data.reference;
        // Poll verification a few times while customer authorizes offline
        for (let i = 0; i < 8; i += 1) {
          await new Promise((r) => setTimeout(r, 4000));
          const verified = await axios.post(`/api/wallet/verify/${encodeURIComponent(reference)}`);
          if (verified.data.transaction?.status === 'success') {
            toast.success('Deposit credited to wallet');
            setAmount('');
            setMomoHint('');
            await loadWallet();
            return;
          }
          if (verified.data.transaction?.status === 'failed') {
            toast.error('Deposit failed or timed out');
            await loadWallet();
            return;
          }
        }
        toast('Still waiting for MoMo approval. Refresh later or check transactions.', { icon: '⏳' });
        await loadWallet();
        return;
      }

      if (data.authorization_url) {
        toast.success('Redirecting to Paystack…');
        window.location.href = data.authorization_url;
        return;
      }

      toast.error('Could not start deposit');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Deposit failed');
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
        reason: 'School wallet withdrawal',
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

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">School Wallet</h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Hold school funds on the system, load money from a saved bank/MoMo account, or withdraw to that account.
            </p>
          </div>
          <Link
            to="/bank-settings"
            className="inline-flex items-center justify-center rounded-full border border-slate-600 bg-slate-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Bank Settings
          </Link>
        </div>

        {!paystack.configured && (
          <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            Add your Paystack test/live keys to <code>backend/.env</code> to enable deposits and withdrawals.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-wide text-slate-300">Available balance</p>
            <p className="mt-4 text-3xl font-semibold text-white">
              {loading ? '…' : formatGhs(wallet?.available_balance_major)}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-wide text-slate-300">Pending</p>
            <p className="mt-4 text-3xl font-semibold text-white">
              {loading ? '…' : formatGhs(wallet?.pending_balance_major)}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-wide text-slate-300">Currency</p>
            <p className="mt-4 text-3xl font-semibold text-white">{paystack.currency || 'GHS'}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Load or withdraw</h2>
            <p className="mt-1 text-sm text-slate-300">
              Pick a saved account from Bank Settings, enter an amount, then deposit (load) or withdraw.
            </p>
          </div>

          {!accounts.length ? (
            <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-900 px-4 py-8 text-center">
              <p className="text-slate-300">No bank/MoMo accounts saved yet.</p>
              <Link to="/bank-settings" className="mt-4 inline-flex rounded-full bg-primary-600 px-5 py-2 text-sm text-white">
                Add bank settings
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Account</label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {(account.label || account.bank_name || account.type) +
                          ` · ${account.account_number}` +
                          (account.is_default ? ' (default)' : '')}
                      </option>
                    ))}
                  </select>
                  {selectedAccount && (
                    <p className="mt-2 text-xs text-slate-400">
                      {selectedAccount.type === 'mobile_money' ? 'MoMo' : 'Bank'} · {selectedAccount.account_name}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Amount (GHS)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="100.00"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {momoHint && (
                <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                  {momoHint}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleDeposit}
                  className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {busy ? 'Processing…' : 'Load money (deposit)'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleWithdraw}
                  className="rounded-full bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-60"
                >
                  {busy ? 'Processing…' : 'Withdraw to account'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white">Recent transactions</h2>
          <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-slate-700 text-slate-300">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Reference</th>
                </tr>
              </thead>
              <tbody>
                {!transactions.length ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                      No wallet activity yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, index) => (
                    <tr key={tx.id} className={index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'}>
                      <td className="px-6 py-4">{new Date(tx.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 capitalize">{tx.type}</td>
                      <td className="px-6 py-4">{formatGhs(tx.amount_major)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs capitalize ${
                            tx.status === 'success'
                              ? 'bg-emerald-600 text-white'
                              : tx.status === 'failed'
                                ? 'bg-rose-600 text-white'
                                : 'bg-amber-600 text-white'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{tx.reference}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SchoolWallet;
