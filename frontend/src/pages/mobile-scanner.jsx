import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { CheckCircle, XCircle, Camera, Loader2 } from 'lucide-react';

const SCAN_COOLDOWN_MS = 2500;

const MobileScanner = () => {
  const { token } = useParams();
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const scanLockRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const mountedRef = useRef(true);

  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);
  const [invalidLink, setInvalidLink] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const stopScanner = () => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    readerRef.current?.reset();
    readerRef.current = null;
  };

  const markAttendance = async (attendanceCode) => {
    scanLockRef.current = true;
    stopScanner();

    try {
      const response = await axios.post(`/api/scanner/mark/${token}`, { qrCode: attendanceCode });
      if (!mountedRef.current) return;
      setFeedback({
        type: 'success',
        title: 'Recorded!',
        message: response.data.message,
        name: response.data.user?.name,
        userType: response.data.user?.type,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setFeedback({
        type: 'error',
        title: 'Not recorded',
        message: err.response?.data?.error || 'Could not mark attendance',
      });
    }

    resumeTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      scanLockRef.current = false;
      setFeedback(null);
      startScanner();
    }, SCAN_COOLDOWN_MS);
  };

  const startScanner = async () => {
    if (!videoRef.current || scanLockRef.current || !mountedRef.current) return;

    setCameraError(null);

    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const backCamera =
        devices.find((d) => /back|rear|environment/i.test(d.label)) ||
        devices[devices.length - 1];

      await reader.decodeFromVideoDevice(
        backCamera?.deviceId || undefined,
        videoRef.current,
        (result) => {
          if (!result || scanLockRef.current || !mountedRef.current) return;
          const attendanceCode = result.getText()?.trim();
          if (attendanceCode) markAttendance(attendanceCode);
        }
      );
    } catch {
      if (!mountedRef.current) return;
      setCameraError('Camera access is required. Allow camera permission and reload this page.');
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      try {
        const response = await axios.get(`/api/scanner/school/${token}`);
        if (!mountedRef.current) return;
        setSchoolName(response.data.schoolName);
        setLoading(false);
        await startScanner();
      } catch {
        if (!mountedRef.current) return;
        setInvalidLink(true);
        setLoading(false);
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-200">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (invalidLink) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <XCircle className="w-16 h-16 text-red-400 mb-4" />
        <h1 className="text-xl font-semibold text-white mb-2">Invalid scanner link</h1>
        <p className="text-slate-300">Ask your school admin for a new attendance scanner link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header className="px-4 py-5 text-center border-b border-slate-700">
        <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Attendance Scanner</p>
        <h1 className="text-lg font-semibold">{schoolName}</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
        <div className="relative w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden bg-black border-2 border-slate-600">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          {!feedback && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-8 border-2 border-primary-400/70 rounded-xl" />
              <div className="absolute bottom-4 left-0 right-0 text-center text-sm text-white/90 bg-black/40 py-2">
                Point camera at QR code
              </div>
            </div>
          )}
        </div>

        {cameraError && (
          <div className="mt-4 flex items-start gap-2 text-red-300 text-sm max-w-sm text-center">
            <Camera className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{cameraError}</span>
          </div>
        )}

        {feedback?.type === 'success' && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto bg-green-600 rounded-2xl p-8 text-center shadow-2xl animate-fade-in z-10">
            <CheckCircle className="w-20 h-20 mx-auto mb-4 text-white" />
            <h2 className="text-2xl font-bold mb-1">{feedback.title}</h2>
            <p className="text-green-100 text-lg font-medium">{feedback.name}</p>
            <p className="text-green-200 text-sm mt-2 capitalize">{feedback.userType}</p>
            <p className="text-green-100/80 text-xs mt-4">Attendance saved to admin dashboard</p>
          </div>
        )}

        {feedback?.type === 'error' && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto bg-red-600 rounded-2xl p-8 text-center shadow-2xl animate-fade-in z-10">
            <XCircle className="w-20 h-20 mx-auto mb-4 text-white" />
            <h2 className="text-2xl font-bold mb-2">{feedback.title}</h2>
            <p className="text-red-100">{feedback.message}</p>
          </div>
        )}
      </div>

      <footer className="px-4 py-4 text-center text-xs text-slate-400 border-t border-slate-700">
        Records appear on the school admin dashboard only
      </footer>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in { animation: fade-in 0.25s ease-out; }
      `}</style>
    </div>
  );
};

export default MobileScanner;
