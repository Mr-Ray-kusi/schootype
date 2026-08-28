import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import QRCode from 'react-qr-code';
import { QrCode, CheckCircle, XCircle, Scan, Link2, Copy, ExternalLink, RefreshCw, Smartphone } from 'lucide-react';
import { extractAttendanceCode } from '../utils/studentIdQr';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/authcontext';
import { ConsoleHeader, ConsoleButton, consoleFieldClass } from '../components/consoleUi';

const Scanner = () => {
  const { school } = useAuth();
  const [scanCode, setScanCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [scannerToken, setScannerToken] = useState(null);
  const [linkLoading, setLinkLoading] = useState(true);
  const inputRef = useRef(null);
  const scanTimeoutRef = useRef(null);

  const mobileScannerUrl = scannerToken
    ? `${window.location.origin}/scan/${scannerToken}`
    : '';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const fetchScannerLink = async () => {
      try {
        const response = await axios.get('/api/scanner/link');
        setScannerToken(response.data.token);
      } catch (err) {
        console.error('Failed to load scanner link:', err);
      } finally {
        setLinkLoading(false);
      }
    };

    fetchScannerLink();
  }, []);

  const handleSubmit = async (codeValue = null) => {
    const raw = codeValue || scanCode;
    const valueToSubmit = extractAttendanceCode(raw);
    if (!valueToSubmit) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await axios.post('/api/attendance/mark', { qrCode: valueToSubmit });
      setResult(response.data);
      setScanCode('');
    } catch (err) {
      if (err.offlineQueued) {
        setResult({ message: 'Saved offline — will sync when online', user: { name: valueToSubmit, type: 'queued' } });
        setScanCode('');
        return;
      }
      setError(err.response?.data?.error || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  const detectScanEnd = (currentCode) => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    scanTimeoutRef.current = setTimeout(() => {
      if (currentCode.trim().length > 5) {
        handleSubmit(currentCode);
      }
    }, 100);
  };

  const copyLink = async () => {
    if (!mobileScannerUrl) return;
    try {
      await navigator.clipboard.writeText(mobileScannerUrl);
      toast.success('Scanner link copied!');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const regenerateLink = async () => {
    const confirmed = window.confirm(
      'Create a new scanner link? The current link will stop working on all phones until you share the new one.'
    );
    if (!confirmed) return;

    try {
      const response = await axios.post('/api/scanner/regenerate');
      setScannerToken(response.data.token);
      toast.success('New scanner link generated — old link is now invalid');
    } catch {
      toast.error('Failed to regenerate link');
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <ConsoleHeader
        title="Attendance Scanner"
        subtitle="Open the phone link at the gate, or type/scan a code here."
      />

      <div className="rounded-2xl border border-[#e6ebf4] bg-white p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-[#2f6eff] p-2">
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-base font-semibold text-[#111827] sm:text-lg">Phone scanner</h2>
        </div>

        {linkLoading ? (
          <p className="text-sm text-[#6b7280]">Loading scanner link...</p>
        ) : mobileScannerUrl ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="min-w-0 space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-[#d7deea] bg-[#f8fafc] p-3">
                <Link2 className="h-5 w-5 shrink-0 text-[#2f6eff]" />
                <input
                  type="text"
                  readOnly
                  value={mobileScannerUrl}
                  className="min-w-0 flex-1 truncate bg-transparent text-sm text-[#111827] outline-none"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <ConsoleButton onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                  Copy
                </ConsoleButton>
                <a
                  href={mobileScannerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#d7deea] bg-white px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#f8fafc]"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
                <ConsoleButton variant="ghost" onClick={regenerateLink}>
                  <RefreshCw className="h-4 w-4" />
                  New link
                </ConsoleButton>
              </div>
              {school?.name && (
                <p className="text-xs text-[#6b7280]">
                  Unique to <span className="font-medium text-[#111827]">{school.name}</span>.
                </p>
              )}
            </div>
            <div className="mx-auto rounded-xl border border-[#e6ebf4] bg-white p-3">
              <QRCode value={mobileScannerUrl} size={132} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#ff6a3c]">Could not load scanner link. Refresh the page.</p>
        )}
      </div>

      <div className="rounded-2xl border border-[#e6ebf4] bg-white p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <QrCode className="h-5 w-5 text-[#2f6eff]" />
          <h2 className="text-base font-semibold text-[#111827]">Desktop / USB scanner</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-3"
        >
          <label className="block text-sm font-medium text-[#374151]">QR code input</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={inputRef}
              type="text"
              value={scanCode}
              onChange={(e) => {
                const newValue = e.target.value;
                setScanCode(newValue);
                detectScanEnd(newValue);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && scanCode.trim()) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Scan or paste QR code value"
              className={`min-h-[48px] w-full flex-1 ${consoleFieldClass} text-base`}
              autoComplete="off"
            />
            <ConsoleButton
              onClick={() => handleSubmit()}
              disabled={loading || !scanCode}
              className="min-h-[48px] sm:w-auto"
            >
              <Scan className="h-5 w-5" />
              {loading ? 'Processing…' : 'Mark'}
            </ConsoleButton>
          </div>
        </form>
      </div>

      {result && (
        <div className="rounded-2xl border border-[#e6ebf4] bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-7 w-7 shrink-0 text-[#2f6eff]" />
            <div className="min-w-0">
              <h3 className="font-semibold text-[#111827]">Attendance marked</h3>
              <p className="break-words text-sm text-[#6b7280]">
                {result.message} at {new Date().toLocaleTimeString()}
              </p>
              <p className="mt-1 text-xs text-[#6b7280]">
                {result.user?.type} · {result.user?.name}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-[#ff6a3c]/30 bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-7 w-7 shrink-0 text-[#ff6a3c]" />
            <div>
              <h3 className="font-semibold text-[#111827]">Error</h3>
              <p className="text-sm text-[#6b7280]">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scanner;
