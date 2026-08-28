import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Upload, X, SwitchCamera, Circle } from 'lucide-react';
import toast from 'react-hot-toast';
import ImageCropModal from './ImageCropModal';
import {
  fileToDataUrl,
  persistImageRemote,
} from '../utils/imageCompress';

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const PhotoCaptureInput = ({
  preview,
  onChange,
  onClear,
  label = 'Profile Photo',
  hint = 'Take or upload a photo, then crop it. Saved at 200×200px (~80KB).',
  theme = 'dark',
}) => {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [cameraReady, setCameraReady] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);

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

  const applyPhoto = async (dataUrl) => {
    const stored = await persistImageRemote(dataUrl);
    onChange(stored);
    toast.success('Photo ready');
  };

  const handleFile = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('Photo must be smaller than 12MB');
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setCropSrc(dataUrl);
    } catch {
      toast.error('Failed to read image file');
    }
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

    const canvas = document.createElement('canvas');
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') {
      ctx.translate(sourceWidth, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, sourceWidth, sourceHeight);
    closeCamera();
    setCropSrc(canvas.toDataURL('image/jpeg', 0.92));
  };

  const isLight = theme === 'light';

  return (
    <div>
      <label className={`mb-2 block text-sm font-medium ${isLight ? 'text-gray-700' : 'text-slate-200'}`}>
        {label}
      </label>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div
          className={`flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed ${
            isLight ? 'border-gray-300 bg-gray-50' : 'border-slate-500 bg-slate-700/50'
          }`}
        >
          {preview ? (
            <img src={preview} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-8 w-8 text-slate-400" />
          )}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto">
          <button
            type="button"
            onClick={openCamera}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
          >
            <Camera className="h-4 w-4" />
            Take Photo
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm ${
              isLight
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-slate-600 text-slate-100 hover:bg-slate-500'
            }`}
          >
            <Upload className="h-4 w-4" />
            Upload & crop
          </button>
          {preview && (
            <button
              type="button"
              onClick={onClear}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm ${
                isLight ? 'text-red-600 hover:bg-red-50' : 'text-red-400 hover:bg-red-500/10'
              }`}
            >
              <X className="h-4 w-4" />
              Remove Photo
            </button>
          )}
        </div>
      </div>
      <p className={`mt-2 text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>{hint}</p>

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

      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onCancel={() => setCropSrc(null)}
          onConfirm={async (dataUrl) => {
            setCropSrc(null);
            await applyPhoto(dataUrl);
          }}
        />
      )}

      {showCamera && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-600 bg-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-600 px-4 py-3">
              <h3 className="font-semibold text-white">Take Photo</h3>
              <button
                type="button"
                onClick={closeCamera}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-700"
                aria-label="Close camera"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative aspect-[4/3] bg-black">
              <video
                ref={videoRef}
                className={`h-full w-full object-cover ${facingMode === 'user' ? 'mirror' : ''}`}
                playsInline
                muted
                autoPlay
              />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
                  Starting camera…
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 p-4">
              <button
                type="button"
                onClick={flipCamera}
                className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-600"
                title="Switch between front and back camera"
              >
                <SwitchCamera className="h-4 w-4" />
                Flip
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!cameraReady}
                className="flex items-center justify-center gap-2 rounded-full bg-primary-600 px-6 py-2.5 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <Circle className="h-4 w-4 fill-current" />
                Capture
              </button>
              <button
                type="button"
                onClick={closeCamera}
                className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
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
