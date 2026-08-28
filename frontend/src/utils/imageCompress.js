export const PASSPORT_SIZE = 200;
export const PASSPORT_MAX_BYTES = 80 * 1024;
export const UPLOAD_MAX_BYTES = 100 * 1024;

export const estimateDataUrlBytes = (dataUrl) => {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  return Math.ceil((base64.length * 3) / 4);
};

const canvasToJpeg = (canvas, quality) => canvas.toDataURL('image/jpeg', quality);

export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });

/**
 * Resize a canvas/image region to a square passport photo (200x200, ~80KB).
 */
export const compressToPassport = (source, { sx = 0, sy = 0, sw, sh } = {}) => {
  const width = source.naturalWidth || source.videoWidth || source.width;
  const height = source.naturalHeight || source.videoHeight || source.height;
  const cropW = sw || width;
  const cropH = sh || height;
  if (!cropW || !cropH) return null;

  const canvas = document.createElement('canvas');
  canvas.width = PASSPORT_SIZE;
  canvas.height = PASSPORT_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PASSPORT_SIZE, PASSPORT_SIZE);
  ctx.drawImage(source, sx, sy, cropW, cropH, 0, 0, PASSPORT_SIZE, PASSPORT_SIZE);

  let quality = 0.82;
  let dataUrl = canvasToJpeg(canvas, quality);
  while (estimateDataUrlBytes(dataUrl) > PASSPORT_MAX_BYTES && quality > 0.4) {
    quality -= 0.08;
    dataUrl = canvasToJpeg(canvas, quality);
  }
  return dataUrl;
};

export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

/** Optional Cloudinary/S3-style remote upload when env vars are set. */
export async function persistImageRemote(dataUrl) {
  const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloud || !preset || !dataUrl) return dataUrl;

  try {
    const form = new FormData();
    form.append('file', dataUrl);
    form.append('upload_preset', preset);
    form.append('folder', 'schootype');
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) return dataUrl;
    const json = await res.json();
    return json.secure_url || dataUrl;
  } catch {
    return dataUrl;
  }
}
