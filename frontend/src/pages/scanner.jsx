import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/layout';
import axios from 'axios';
import { QrCode, CheckCircle, XCircle, Scan, Link2, Copy, ExternalLink, RefreshCw, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/authcontext';

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
    const valueToSubmit = codeValue || scanCode;
    if (!valueToSubmit.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await axios.post('/api/attendance/mark', { qrCode: valueToSubmit });
      setResult(response.data);
      setScanCode('');
    } catch (err) {
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
    try {
      const response = await axios.post('/api/scanner/regenerate');
      setScannerToken(response.data.token);
      toast.success('New scanner link generated');
    } catch {
      toast.error('Failed to regenerate link');
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Attendance Scanner</h1>
          <p className="text-gray-600 mt-2">Scan QR codes from the dashboard or use a phone at the gate</p>
        </div>

        {/* Mobile scanner link */}
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200 rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-primary-600 rounded-lg">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Phone Scanner Link</h2>
              <p className="text-sm text-gray-600 mt-1">
                Open this link on a phone to scan QR codes for students, staff, and non-staff. Attendance records appear here on the admin dashboard — the phone only shows a confirmation.
              </p>
            </div>
          </div>

          {linkLoading ? (
            <p className="text-sm text-gray-500">Loading scanner link...</p>
          ) : mobileScannerUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-white rounded-lg border border-primary-200 p-3">
                <Link2 className="w-5 h-5 text-primary-600 shrink-0" />
                <input
                  type="text"
                  readOnly
                  value={mobileScannerUrl}
                  className="flex-1 text-sm text-gray-700 bg-transparent outline-none truncate"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </button>
                <a
                  href={mobileScannerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 transition-colors text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open on Phone
                </a>
                <button
                  type="button"
                  onClick={regenerateLink}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  title="Invalidate old links and create a new one"
                >
                  <RefreshCw className="w-4 h-4" />
                  New Link
                </button>
              </div>
              {school?.name && (
                <p className="text-xs text-gray-500">
                  This link is unique to <span className="font-medium">{school.name}</span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-red-600">Could not load scanner link. Refresh the page.</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center gap-2 mb-6">
            <QrCode className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Desktop Scanner</h2>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                QR Code Input
              </label>
              <div className="flex gap-2">
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
                  onBlur={() => inputRef.current?.focus()}
                  placeholder="Scan or paste QR code value here..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={loading || !scanCode}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Scan className="w-5 h-5" />
                  {loading ? 'Processing...' : 'Mark'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 animate-fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="text-lg font-semibold text-green-900">Attendance Marked Successfully!</h3>
                <p className="text-green-700">
                  {result.message} at {new Date().toLocaleTimeString()}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Type: {result.user?.type} | Name: {result.user?.name}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 animate-fade-in">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-red-600" />
              <div>
                <h3 className="text-lg font-semibold text-red-900">Error</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <h3 className="font-semibold text-primary-900 mb-2">How to Use:</h3>
          <ul className="space-y-2 text-sm text-primary-800">
            <li>• Copy the phone link and open it on a device at your school entrance</li>
            <li>• Point the phone camera at each person&apos;s QR code on their ID card</li>
            <li>• The phone shows a green confirmation when attendance is recorded</li>
            <li>• View all attendance records on the Attendance page in this dashboard</li>
            <li>• Use the desktop input above with a USB QR scanner if preferred</li>
          </ul>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </Layout>
  );
};

export default Scanner;
