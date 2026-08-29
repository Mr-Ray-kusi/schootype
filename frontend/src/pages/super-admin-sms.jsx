import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { MessageSquare, Coins, TrendingUp } from 'lucide-react';

const formatGhs = (value) =>
  `GHS ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SuperAdminSms = () => {
  const [settings, setSettings] = useState(null);
  const [sales, setSales] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [provider, setProvider] = useState(null);
  const [twilioBalance, setTwilioBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unitPrice, setUnitPrice] = useState('0.05');
  const [stockForm, setStockForm] = useState({
    units: '',
    amountPaid: '',
    providerReference: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/super-admin/sms');
      setSettings(data.settings);
      setSales(data.sales || []);
      setWallet(data.platform_wallet);
      setProvider(data.provider || null);
      setTwilioBalance(data.twilio_balance || null);
      setUnitPrice(String(data.settings?.unit_price_major ?? 0.05));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load SMS inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSavePrice = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await axios.patch('/api/super-admin/sms/price', {
        unit_price: Number(unitPrice),
      });
      setSettings(data.settings);
      toast.success('SMS unit price updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update price');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadPurchasedUnits = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await axios.post('/api/super-admin/sms/provider-stock', {
        units: Number(stockForm.units),
        amount_paid: Number(stockForm.amountPaid),
        provider_reference: stockForm.providerReference.trim(),
      });
      setSettings(data.settings);
      toast.success(`Loaded ${stockForm.units} purchased Twilio units`);
      setStockForm({ units: '', amountPaid: '', providerReference: '' });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load purchased units');
    } finally {
      setSaving(false);
    }
  };

  const twilioLive = provider?.mode === 'live' && provider?.ready;

  return (
    <>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">SMS Units & Revenue</h1>
          {provider && (
            <div
              className={`mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${
                twilioLive
                  ? 'border-green-500/40 bg-green-500/10 text-green-200'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
              }`}
            >
              <span className="font-medium">Twilio: {provider.mode}</span>
              <span className="text-slate-300">· {provider.message}</span>
            </div>
          )}
          {twilioBalance && (
            <p className="mt-3 text-sm text-slate-400">
              Twilio account balance:{' '}
              <span className="font-medium text-white">
                {twilioBalance.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4,
                })}{' '}
                {twilioBalance.currency}
              </span>
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="flex items-center gap-2 text-sm uppercase tracking-wide text-slate-300">
              <MessageSquare className="h-4 w-4" /> Units available
            </p>
            <p className="mt-4 text-3xl font-semibold text-white">
              {loading ? '…' : (settings?.units_available || 0).toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-slate-400">Only stock purchased from Twilio</p>
          </div>
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="flex items-center gap-2 text-sm uppercase tracking-wide text-slate-300">
              <Coins className="h-4 w-4" /> Price / unit
            </p>
            <p className="mt-4 text-3xl font-semibold text-white">
              {loading ? '…' : formatGhs(settings?.unit_price_major)}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="flex items-center gap-2 text-sm uppercase tracking-wide text-slate-300">
              <TrendingUp className="h-4 w-4" /> SMS revenue
            </p>
            <p className="mt-4 text-3xl font-semibold text-emerald-300">
              {loading ? '…' : formatGhs(settings?.total_revenue_major)}
            </p>
            {wallet && (
              <p className="mt-2 text-xs text-slate-400">
                Platform wallet: {formatGhs(wallet.available_balance_major)}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleLoadPurchasedUnits}
            className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl space-y-4"
          >
            <h2 className="text-lg font-semibold text-white">Load purchased Twilio units</h2>
            <p className="text-sm text-slate-400">
              Buy SMS credit in Twilio, then enter the units, amount paid, and invoice or payment
              reference. Units cannot be added without a paid Twilio purchase.
            </p>
            <label className="block text-xs uppercase tracking-wide text-slate-400">
              Units bought
              <input
                type="number"
                min="1"
                step="1"
                required
                value={stockForm.units}
                onChange={(e) => setStockForm((prev) => ({ ...prev, units: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary-500"
              />
            </label>
            <label className="block text-xs uppercase tracking-wide text-slate-400">
              Amount paid to Twilio (GHS)
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={stockForm.amountPaid}
                onChange={(e) => setStockForm((prev) => ({ ...prev, amountPaid: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary-500"
              />
            </label>
            <label className="block text-xs uppercase tracking-wide text-slate-400">
              Twilio invoice / payment reference
              <input
                type="text"
                minLength={4}
                required
                value={stockForm.providerReference}
                onChange={(e) =>
                  setStockForm((prev) => ({ ...prev, providerReference: e.target.value }))
                }
                placeholder="INVxxxxxxxx or receipt number"
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary-500"
              />
            </label>
            <button
              type="submit"
              disabled={saving || !twilioLive}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              Load purchased units
            </button>
            {!twilioLive && (
              <p className="text-xs text-amber-200">
                Configure live Twilio keys (and turn off SMS_DRY_RUN) before loading units.
              </p>
            )}
          </form>

          <form
            onSubmit={handleSavePrice}
            className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl space-y-4"
          >
            <h2 className="text-lg font-semibold text-white">School price / unit (GHS)</h2>
            <p className="text-sm text-slate-400">
              This is what schools pay you per SMS unit. It is separate from what Twilio charged you.
            </p>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-60"
            >
              Save price
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white">Recent SMS sales</h2>
          <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-slate-700 text-slate-300">
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">School</th>
                  <th className="px-6 py-4">Recipients</th>
                  <th className="px-6 py-4">Units</th>
                  <th className="px-6 py-4">Paid</th>
                </tr>
              </thead>
              <tbody>
                {!sales.length ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      No Twilio stock loads or school SMS purchases yet.
                    </td>
                  </tr>
                ) : (
                  sales.map((sale, index) => (
                    <tr key={sale.id} className={index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'}>
                      <td className="px-6 py-4 capitalize">
                        {sale.sale_type === 'provider_stock'
                          ? 'Twilio purchase'
                          : sale.sale_type === 'purchase'
                            ? 'School unit purchase'
                            : sale.sale_type === 'usage'
                              ? 'Broadcast use'
                              : sale.sale_type || 'Sale'}
                      </td>
                      <td className="px-6 py-4">{new Date(sale.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4">{sale.school_name || sale.school_id}</td>
                      <td className="px-6 py-4">{sale.recipients_count || '—'}</td>
                      <td className="px-6 py-4">{sale.units}</td>
                      <td className="px-6 py-4 text-emerald-300">
                        {sale.amount_minor > 0 ? formatGhs(sale.amount_major) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default SuperAdminSms;
