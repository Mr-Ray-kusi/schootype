import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { QrCode, CheckCircle, XCircle, Scan } from 'lucide-react';

const Scanner = () => {
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const lastKeytimeRef = useRef(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (barcodeValue = null) => {
    const valueToSubmit = barcodeValue || barcode;
    if (!valueToSubmit.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await axios.post('/api/attendance/mark', { barcode: valueToSubmit });
      setResult(response.data);
      setBarcode('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  const detectBarcodeEnd = (currentBarcode) => {
    // Clear previous timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    // Barcode scanners typically send data very fast (within 50ms between characters)
    // If we haven't received input for 100ms, consider the scan complete
    scanTimeoutRef.current = setTimeout(() => {
      if (currentBarcode.trim().length > 5) {
        handleSubmit(currentBarcode);
      }
    }, 100);
  };


  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Attendance Scanner</h1>
          <p className="text-gray-600 mt-2">Scan or enter barcode to mark attendance</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Barcode Input
              </label>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={barcode}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setBarcode(newValue);
                    lastKeytimeRef.current = Date.now();
                    detectBarcodeEnd(newValue);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && barcode.trim()) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  onBlur={() => inputRef.current?.focus()}
                  placeholder="Scan or type barcode here... (auto-detects scanner)"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={loading || !barcode}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Scan className="w-5 h-5" />
                  {loading ? 'Processing...' : 'Mark'}
                </button>
              </div>
            </div>
          </form>

          {/* Example barcodes for testing */}
          <div className="mt-8 pt-6 border-t">
            <p className="text-sm text-gray-600 mb-3">Quick Test Barcodes (Click to use):</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setBarcode('TEST-STUDENT-001');
                  setTimeout(() => handleSubmit('TEST-STUDENT-001'), 50);
                }}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Student Test
              </button>
              <button
                onClick={() => {
                  setBarcode('TEST-STAFF-001');
                  setTimeout(() => handleSubmit('TEST-STAFF-001'), 50);
                }}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Staff Test
              </button>
              <button
                onClick={() => {
                  setBarcode('TEST-NONSTAFF-001');
                  setTimeout(() => handleSubmit('TEST-NONSTAFF-001'), 50);
                }}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Non-Staff Test
              </button>
            </div>
          </div>
        </div>

        {/* Result Display */}
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

        {/* Error Display */}
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

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">How to Use:</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• Scan the barcode from student/staff ID card using a barcode scanner</li>
            <li>• Or manually type the barcode number in the input field above</li>
            <li>• System will automatically identify if it's a student, staff, or non-staff</li>
            <li>• Attendance will be marked for today with current timestamp</li>
            <li>• Each person can only be marked once per day</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </Layout>
  );
};

export default Scanner;