import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/authcontext';
import { formatMoney } from '../utils/money';
import { Wallet, ArrowDownToLine, CreditCard, Users, UserCog, Send } from 'lucide-react';

const ENTRY_LABELS = {
  topup: 'Top-up',
  adjustment_credit: 'Manual credit',
  adjustment_debit: 'Manual debit',
  subscription: 'Subscription to platform',
  payout_staff: 'Staff payout',
  payout_non_staff: 'Non-staff payout',
  transfer_momo: 'MoMo transfer',
  transfer_bank: 'Bank transfer',
};

const WalletPage = () => {
  const { school, refreshSchool } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState('');
  const [toppingUp, setToppingUp] = useState(false);
  const [payingSub, setPayingSub] = useState(false);

  const [staffList, setStaffList] = useState([]);
  const [nonStaffList, setNonStaffList] = useState([]);
  const [payoutForm, setPayoutForm] = useState({
    personType: 'staff',
    personId: '',
    amount: '',
    note: '',
  });
  const [payingOut, setPayingOut] = useState(false);

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
      const { data } = await axios.get('/api/wallet');
      setWallet(data.wallet);
      setLedger(data.ledger || []);
      setPayouts(data.payouts || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPeople = useCallback(async () => {
    try {
      const [staffRes, nonStaffRes] = await Promise.all([
        axios.get('/api/staff').catch(() => ({ data: [] })),
        axios.get('/api/non-staff').catch(() => ({ data: [] })),
      ]);
      setStaffList(staffRes.data || []);
      setNonStaffList(nonStaffRes.data || []);
    } catch {
      /* plan may lock people APIs — payout UI still shows empty lists */
    }
  }, []);

  const loadBanks = useCallback(async (channel) => {
    try {
      const type = channel === 'mobile_money' ? 'mobile_money' : 'ghipss';
      const { data } = await axios.get(`/api/wallet/banks?type=${type}`);
      setBanks(data || []);
    } catch {
      setBanks([]);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
    fetchPeople();
  }, [fetchWallet, fetchPeople]);

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
      const { data } = await axios.post('/api/wallet/topup', { amount });
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

  const handlePaySubscription = async () => {
    setPayingSub(true);
    try {
      const { data } = await axios.post('/api/wallet/pay-subscription');
      if (data.school && refreshSchool) {
        await refreshSchool(data.school);
      } else if (refreshSchool) {
        await refreshSchool();
      }
      toast.success(`Subscription paid (${formatMoney(data.amount || school?.plan_price || 0)})`);
      setWallet(data.wallet);
      fetchWallet();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not pay from wallet');
    } finally {
      setPayingSub(false);
    }
  };

  const peopleOptions = payoutForm.personType === 'staff' ? staffList : nonStaffList;

  const handlePayout = async (e) => {
    e.preventDefault();
    setPayingOut(true);
    try {
      await axios.post('/api/wallet/payouts', {
        personType: payoutForm.personType,
        personId: payoutForm.personId,
        amount: Number(payoutForm.amount),
        note: payoutForm.note || undefined,
      });
      toast.success('Payout recorded');
      setPayoutForm((f) => ({ ...f, personId: '', amount: '', note: '' }));
      fetchWallet();
      if (refreshSchool) await refreshSchool();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Payout failed');
    } finally {
      setPayingOut(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await axios.post('/api/wallet/send', {
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
      if (refreshSchool) await refreshSchool();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Transfer failed');
    } finally {
      setSending(false);
    }
  };

  const balance = wallet?.balance ?? school?.wallet_balance ?? 0;
  const planPrice = school?.plan_price;
  const canPaySub =
    school?.payment_plan &&
    !school?.subscription_frozen &&
    planPrice != null &&
    balance >= planPrice;

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Wallet className="w-8 h-8 text-primary-400" />
            School wallet
          </h1>
          <p className="mt-3 text-slate-300">
            Top up with Paystack, pay your platform subscription, and pay staff or non-staff from this balance.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-emerald-500/30 bg-slate-800 p-5 shadow-xl md:col-span-1">
            <p className="text-sm uppercase tracking-wide text-slate-300">Available balance</p>
            <p className="mt-4 text-4xl font-semibold text-emerald-300">
              {loading ? '…' : formatMoney(balance)}
            </p>
            <p className="mt-2 text-xs text-slate-400">{wallet?.currency || school?.plan_currency || 'GHS'}</p>
          </div>

          <form
            onSubmit={handleTopup}
            className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl md:col-span-2 space-y-4"
          >
            <div className="flex items-center gap-2 text-white font-semibold">
              <ArrowDownToLine className="w-5 h-5 text-primary-400" />
              Top up with Paystack
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
                {toppingUp ? 'Redirecting…' : 'Pay with Paystack'}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-white font-semibold">
              <CreditCard className="w-5 h-5 text-primary-400" />
              Pay subscription to platform
            </div>
            <p className="text-sm text-slate-300 mt-1">
              {school?.plan_name
                ? `${school.plan_name} · ${formatMoney(planPrice || 0)}/mo`
                : 'Select a plan first'}
              {planPrice != null && balance < planPrice
                ? ` · Need ${formatMoney(planPrice - balance)} more`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handlePaySubscription}
            disabled={payingSub || !canPaySub}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {payingSub ? 'Processing…' : planPrice != null ? `Pay ${formatMoney(planPrice)} from wallet` : 'Unavailable'}
          </button>
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
            Send via Paystack Transfers. Requires enough wallet balance and Transfers enabled on your Paystack business.
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
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending…' : 'Send via Paystack'}
          </button>
        </form>

        <form
          onSubmit={handlePayout}
          className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl space-y-4"
        >
          <div className="flex items-center gap-2 text-white font-semibold">
            <Users className="w-5 h-5 text-primary-400" />
            Pay staff / non-staff (internal record)
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Type</label>
              <select
                value={payoutForm.personType}
                onChange={(e) =>
                  setPayoutForm((f) => ({ ...f, personType: e.target.value, personId: '' }))
                }
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-white"
              >
                <option value="staff">Staff</option>
                <option value="non_staff">Non-staff</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Person</label>
              <select
                required
                value={payoutForm.personId}
                onChange={(e) => setPayoutForm((f) => ({ ...f, personId: e.target.value }))}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-white"
              >
                <option value="">Select…</option>
                {peopleOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.role ? ` (${p.role})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Amount</label>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={payoutForm.amount}
                onChange={(e) => setPayoutForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Note (optional)</label>
              <input
                type="text"
                value={payoutForm.note}
                onChange={(e) => setPayoutForm((f) => ({ ...f, note: e.target.value }))}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-white"
                placeholder="e.g. March salary"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={payingOut || peopleOptions.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            <UserCog className="w-4 h-4" />
            {payingOut ? 'Paying…' : 'Pay from wallet'}
          </button>
          {peopleOptions.length === 0 && (
            <p className="text-xs text-slate-400">
              No {payoutForm.personType === 'staff' ? 'staff' : 'non-staff'} loaded. Activate your plan and add people first.
            </p>
          )}
        </form>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4">Ledger</h2>
            {loading ? (
              <p className="text-slate-300">Loading…</p>
            ) : ledger.length === 0 ? (
              <p className="text-slate-300">No wallet movements yet.</p>
            ) : (
              <ul className="space-y-3 max-h-96 overflow-y-auto">
                {ledger.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
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
            <h2 className="text-lg font-semibold text-white mb-4">Recent payouts</h2>
            {payouts.length === 0 ? (
              <p className="text-slate-300">No staff/non-staff payouts yet.</p>
            ) : (
              <ul className="space-y-3 max-h-96 overflow-y-auto">
                {payouts.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">{p.person_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {p.person_type === 'staff' ? 'Staff' : 'Non-staff'}
                        {p.person_role ? ` · ${p.person_role}` : ''} ·{' '}
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

export default WalletPage;
