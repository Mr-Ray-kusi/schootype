import React, { forwardRef } from 'react';
import QRCode from 'react-qr-code';

const QrCodeBlock = forwardRef(({
  value,
  size = 160,
  className = '',
  level = 'M',
  paddingClass = 'p-3',
}, ref) => {
  if (!value) return null;
  return (
    <div
      ref={ref}
      className={`flex items-center justify-center bg-white rounded ${paddingClass} ${className}`}
    >
      <QRCode
        value={value}
        size={size}
        level={level}
        bgColor="#FFFFFF"
        fgColor="#000000"
        style={{ height: 'auto', maxWidth: '100%', width: '100%', display: 'block' }}
        viewBox="0 0 256 256"
      />
    </div>
  );
});

QrCodeBlock.displayName = 'QrCodeBlock';

export const downloadQrCodePng = (containerElement, filename) => {
  const svg = containerElement?.querySelector('svg');
  if (!svg) return;

  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement('canvas');
  const size = 320;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const img = new Image();
  img.onload = () => {
    const padding = 24;
    const dim = size - padding * 2;
    ctx.drawImage(img, padding, padding, dim, dim);
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
};

export default QrCodeBlock;
