import React, { useRef } from 'react';
import QRCode from 'react-qr-code';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';

const AttendanceQrCode = ({
  value,
  name = 'attendance',
  size = 160,
  showDownload = true,
  downloadLabel = 'Download QR Code',
  className = '',
  containerClassName = 'bg-white rounded-xl p-4',
  buttonClassName = 'mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg transition-colors text-sm font-medium',
  onDownloadPack,
}) => {
  const qrRef = useRef(null);

  if (!value) {
    return (
      <div className={`py-6 text-center text-sm text-slate-400 ${className}`}>
        No attendance code assigned
      </div>
    );
  }

  const handleDownload = async () => {
    try {
      if (onDownloadPack) {
        await onDownloadPack();
        return;
      }
      const svgElement = qrRef.current?.querySelector('svg');
      if (!svgElement) return;
      const canvas = document.createElement('canvas');
      const out = 400;
      const padding = 24;
      canvas.width = out;
      canvas.height = out;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out, out);
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const img = new Image();
      img.onload = () => {
        const inner = out - padding * 2;
        const scale = Math.min(inner / img.width, inner / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (out - w) / 2, (out - h) / 2, w, h);
        const link = document.createElement('a');
        const safeName = (name || 'attendance').replace(/[^\w\s-]/g, '').trim() || 'attendance';
        link.download = `${safeName}-qr-code.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      };
      img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
    } catch {
      toast.error('Could not download pack');
    }
  };

  return (
    <div className={className}>
      <div
        ref={qrRef}
        className={`mx-auto flex items-center justify-center ${containerClassName}`}
        style={{ width: size + 32, maxWidth: '100%' }}
      >
        <QRCode value={value} size={size} level="M" bgColor="#FFFFFF" fgColor="#0f172a" />
      </div>
      {showDownload && (
        <button type="button" onClick={handleDownload} className={buttonClassName}>
          <Download className="h-4 w-4" />
          {downloadLabel}
        </button>
      )}
    </div>
  );
};

export default AttendanceQrCode;
