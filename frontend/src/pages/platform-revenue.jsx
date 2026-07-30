import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../components/layout';
import axios from 'axios';
import toast from 'react-hot-toast';
import { formatMoney } from '../utils/money';
import { Wallet, ArrowDownToLine, Send } from 'lucide-react';

const ENTRY_LABELS = {
  topup: 'Top-up',
  revenue: 'Subscription revenue',
  adjustment_credit: 'Credit / refund',
  adjustment_debit: 'Debit',
  transfer_momo: 'MoMo transfer',
  transfer_bank: 'Bank transfer',
};

const PlatformRevenue = () => {
  const [wallet, setWallet] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState('');
  const [toppingUp, setToppingUp] = useState(false);

  const [sendForm, setSendForm] = useState({
    channel: 'mobile_money',
    recipientName: '',
    accountNumber: '',
    bankCode: '',
    amount: '',
    note: '',
  });
  const [banks, setBanks] = useState([]);
  const [sending, setSending] = useState(false);

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/platform/wallet');
      setWallet(data.wallet);
      setLedger(data.ledger || []);
      setPayouts(data.payouts || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load platform revenue wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBanks = useCallback(async (channel) => {
    try {
      const type = channel === 'mobile_money' ? 'mobile_money' : 'ghipss';
      const { data } = await axios.get(`/api/wallet/banks?type=${type}`);
      setBanks(data || []);
    } catch (error) {
      setBanks([]);
      toast.error(error.response?.data?.error || 'Could not load banks/telcos');
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  useEffect(() => {
    loadBanks(sendForm.channel);
    setSendForm((f) => ({ ...f, bankCode: '' }));
  }, [sendForm.channel, loadBanks]);

  const handleTopup = async (e) => {
    e.preventDefault();
    const amount = Number(topupAmount);
    if (!(amount > 0)) {
      toast.error('Enter a positive amount');
      return;
    }
    setToppingUp(true);
    try {
      const { data } = await axios.post('/api/platform/wallet/topup', { amount });
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }
      toast.error('Could not start Paystack checkout');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Top-up failed');
    } finally {
      setToppingUp(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await axios.post('/api/platform/wallet/send', {
        channel: sendForm.channel,
        recipientName: sendForm.recipientName,
        accountNumber: sendForm.accountNumber,
        bankCode: sendForm.bankCode,
        amount: Number(sendForm.amount),
        note: sendForm.note || undefined,
      });
      toast.success('Transfer submitted via Paystack');
      setSendForm((f) => ({
        ...f,
        recipientName: '',
        accountNumber: '',
        bankCode: '',
        amount: '',
        note: '',
      }));
      fetchWallet();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Transfer failed');
    } finally {
      setSending(false);
    }
  };

  const balance = wallet?.balance ?? 0;

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Wallet className="w-8 h-8 text-primary-400" />
            Platform revenue
          </h1>
          <p className="mt-3 text-slate-300">
            Your platform wallet (separate from school wallets). Subscription payments credit this balance.
            Top up with Paystack, and send to anyone via MoMo or bank.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-emerald-500/30 bg-slate-800 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-wide text-slate-300">Spendable balance</p>
            <p className="mt-4 text-4xl font-semibold text-emerald-300">
              {loading ? '…' : formatMoney(balance)}
            </p>
            <p className="mt-2 text-xs text-slate-400">{wallet?.currency || 'GHS'}</p>
          </div>

          <form
            onSubmit={handleTopup}
            className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl md:col-span-2 space-y-4"
          >
            <div className="flex items-center gap-2 text-white font-semibold">
              <ArrowDownToLine className="w-5 h-5 text-primary-400" />
              Top up revenue (Paystack)
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="number"
                min="1"
                step="0.01"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder="Amount"
                className="flex-1 rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-white"
              />
              <button
                type="submit"
                disabled={toppingUp}
                className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {toppingUp ? 'Redirecting…' : 'Top up with Paystack'}
              </button>
            </div>
          </form>
        </div>

        <form
          onSubmit={handleSend}
          className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl space-y-4"
        >
          <div className="flex items-center gap-2 text-white font-semibold">
            <Send className="w-5 h-5 text-primary-400" />
            Pay anyone (MoMo / Bank)
          </div>
          <p className="text-xs text-slate-400">
            Uses Paystack Transfers from your merchant balance. Enable Transfers in your Paystack dashboard for live mode.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Channel</label>
              <select
                value={sendForm.channel}
                onChange={(e) => setSendForm((f) => ({ ...f, channel: e.target.value }))}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-white"
              >
                <option value="mobile_money">Mobile Money (MoMo)</option>
                <option value="bank">Bank account</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                {sendForm.channel === 'mobile_money' ? 'Network' : 'Bank'}
              </label>
              <select
                required
                value={sendForm.bankCode}
                onChange={(e) => setSendForm((f) => ({ ...f, bankCode: e.target.value }))}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-white"
              >
                <option value="">Select…</option>
                {banks.map((b) => (
                  <option key={b.code || b.slug} value={b.code}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Recipient name</label>
              <input
                required
                value={sendForm.recipientName}
                onChange={(e) => setSendForm((f) => ({ ...f, recipientName: e.target.value }))}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                {sendForm.channel === 'mobile_money' ? 'Phone number' : 'Account number'}
              </label>
              <input
                required
                value={sendForm.accountNumber}
                onChange={(e) => setSendForm((f) => ({ ...f, accountNumber: e.target.value }))}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-white"
                placeholder={sendForm.channel === 'mobile_money' ? '0551234567' : 'Account number'}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Amount</label>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={sendForm.amount}
                onChange={(e) => setSendForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Note (optional)</label>
              <input
                value={sendForm.note}
                onChange={(e) => setSendForm((f) => ({ ...f, note: e.target.value }))}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-white"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={sending}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send via Paystack'}
          </button>
        </form>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4">Ledger</h2>
            {ledger.length === 0 ? (
              <p className="text-slate-300">No movements yet.</p>
            ) : (
              <ul className="space-y-3 max-h-96 overflow-y-auto">
                {ledger.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">
                        {ENTRY_LABELS[entry.entry_type] || entry.entry_type}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {entry.counterparty_name || entry.note || '—'} ·{' '}
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                    <p
                      className={`text-sm font-semibold shrink-0 ${
                        entry.direction === 'credit' ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {entry.direction === 'credit' ? '+' : '−'}
                      {formatMoney(entry.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4">Outgoing transfers</h2>
            {payouts.length === 0 ? (
              <p className="text-slate-300">No transfers yet.</p>
            ) : (
              <ul className="space-y-3 max-h-96 overflow-y-auto">
                {payouts.map((p) => (
                  <li
                    key={p.id}
                    className="flex justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">{p.person_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {p.channel || p.person_type} {p.account_hint ? `· ${p.account_hint}` : ''} ·{' '}
                        {new Date(p.paid_at).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-amber-300 shrink-0">
                      −{formatMoney(p.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PlatformRevenue;
