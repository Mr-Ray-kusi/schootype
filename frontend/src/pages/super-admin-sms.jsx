import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Layout from '../components/layout';
import { MessageSquare, Coins, TrendingUp, Plus } from 'lucide-react';

const formatGhs = (value) =>
  `GHS ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SuperAdminSms = () => {
  const [settings, setSettings] = useState(null);
  const [sales, setSales] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unitPrice, setUnitPrice] = useState('0.05');
  const [addUnits, setAddUnits] = useState('1000');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/super-admin/sms');
      setSettings(data.settings);
      setSales(data.sales || []);
      setWallet(data.platform_wallet);
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

  const handleAddUnits = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await axios.post('/api/super-admin/sms/units', {
        units: Number(addUnits),
      });
      setSettings(data.settings);
      toast.success(`Added ${addUnits} SMS units`);
      setAddUnits('1000');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add units');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">SMS Units & Revenue</h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Load platform SMS inventory here and set the unit price. Schools convert wallet money into their own
            prepaid SMS units (that payment becomes your SMS revenue). When they broadcast, units are deducted
            from both the school balance and this platform inventory.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
            <p className="flex items-center gap-2 text-sm uppercase tracking-wide text-slate-300">
              <MessageSquare className="h-4 w-4" /> Units available
            </p>
            <p className="mt-4 text-3xl font-semibold text-white">
              {loading ? '…' : (settings?.units_available || 0).toLocaleString()}
            </p>
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
            onSubmit={handleAddUnits}
            className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl space-y-4"
          >
            <h2 className="text-lg font-semibold text-white">Load SMS units</h2>
            <p className="text-sm text-slate-400">
              Add units you purchased from your SMS provider (or inventory for testing).
            </p>
            <input
              type="number"
              min="1"
              step="1"
              value={addUnits}
              onChange={(e) => setAddUnits(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Add units
            </button>
          </form>

          <form
            onSubmit={handleSavePrice}
            className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl space-y-4"
          >
            <h2 className="text-lg font-semibold text-white">Unit price (GHS)</h2>
            <p className="text-sm text-slate-400">
              What schools pay per SMS unit (recipients × message segments).
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
                      No school SMS purchases or usage yet.
                    </td>
                  </tr>
                ) : (
                  sales.map((sale, index) => (
                    <tr key={sale.id} className={index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'}>
                      <td className="px-6 py-4 capitalize">
                        {sale.sale_type === 'purchase'
                          ? 'Unit purchase'
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
    </Layout>
  );
};

export default SuperAdminSms;
