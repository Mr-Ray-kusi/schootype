import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { BrowserQRCodeReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';
import { extractAttendanceCode } from '../utils/studentIdQr';
import { CheckCircle, XCircle, Camera, Loader2 } from 'lucide-react';

const SCAN_COOLDOWN_MS = 1600;

const buildQrHints = () => {
  const hints = new Map();
  // QR only — skipping other barcode formats makes each frame much faster.
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  hints.set(DecodeHintType.TRY_HARDER, false);
  hints.set(DecodeHintType.ASSUME_GS1, false);
  return hints;
};

const MobileScanner = () => {
  const { token } = useParams();
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const readerRef = useRef(null);
  const scanLockRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const markAttendanceRef = useRef(async () => {});

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
      try {
        video.srcObject.getTracks?.().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      video.srcObject = null;
    }
  }, []);

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
      const reader = new BrowserQRCodeReader(buildQrHints(), {
        delayBetweenScanAttempts: 40,
        delayBetweenScanSuccess: 400,
        tryPlayVideoTimeout: 5000,
      });
      readerRef.current = reader;

      const constraintSets = [
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 960 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
        },
        {
          audio: false,
          video: { facingMode: 'environment' },
        },
        {
          audio: false,
          video: true,
        },
      ];

      let controls = null;
      let lastError = null;

      for (const constraints of constraintSets) {
        try {
          controls = await reader.decodeFromConstraints(
            constraints,
            videoRef.current,
            (result, error) => {
              if (!mountedRef.current || scanLockRef.current) return;
              if (error && !(error instanceof NotFoundException)) {
                // Ignore continuous "not found" frames; log unexpected decode errors once.
                if (error?.name && error.name !== 'NotFoundException') {
                  console.warn('QR decode error:', error.name, error.message);
                }
                return;
              }
              if (!result) return;

              const text = result.getText()?.trim();
              if (text) {
                markAttendanceRef.current(text);
              }
            }
          );
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          try {
            reader.reset?.();
          } catch {
            // ignore and try next constraints
          }
        }
      }

      if (!controls) {
        throw lastError || new Error('Camera unavailable');
      }

      controlsRef.current = controls;

      const video = videoRef.current;
      if (video) {
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        video.playsInline = true;
        try {
          await video.play();
        } catch {
          // zxing may already be playing the stream
        }
      }

      if (mountedRef.current) setCameraReady(true);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('Scanner camera/decode error:', err);
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('Camera permission blocked. Allow camera access for this site and reload.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device.');
      } else if (window.isSecureContext === false) {
        setCameraError('Camera requires HTTPS. Open the scanner link from the secure school URL.');
      } else {
        setCameraError('Could not start QR scanning. Allow camera permission and tap retry.');
      }
      setCameraReady(false);
    }
  }, [stopScanner]);

  const markAttendance = useCallback(
    async (rawCode) => {
      const attendanceCode = extractAttendanceCode(rawCode);
      if (!attendanceCode) return;
      if (scanLockRef.current) return;

      // Keep the camera stream warm — full stop/restart made the next scan feel slow.
      scanLockRef.current = true;
      setFeedback({
        type: 'pending',
        title: 'Reading…',
        message: 'Marking attendance',
      });

      try {
        const response = await axios.post(`/api/scanner/mark/${token}`, { qrCode: attendanceCode });
        if (!mountedRef.current) return;
        setFeedback({
          type: 'success',
          title: 'Recorded!',
          message: response.data.message,
          name: response.data.user?.name,
          userType: response.data.user?.type,
          punctuality: response.data.user?.punctuality,
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
      }, SCAN_COOLDOWN_MS);
    },
    [token]
  );

  markAttendanceRef.current = markAttendance;

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

  // Start camera/decoder once, after the video element exists.
  useEffect(() => {
    if (loading || invalidLink || !schoolName) return undefined;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) startScanner();
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Intentionally only re-run when the page becomes ready — not when startScanner identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, invalidLink, schoolName]);

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
          {cameraReady && !feedback && (
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
              onClick={() => {
                scanLockRef.current = false;
                startScanner();
              }}
              className="rounded-full bg-sky-500 px-4 py-2 text-white font-medium hover:bg-sky-400"
            >
              Try camera again
            </button>
          </div>
        )}

        {feedback?.type === 'pending' && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto bg-slate-800 rounded-2xl p-8 text-center shadow-2xl animate-fade-in z-10 border border-slate-600">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-sky-300 animate-spin" />
            <h2 className="text-xl font-bold mb-1">{feedback.title}</h2>
            <p className="text-slate-300 text-sm">{feedback.message}</p>
          </div>
        )}

        {feedback?.type === 'success' && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto bg-green-600 rounded-2xl p-8 text-center shadow-2xl animate-fade-in z-10">
            <CheckCircle className="w-20 h-20 mx-auto mb-4 text-white" />
            <h2 className="text-2xl font-bold mb-1">{feedback.title}</h2>
            <p className="text-green-100 text-lg font-medium">{feedback.name}</p>
            <p className="text-green-200 text-sm mt-2 capitalize">{feedback.userType}</p>
            {feedback.punctuality ? (
              <p className="text-green-50 text-sm mt-2 font-semibold">
                {feedback.punctuality === 'late' ? 'Late' : 'Early'}
              </p>
            ) : null}
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
