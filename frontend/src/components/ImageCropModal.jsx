import React, { useEffect, useRef, useState } from 'react';
import { Check, X, ZoomIn } from 'lucide-react';
import { compressToPassport, loadImage } from '../utils/imageCompress';
import toast from 'react-hot-toast';

const FRAME = 260;

const ImageCropModal = ({ src, onCancel, onConfirm }) => {
  const imgRef = useRef(null);
  const dragRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState({ w: 1, h: 1 });

  useEffect(() => {
    loadImage(src)
      .then((img) => setNatural({ w: img.naturalWidth, h: img.naturalHeight }))
      .catch(() => toast.error('Could not load image for cropping'));
  }, [src]);

  const baseScale = Math.max(FRAME / natural.w, FRAME / natural.h);
  const displayW = natural.w * baseScale * zoom;
  const displayH = natural.h * baseScale * zoom;

  const onPointerDown = (event) => {
    event.preventDefault();
    dragRef.current = {
      x: event.clientX - offset.x,
      y: event.clientY - offset.y,
    };
  };

  const onPointerMove = (event) => {
    if (!dragRef.current) return;
    setOffset({
      x: event.clientX - dragRef.current.x,
      y: event.clientY - dragRef.current.y,
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const handleConfirm = async () => {
    try {
      const img = imgRef.current || (await loadImage(src));
      const scale = (natural.w * baseScale * zoom) / natural.w;
      const left = (FRAME - displayW) / 2 + offset.x;
      const top = (FRAME - displayH) / 2 + offset.y;
      const sx = Math.max(0, -left / scale);
      const sy = Math.max(0, -top / scale);
      const sw = Math.min(natural.w - sx, FRAME / scale);
      const sh = Math.min(natural.h - sy, FRAME / scale);
      const dataUrl = compressToPassport(img, { sx, sy, sw, sh });
      if (!dataUrl) {
        toast.error('Could not compress photo. Try another image.');
        return;
      }
      onConfirm(dataUrl);
    } catch {
      toast.error('Failed to crop image');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-600 bg-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-600 px-4 py-3">
          <h3 className="font-semibold text-white">Crop photo</h3>
          <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="px-4 pt-3 text-xs text-slate-400">
          Drag to position. The square is saved at 200×200px (~80KB).
        </p>
        <div className="flex justify-center px-4 py-4">
          <div
            className="relative overflow-hidden rounded-xl border-2 border-sky-400 bg-black touch-none"
            style={{ width: FRAME, height: FRAME }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
          >
            <img
              ref={imgRef}
              src={src}
              alt="Crop"
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                width: displayW,
                height: displayH,
                left: (FRAME - displayW) / 2 + offset.x,
                top: (FRAME - displayH) / 2 + offset.y,
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 pb-2">
          <ZoomIn className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div className="flex gap-2 p-4">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={natural.w <= 1}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Use photo
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg bg-slate-700 py-2.5 text-sm text-slate-100 hover:bg-slate-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
