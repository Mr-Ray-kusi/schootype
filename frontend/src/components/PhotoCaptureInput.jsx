import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Upload, X, SwitchCamera, Circle } from 'lucide-react';
import toast from 'react-hot-toast';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 1280;

const estimateDataUrlBytes = (dataUrl) => {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.ceil((base64.length * 3) / 4);
};

const canvasToDataUrl = (canvas, quality = 0.9) => canvas.toDataURL('image/jpeg', quality);

const compressCanvas = (canvas) => {
  let quality = 0.92;
  let dataUrl = canvasToDataUrl(canvas, quality);

  while (estimateDataUrlBytes(dataUrl) > MAX_BYTES && quality > 0.45) {
    quality -= 0.08;
    dataUrl = canvasToDataUrl(canvas, quality);
  }

  if (estimateDataUrlBytes(dataUrl) > MAX_BYTES) {
    return null;
  }
  return dataUrl;
};

const PhotoCaptureInput = ({
  preview,
  onChange,
  onClear,
  label = 'Profile Photo',
  hint = 'Take a photo with your camera/webcam, or upload an image file (JPG/PNG, max 2MB).',
  theme = 'dark',
}) => {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [cameraReady, setCameraReady] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Camera is not supported in this browser. Use Upload Image instead.');
      setShowCamera(false);
      return;
    }

    setCameraReady(false);

    const tryConstraints = [
      { video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode }, audio: false },
      { video: true, audio: false },
    ];

    stopCamera();

    for (const constraints of tryConstraints) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
        return;
      } catch {
        // try next constraint set
      }
    }

    toast.error('Could not access camera. Allow permission in your browser, then try again.');
    setShowCamera(false);
    stopCamera();
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (!showCamera) return undefined;

    startCamera();
    return () => stopCamera();
  }, [showCamera, facingMode, startCamera, stopCamera]);

  const handleFile = (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > MAX_BYTES) {
      toast.error('Photo must be smaller than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => onChange(reader.result);
    reader.onerror = () => toast.error('Failed to read image file');
    reader.readAsDataURL(file);
  };

  const openCamera = () => {
    setFacingMode('user');
    setShowCamera(true);
  };

  const closeCamera = () => {
    setShowCamera(false);
    stopCamera();
  };

  const flipCamera = () => {
    setFacingMode((current) => (current === 'user' ? 'environment' : 'user'));
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !cameraReady) return;

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) {
      toast.error('Camera is still loading. Wait a moment and try again.');
      return;
    }

    let width = sourceWidth;
    let height = sourceHeight;
    if (Math.max(width, height) > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = compressCanvas(canvas);
    if (!dataUrl) {
      toast.error('Captured photo is too large. Move closer to the light or use Upload Image.');
      return;
    }

    onChange(dataUrl);
    closeCamera();
    toast.success('Photo captured');
  };

  const isLight = theme === 'light';

  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-gray-700' : 'text-slate-200'}`}>
        {label}
      </label>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div
          className={`w-24 h-24 rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center shrink-0 ${
            isLight ? 'border-gray-300 bg-gray-50' : 'border-slate-500 bg-slate-700/50'
          }`}
        >
          {preview ? (
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-8 h-8 text-slate-400" />
          )}
        </div>
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={openCamera}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            <Camera className="w-4 h-4" />
            Take Photo
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm ${
              isLight
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-slate-600 text-slate-100 hover:bg-slate-500'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload Image
          </button>
          {preview && (
            <button
              type="button"
              onClick={onClear}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm ${
                isLight ? 'text-red-600 hover:bg-red-50' : 'text-red-400 hover:bg-red-500/10'
              }`}
            >
              <X className="w-4 h-4" />
              Remove Photo
            </button>
          )}
        </div>
      </div>
      <p className={`text-xs mt-2 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>{hint}</p>

      {/* Upload only — no capture attribute so desktop opens file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {showCamera && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-600">
              <h3 className="text-white font-semibold">Take Photo</h3>
              <button
                type="button"
                onClick={closeCamera}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-700"
                aria-label="Close camera"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative bg-black aspect-[4/3]">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'mirror' : ''}`}
                playsInline
                muted
                autoPlay
              />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm">
                  Starting camera…
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 p-4">
              <button
                type="button"
                onClick={flipCamera}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm"
                title="Switch between front and back camera"
              >
                <SwitchCamera className="w-4 h-4" />
                Flip
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!cameraReady}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 font-medium"
              >
                <Circle className="w-4 h-4 fill-current" />
                Capture
              </button>
              <button
                type="button"
                onClick={closeCamera}
                className="px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-700 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        video.mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
};

export default PhotoCaptureInput;
