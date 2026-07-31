import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { extractAttendanceCode } from '../utils/studentIdQr';
import { CheckCircle, XCircle, Camera, Loader2 } from 'lucide-react';

const SCAN_COOLDOWN_MS = 2500;

const MobileScanner = () => {
  const { token } = useParams();
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const scanLockRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const startScannerRef = useRef(async () => {});

  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);
  const [invalidLink, setInvalidLink] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const stopScanner = useCallback(() => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }

    try {
      controlsRef.current?.stop?.();
    } catch {
      // ignore
    }
    controlsRef.current = null;

    try {
      readerRef.current?.reset?.();
    } catch {
      // ignore
    }
    readerRef.current = null;

    const video = videoRef.current;
    if (video?.srcObject) {
      video.srcObject.getTracks?.().forEach((track) => track.stop());
      video.srcObject = null;
    }
  }, []);

  const markAttendance = useCallback(
    async (rawCode) => {
      const attendanceCode = extractAttendanceCode(rawCode);
      if (!attendanceCode) return;

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
        startScannerRef.current();
      }, SCAN_COOLDOWN_MS);
    },
    [stopScanner, token]
  );

  const startScanner = useCallback(async () => {
    if (!videoRef.current || scanLockRef.current || !mountedRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser cannot open the camera. Use Chrome or Safari over HTTPS.');
      return;
    }

    setCameraError(null);
    setCameraReady(false);
    stopScanner();

    try {
      // Unlock device labels on mobile (labels are empty before permission).
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      permissionStream.getTracks().forEach((track) => track.stop());

      if (!mountedRef.current || !videoRef.current) return;

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const backCamera =
        devices.find((d) => /back|rear|environment/i.test(d.label)) ||
        devices.find((d) => !/front|user|face/i.test(d.label)) ||
        devices[devices.length - 1];

      const controls = await reader.decodeFromVideoDevice(
        backCamera?.deviceId || undefined,
        videoRef.current,
        (result) => {
          if (!result || scanLockRef.current || !mountedRef.current) return;
          const text = result.getText()?.trim();
          if (text) markAttendance(text);
        }
      );

      controlsRef.current = controls || null;

      if (videoRef.current) {
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch {
          // Autoplay may already be running from zxing.
        }
      }

      if (mountedRef.current) setCameraReady(true);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('Scanner camera error:', err);
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('Camera permission blocked. Allow camera access for this site and reload.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device.');
      } else if (window.isSecureContext === false) {
        setCameraError('Camera requires HTTPS. Open the scanner link from the secure school URL.');
      } else {
        setCameraError('Camera access is required. Allow camera permission and reload this page.');
      }
      setCameraReady(false);
    }
  }, [markAttendance, stopScanner]);

  startScannerRef.current = startScanner;

  // Load school info first — camera must wait until <video> is mounted.
  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      try {
        const response = await axios.get(`/api/scanner/school/${token}`);
        if (!mountedRef.current) return;
        setSchoolName(response.data.schoolName);
        setInvalidLink(false);
      } catch {
        if (!mountedRef.current) return;
        setInvalidLink(true);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, [token, stopScanner]);

  // Start camera only after loading finishes and the video element exists.
  useEffect(() => {
    if (loading || invalidLink || !schoolName) return undefined;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) startScanner();
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loading, invalidLink, schoolName, startScanner]);

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
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
          {!cameraReady && !cameraError && !feedback && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-slate-200 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Opening camera…
            </div>
          )}
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
          <div className="mt-4 flex flex-col items-center gap-3 text-red-300 text-sm max-w-sm text-center">
            <div className="flex items-start gap-2">
              <Camera className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
            <button
              type="button"
              onClick={() => startScanner()}
              className="rounded-full bg-sky-500 px-4 py-2 text-white font-medium hover:bg-sky-400"
            >
              Try camera again
            </button>
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
