const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_PNG_BASE64_CHARS = 28_000_000;

function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

function pad3(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(3, '0');
}

/**
 * Formats a clean, filesystem-safe, timestamped PNG filename:
 * e.g. `Pixora_2026-11-23_08-40-12-345.png`
 */
export function generateTimestampedPngFilename(
  prefix: string = 'Pixora',
  date: Date = new Date()
): string {
  const safePrefix =
    (prefix || 'Pixora')
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 28) || 'Pixora';

  const y = date.getUTCFullYear();
  const m = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  const hh = pad2(date.getUTCHours());
  const mm = pad2(date.getUTCMinutes());
  const ss = pad2(date.getUTCSeconds());
  const ms = pad3(date.getUTCMilliseconds());

  return `${safePrefix}_${y}-${m}-${d}_${hh}-${mm}-${ss}-${ms}.png`;
}

/**
 * Strips path separators and traversal tokens, ensuring a safe `.png` basename.
 */
export function sanitizeQuickSaveFilename(
  rawFilename?: string,
  fallbackDate: Date = new Date()
): string {
  if (!rawFilename || typeof rawFilename !== 'string') {
    return generateTimestampedPngFilename('Pixora', fallbackDate);
  }

  const lastSegment = rawFilename.split(/[\\/]/).pop() || '';
  const withoutDots = lastSegment.replace(/^\.+/, '');
  const withoutExt = withoutDots.replace(/\.png$/i, '');
  const cleaned = withoutExt
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 72);

  if (!cleaned) {
    return generateTimestampedPngFilename('Pixora', fallbackDate);
  }

  return `${cleaned}.png`;
}

/**
 * Validates a base64 `data:image/png;base64,...` URI and checks PNG magic bytes.
 */
export function parsePngDataUrl(dataUrl: unknown): Uint8Array | null {
  if (typeof dataUrl !== 'string') return null;
  const trimmed = dataUrl.trim();
  const prefix = 'data:image/png;base64,';
  if (!trimmed.startsWith(prefix)) return null;

  const base64Payload = trimmed.slice(prefix.length).replace(/\s+/g, '');
  if (
    base64Payload.length < 16 ||
    base64Payload.length > MAX_PNG_BASE64_CHARS ||
    !/^[A-Za-z0-9+/=]+$/.test(base64Payload)
  ) {
    return null;
  }

  let bytes: Uint8Array;
  if (typeof Buffer !== 'undefined') {
    bytes = new Uint8Array(Buffer.from(base64Payload, 'base64'));
  } else {
    const binary = atob(base64Payload);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  }

  if (bytes.length < PNG_SIGNATURE.length) return null;
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      return null;
    }
  }

  return bytes;
}
