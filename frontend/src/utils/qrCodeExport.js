import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import QRCode from 'react-qr-code';

export function qrValueToSvgMarkup(value) {
  let markup = renderToStaticMarkup(
    React.createElement(QRCode, {
      value,
      size: 256,
      level: 'M',
      bgColor: '#FFFFFF',
      fgColor: '#000000',
    })
  );
  if (!/xmlns=/.test(markup)) {
    markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return markup;
}

export function svgMarkupToPngBlob(svgMarkup, outputSize = 512, padding = 32) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outputSize, outputSize);

    const img = new Image();
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to render QR SVG'));
    };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const dim = outputSize - padding * 2;
      ctx.drawImage(img, padding, padding, dim, dim);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create QR PNG'));
      }, 'image/png');
    };
    img.src = url;
  });
}

export async function qrValueToPngBlob(value, outputSize = 512) {
  if (!value) throw new Error('QR code value is required');
  const svgMarkup = qrValueToSvgMarkup(value);
  return svgMarkupToPngBlob(svgMarkup, outputSize);
}

export async function downloadQrValuePng(value, filename) {
  const blob = await qrValueToPngBlob(value);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
