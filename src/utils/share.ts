/**
 * Web Share API pure helpers for sharing exported canvas artwork and session links.
 */

export interface SharePayloadOptions {
  title: string;
  text?: string;
  url?: string;
  file?: File | null;
}

export interface WebShareNavigator {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboard?: {
    writeText?: (text: string) => Promise<void>;
  };
}

/**
 * Derives a human-friendly share title based on active template or canvas title.
 */
export function getShareTitle(templateName?: string | null): string {
  if (templateName && templateName.trim().length > 0) {
    return `Pixora - ${templateName.trim()}`;
  }
  return 'Pixora Artwork';
}

/**
 * Derives an engaging share caption/text.
 */
export function getShareText(templateName?: string | null): string {
  if (templateName && templateName.trim().length > 0) {
    return `Check out my drawing of "${templateName.trim()}" on Pixora!`;
  }
  return 'Check out my drawing created on Pixora!';
}

/**
 * Resolves the shareable web session URL.
 */
export function getShareSessionUrl(origin?: string, templateId?: string | null): string {
  const baseOrigin = (origin || '').replace(/\/+$/, '');
  if (templateId && templateId.trim().length > 0) {
    return `${baseOrigin}/?paintbook=${encodeURIComponent(templateId.trim())}`;
  }
  return `${baseOrigin}/?studio=1`;
}

/**
 * Detects if the Web Share API is available in the current environment.
 */
export function isWebShareSupported(nav?: WebShareNavigator | null): boolean {
  return typeof nav?.share === 'function';
}

/**
 * Tests whether file sharing (Web Share Level 2) is supported for the given file.
 */
export function canShareFiles(nav?: WebShareNavigator | null, file?: File | null): boolean {
  if (!nav || typeof nav.canShare !== 'function' || !file) {
    return false;
  }
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Determines whether a thrown error represents user cancellation of the native share sheet.
 */
export function isAbortError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === 'object') {
    const errorObj = err as { name?: string; message?: string };
    if (errorObj.name === 'AbortError') return true;
    if (typeof errorObj.message === 'string' && /abort|canceled|cancelled/i.test(errorObj.message)) {
      return true;
    }
  }
  return false;
}

/**
 * Converts a base64 PNG data URL into a binary Blob.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    throw new Error('Invalid data URL');
  }
  const parts = dataUrl.split(',');
  if (parts.length < 2) {
    throw new Error('Malformed data URL');
  }
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binaryString = atob(parts[1]);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Creates a File instance from a PNG Blob.
 */
export function createPngShareFile(blob: Blob, baseTitle: string = 'Pixora'): File {
  const sanitized = baseTitle.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 32) || 'pixora';
  const filename = `${sanitized}_artwork_${Date.now()}.png`;
  return new File([blob], filename, { type: 'image/png' });
}
