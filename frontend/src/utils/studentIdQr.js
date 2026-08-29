/**
 * Public person ID URL so a normal phone camera opens the profile.
 * Gate scanners extract the barcode and mark attendance instead.
 */

export function buildFeePayUrl(barcode, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  if (!barcode) return '';
  return `${origin}/pay/${encodeURIComponent(barcode)}`;
}

/** @deprecated use buildPersonIdUrl */
export function buildStudentIdUrl(barcode, origin) {
  return buildPersonIdUrl(barcode, origin);
}

/** Pull attendance barcode from a raw scan (ID URL or legacy plain barcode). */
export function extractAttendanceCode(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/id\/([^/]+)\/?$/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  } catch {
    // not a full URL — try path fragment
  }

  const pathMatch = value.match(/\/id\/([^/?#\s]+)/);
  if (pathMatch?.[1]) {
    try {
      return decodeURIComponent(pathMatch[1]);
    } catch {
      return pathMatch[1];
    }
  }

  return value;
}
