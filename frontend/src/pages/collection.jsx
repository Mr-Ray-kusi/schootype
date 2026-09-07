import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Copy, ExternalLink, Package, RefreshCw, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/authcontext';
import QrCodeBlock, { downloadQrCodePng } from '../components/QrCodeBlock';
import { useLivePoll } from '../hooks/useLivePoll';

const fieldClass =
  'w-full rounded-xl border border-slate-600/80 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/30';

const Collection = () => {
  const { school } = useAuth();
  const qrRef = useRef(null);
  const [token, setToken] = useState('');
  const [hasUnitCode, setHasUnitCode] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unitCode, setUnitCode] = useState('');
  const [revealedCode, setRevealedCode] = useState('');

  const collectUrl = token ? `${window.location.origin}/collect/${token}` : '';

  const applySettings = (data) => {
    setToken(data.token || '');
    setHasUnitCode(Boolean(data.has_unit_code));
    setRecords(data.records || data.items || []);
  };

  const loadSettings = useCallback(async ({ silent = false } = {}) => {
    try {
      const { data } = await axios.get('/api/collection/settings');
      applySettings(data);
    } catch (err) {
      if (!silent) toast.error(err.response?.data?.error || 'Could not load collection settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useLivePoll(() => loadSettings({ silent: true }), 5000, !loading);

  const copyLink = async () => {
    if (!collectUrl) return;
    try {
      await navigator.clipboard.writeText(collectUrl);
      toast.success('Collection link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const saveUnitCode = async ({ generate = false } = {}) => {
    if (!generate && unitCode.trim().length < 4) {
      toast.error('Enter a unit code of at least 4 characters');
      return;
    }
    setSaving(true);
    try {
      const { data } = await axios.post('/api/collection/unit-code', generate ? { generate: true } : { unit_code: unitCode.trim() });
      setHasUnitCode(true);
      setRevealedCode(data.unit_code || unitCode.trim());
      setUnitCode('');
      toast.success('Unit code saved. Share it only with hall/SRC admin and assistants.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save unit code');
    } finally {
      setSaving(false);
    }
  };

  const regenerateLink = async () => {
    const confirmed = window.confirm(
      'Create a new collection QR? Printed posters with the old QR will stop working.'
    );
    if (!confirmed) return;
    try {
      const { data } = await axios.post('/api/collection/regenerate');
      setToken(data.token || '');
      setHasUnitCode(Boolean(data.has_unit_code));
      toast.success('New collection QR is ready');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not regenerate the QR');
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400">Loading collection…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Item collection</h1>
        <p className="mt-1 text-sm text-slate-400">
          One QR for every poster. After someone searches their name and taps Verify, a hall/SRC
          assistant must enter the shared unit code.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-slate-900 p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-amber-600 p-2">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white sm:text-lg">Unit code</h2>
            <p className="text-xs text-slate-400">
              Known only by the hall/SRC admin and assistants sharing the items. Recipients do not
              see this code on the QR.
            </p>
          </div>
        </div>

        {hasUnitCode ? (
          <p className="mb-3 text-sm text-emerald-200">A unit code is set. Enter a new one only if you need to rotate it.</p>
        ) : (
          <p className="mb-3 text-sm text-amber-100">Set the unit code before collection can be verified.</p>
        )}

        {revealedCode ? (
          <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-emerald-300">Share this code now</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-white">{revealedCode}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={unitCode}
            onChange={(e) => setUnitCode(e.target.value)}
            placeholder="Enter a 4–24 character unit code"
            className={fieldClass}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => saveUnitCode({ generate: false })}
            disabled={saving}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save unit code'}
          </button>
          <button
            type="button"
            onClick={() => saveUnitCode({ generate: true })}
            disabled={saving}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-600 px-4 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Generate
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/15 to-slate-900 p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-sky-600 p-2">
            <Package className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-base font-semibold text-white sm:text-lg">Shared collection QR</h2>
        </div>

        {collectUrl ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="min-w-0 space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-950/70 p-3">
                <input
                  type="text"
                  readOnly
                  value={collectUrl}
                  className="min-w-0 flex-1 truncate bg-transparent text-sm text-slate-200 outline-none"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </button>
                <a
                  href={collectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-sky-400/40 bg-slate-900 px-3 py-2 text-sm font-medium text-sky-200 hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
                <button
                  type="button"
                  onClick={regenerateLink}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <RefreshCw className="h-4 w-4" />
                  New QR
                </button>
              </div>
              {school?.name ? (
                <p className="text-xs text-slate-400">
                  Same QR for every print at <span className="font-medium text-slate-200">{school.name}</span>.
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => downloadQrCodePng(qrRef.current, `${school?.name || 'school'}-collection-qr.png`)}
                className="text-sm text-sky-300 hover:text-sky-200"
              >
                Download QR image
              </button>
            </div>
            <div ref={qrRef} className="mx-auto">
              <QrCodeBlock value={collectUrl} size={148} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-400">Could not load the collection QR. Refresh the page.</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4 sm:p-6">
        <h2 className="text-base font-semibold text-white">Collected</h2>
        <p className="mt-1 text-xs text-slate-400">{records.length} verified so far</p>
        {records.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No collections yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-700">
            {records.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{row.person_name}</p>
                  <p className="text-xs text-slate-400">
                    {row.person_type} · {row.person_label}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-slate-400">
                  {row.collected_at ? new Date(row.collected_at).toLocaleString() : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Collection;
