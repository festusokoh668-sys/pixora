/**
 * High-precision Color Conversion Utilities
 */

export interface HSL {
  h: number; // 0 - 360
  s: number; // 0 - 100
  l: number; // 0 - 100
}

export interface HSV {
  h: number; // 0 - 360
  s: number; // 0 - 100
  v: number; // 0 - 100
}

export interface RGB {
  r: number; // 0 - 255
  g: number; // 0 - 255
  b: number; // 0 - 255
}

/**
 * Converts HEX color string to RGB object
 */
export function hexToRgb(hex: string): RGB {
  const cleanHex = hex.replace('#', '').trim();
  let r = 0;
  let g = 0;
  let b = 0;

  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16) || 0;
    g = parseInt(cleanHex[1] + cleanHex[1], 16) || 0;
    b = parseInt(cleanHex[2] + cleanHex[2], 16) || 0;
  } else if (cleanHex.length >= 6) {
    r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  }

  return { r, g, b };
}

/**
 * Converts RGB values to a clean uppercase HEX string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const to2Hex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${to2Hex(r)}${to2Hex(g)}${to2Hex(b)}`.toUpperCase();
}

/**
 * Converts RGB to HSV
 */
export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = max === 0 ? 0 : delta / max;
  let v = max;

  if (max !== min) {
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / delta + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / delta + 4;
        break;
    }
    h *= 60;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

/**
 * Converts HSV to RGB
 */
export function hsvToRgb(h: number, s: number, v: number): RGB {
  const hNorm = ((h % 360) + 360) % 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const vNorm = Math.max(0, Math.min(100, v)) / 100;

  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((hNorm / 60) % 2) - 1));
  const m = vNorm - c;

  let r = 0;
  let g = 0;
  let b = 0;

  if (0 <= hNorm && hNorm < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= hNorm && hNorm < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= hNorm && hNorm < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= hNorm && hNorm < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= hNorm && hNorm < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= hNorm && hNorm < 360) {
    r = c; g = 0; b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/**
 * Converts HEX color string to HSL object
 */
export function hexToHsl(hex: string): HSL {
  const { r, g, b } = hexToRgb(hex);
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h *= 60;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converts HSL values to a HEX color string
 */
export function hslToHex(h: number, s: number, l: number): string {
  const hNorm = ((h % 360) + 360) % 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((hNorm / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (0 <= hNorm && hNorm < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= hNorm && hNorm < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= hNorm && hNorm < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= hNorm && hNorm < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= hNorm && hNorm < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= hNorm && hNorm < 360) {
    r = c; g = 0; b = x;
  }

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * Safely generates shareable URLs without breakage
 * Handles sandboxed iframes, null origin, query params, and hashes cleanly.
 */
export function getSafeShareUrl(templateId?: string): string {
  try {
    let base = 'https://pixora.studio';
    if (typeof window !== 'undefined') {
      base = window.location.href.split('?')[0].split('#')[0];
      if ((!base || base.startsWith('about:') || base.startsWith('data:')) && window.location.origin && window.location.origin !== 'null') {
        base = window.location.origin + window.location.pathname;
      }
      if (!base) {
        base = window.location.href || 'https://pixora.studio';
      }
    }

    const url = new URL(base);
    if (templateId) {
      url.searchParams.set('template', templateId);
    } else {
      url.searchParams.set('studio', '1');
    }
    return url.toString();
  } catch {
    const fallbackBase = typeof window !== 'undefined' ? window.location.href.split('?')[0].split('#')[0] : '';
    return templateId
      ? `${fallbackBase}?template=${encodeURIComponent(templateId)}`
      : `${fallbackBase}?studio=1`;
  }
}
