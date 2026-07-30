import React, { useRef } from 'react';
import QRCode from 'react-qr-code';
import { Download } from 'lucide-react';

const downloadQrPng = (container, filename) => {
  const svgElement = container?.querySelector('svg');
  if (!svgElement) return;

  const canvas = document.createElement('canvas');
  const size = 400;
  const padding = 24;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const svgData = new XMLSerializer().serializeToString(svgElement);
  const img = new Image();
  img.onload = () => {
    const inner = size - padding * 2;
    const scale = Math.min(inner / img.width, inner / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (size - w) / 2;
    const y = (size - h) / 2;
    ctx.drawImage(img, x, y, w, h);

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
};

const AttendanceQrCode = ({
  value,
  name = 'attendance',
  size = 160,
  showDownload = true,
  downloadLabel = 'Download QR Code',
  className = '',
  containerClassName = 'bg-white rounded-xl p-4',
  buttonClassName = 'mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg transition-colors text-sm font-medium',
}) => {
  const qrRef = useRef(null);

  if (!value) {
    return (
      <div className={`text-center text-sm text-slate-400 py-6 ${className}`}>
        No attendance code assigned
      </div>
    );
  }

  const handleDownload = () => {
    const safeName = (name || 'attendance').replace(/[^\w\s-]/g, '').trim() || 'attendance';
    downloadQrPng(qrRef.current, `${safeName}-qr-code.png`);
  };

  return (
    <div className={className}>
      <div
        ref={qrRef}
        className={`flex items-center justify-center mx-auto ${containerClassName}`}
        style={{ width: size + 32, maxWidth: '100%' }}
      >
        <QRCode value={value} size={size} level="M" bgColor="#FFFFFF" fgColor="#0f172a" />
      </div>
      {showDownload && (
        <button type="button" onClick={handleDownload} className={buttonClassName}>
          <Download className="w-4 h-4" />
          {downloadLabel}
        </button>
      )}
    </div>
  );
};

export default AttendanceQrCode;
