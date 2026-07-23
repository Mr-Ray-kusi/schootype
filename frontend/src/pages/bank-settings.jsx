import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';

const emptyForm = {
  type: 'mobile_money',
  label: '',
  account_name: '',
  account_number: '',
  bank_code: '',
  bank_name: '',
  is_default: true,
};

const BankSettings = () => {
  const [accounts, setAccounts] = useState([]);
  const [banks, setBanks] = useState([]);
  const [momoProviders, setMomoProviders] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paystackConfigured, setPaystackConfigured] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [walletRes, bankRes, momoRes] = await Promise.all([
        axios.get('/api/wallet'),
        axios.get('/api/wallet/banks').catch(() => ({ data: { banks: [] } })),
        axios.get('/api/wallet/banks?type=mobile_money').catch(() => ({ data: { banks: [] } })),
      ]);
      setAccounts(walletRes.data.accounts || []);
      setPaystackConfigured(Boolean(walletRes.data.paystack?.configured));
      setBanks(bankRes.data.banks || []);
      setMomoProviders(momoRes.data.banks || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load bank settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const providerOptions = form.type === 'mobile_money' ? momoProviders : banks;

  const handleTypeChange = (type) => {
    setForm((prev) => ({
      ...prev,
      type,
      bank_code: '',
      bank_name: '',
      account_number: '',
      label: type === 'mobile_money' ? 'School MoMo' : 'School bank account',
    }));
  };

  const handleBankSelect = (code) => {
    const selected = providerOptions.find((b) => String(b.code) === String(code));
    setForm((prev) => ({
      ...prev,
      bank_code: code,
      bank_name: selected?.name || '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.account_name.trim() || !form.account_number.trim() || !form.bank_code) {
      toast.error('Fill in account name, number, and bank/MoMo provider');
      return;
    }

    setSaving(true);
    try {
      const { data } = await axios.post('/api/wallet/accounts', form);
      toast.success('Bank settings saved');
      if (data.warning) toast(data.warning, { icon: 'ℹ️' });
      setForm({ ...emptyForm, type: form.type, label: form.type === 'mobile_money' ? 'School MoMo' : 'School bank account' });
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await axios.patch(`/api/wallet/accounts/${id}`, { is_default: true });
      toast.success('Default account updated');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this account from bank settings?')) return;
    try {
      await axios.delete(`/api/wallet/accounts/${id}`);
      toast.success('Account removed');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Bank Settings</h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Add your school bank account or MoMo wallet. After saving, use School Wallet to load money in or withdraw out.
            </p>
          </div>
          <Link
            to="/school-wallet"
            className="inline-flex items-center justify-center rounded-full bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-500"
          >
            Open School Wallet
          </Link>
        </div>

        {!paystackConfigured && (
          <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            Paystack keys are not set yet. You can still save account details; deposits and withdrawals need
            <span className="font-medium"> PAYSTACK_SECRET_KEY </span>
            in <code className="text-amber-50">backend/.env</code>.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Add payout / funding account</h2>
              <p className="mt-1 text-sm text-slate-300">Choose Bank or MoMo, enter details, then save.</p>
            </div>

            <div className="flex gap-2">
              {[
                { id: 'mobile_money', label: 'MoMo' },
                { id: 'bank', label: 'Bank' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleTypeChange(opt.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    form.type === opt.id ? 'bg-primary-600 text-white' : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Label</label>
              <input
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                placeholder={form.type === 'mobile_money' ? 'Main school MoMo' : 'School GCB account'}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                {form.type === 'mobile_money' ? 'MoMo provider' : 'Bank'}
              </label>
              <select
                value={form.bank_code}
                onChange={(e) => handleBankSelect(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select…</option>
                {providerOptions.map((bank) => (
                  <option key={`${bank.code}-${bank.name}`} value={bank.code}>
                    {bank.name} ({bank.code})
                  </option>
                ))}
              </select>
              {!providerOptions.length && (
                <p className="mt-2 text-xs text-slate-400">
                  Provider list loads from Paystack. If empty, set your secret key or enter a known bank code manually below.
                </p>
              )}
              {!providerOptions.length && (
                <input
                  value={form.bank_code}
                  onChange={(e) => setForm((p) => ({ ...p, bank_code: e.target.value, bank_name: e.target.value }))}
                  placeholder={form.type === 'mobile_money' ? 'e.g. MTN' : 'Bank code'}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary-500"
                />
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Account name</label>
              <input
                value={form.account_name}
                onChange={(e) => setForm((p) => ({ ...p, account_name: e.target.value }))}
                placeholder="Name on account"
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                {form.type === 'mobile_money' ? 'MoMo number' : 'Account number'}
              </label>
              <input
                value={form.account_number}
                onChange={(e) => setForm((p) => ({ ...p, account_number: e.target.value }))}
                placeholder={form.type === 'mobile_money' ? '0551234567' : 'Account number'}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900"
              />
              Set as default for deposits and withdrawals
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save bank settings'}
            </button>
          </form>

          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Saved accounts</h2>
            <p className="mt-1 text-sm text-slate-300">These are the destinations and sources available in School Wallet.</p>

            {loading ? (
              <p className="mt-8 text-slate-400">Loading…</p>
            ) : !accounts.length ? (
              <p className="mt-8 rounded-2xl border border-dashed border-slate-600 bg-slate-900 px-4 py-8 text-center text-slate-400">
                No accounts yet. Add a bank or MoMo account to get started.
              </p>
            ) : (
              <ul className="mt-6 space-y-4">
                {accounts.map((account) => (
                  <li key={account.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">
                          {account.label || account.bank_name || account.type}
                          {account.is_default && (
                            <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs">Default</span>
                          )}
                        </p>
                        <p className="mt-1 text-sm text-slate-300">{account.account_name}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {account.type === 'mobile_money' ? 'MoMo' : 'Bank'} · {account.bank_name || account.bank_code} ·{' '}
                          {account.account_number}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {!account.is_default && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(account.id)}
                            className="rounded-full bg-slate-700 px-3 py-1 text-xs text-white hover:bg-slate-600"
                          >
                            Make default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(account.id)}
                          className="rounded-full bg-rose-700/80 px-3 py-1 text-xs text-white hover:bg-rose-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
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

export default BankSettings;
