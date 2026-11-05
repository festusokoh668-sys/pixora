/**
 * Sobel Edge-Detection Algorithm to convert ANY photograph or picture into
 * a clean, sharp line-art outline trace stencil (like a real coloring page / tracing sheet).
 */

export interface EdgeOptions {
  threshold?: number; // 0 to 255 (lower = more fine line details, default ~35)
  lineColor?: string; // Hex color for the outline lines (default #0f172a / dark slate)
  invert?: boolean;   // If true, dark lines on white paper; if false, light lines
}

/**
 * Processes an HTMLImageElement using the Sobel Operator to detect edges
 * and generates a high-contrast black-and-white outline trace DataURL with bold ink lines.
 */
export function generateOutlineTraceDataUrl(
  img: HTMLImageElement,
  options: EdgeOptions = {}
): string | null {
  if (typeof document === 'undefined') return null;
  const threshold = options.threshold ?? 38;
  const targetWidth = Math.min(1000, img.naturalWidth || img.width || 800);
  const targetHeight = Math.min(1000, img.naturalHeight || img.height || 800);

  if (targetWidth === 0 || targetHeight === 0) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // 1. Draw source image onto canvas
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // 2. Extract ImageData
    const srcData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const pixels = srcData.data;
    const w = targetWidth;
    const h = targetHeight;

    // 3. Convert to Grayscale array for faster convolution
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0; i < pixels.length; i += 4) {
      // Luminance conversion: 0.299R + 0.587G + 0.114B
      gray[i / 4] = (pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000;
    }

    // 4. Edge magnitude map
    const magMap = new Float32Array(w * h);

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;

        const n00 = gray[(y - 1) * w + (x - 1)];
        const n01 = gray[(y - 1) * w + x];
        const n02 = gray[(y - 1) * w + (x + 1)];

        const n10 = gray[y * w + (x - 1)];
        const n12 = gray[y * w + (x + 1)];

        const n20 = gray[(y + 1) * w + (x - 1)];
        const n21 = gray[(y + 1) * w + x];
        const n22 = gray[(y + 1) * w + (x + 1)];

        const gx = -n00 + n02 - 2 * n10 + 2 * n12 - n20 + n22;
        const gy = -n00 - 2 * n01 - n02 + n20 + 2 * n21 + n22;

        magMap[idx] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    // 5. Create output ImageData with dilation pass for bold vector strokes
    const output = ctx.createImageData(w, h);
    const outPixels = output.data;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const pIdx = idx * 4;

        // Check 3x3 neighborhood for strong edge (dilation for clean bold lines)
        let isEdge = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (magMap[(y + dy) * w + (x + dx)] > threshold) {
              isEdge = true;
              break;
            }
          }
          if (isEdge) break;
        }

        if (isEdge) {
          // Pure bold black ink stroke (#0c0e12)
          outPixels[pIdx] = 12;
          outPixels[pIdx + 1] = 14;
          outPixels[pIdx + 2] = 18;
          outPixels[pIdx + 3] = 255; // Full solid alpha for bold vector line stencil
        } else {
          // Transparent background
          outPixels[pIdx] = 255;
          outPixels[pIdx + 1] = 255;
          outPixels[pIdx + 2] = 255;
          outPixels[pIdx + 3] = 0;
        }
      }
    }

    ctx.putImageData(output, 0, 0);
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Sobel edge detection fallback triggered:', err);
    return null;
  }
}

/**
 * Creates a clean SVG stencil line art data URL for fallback rendering when an image fails to load.
 */
export function generateFallbackSvgDataUrl(name: string): string {
  const cleanName = name.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Outline Trace';
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <rect width="100%" height="100%" fill="#ffffff" />
    <circle cx="200" cy="180" r="110" fill="none" stroke="#0f172a" stroke-width="4" stroke-dasharray="8 4" />
    <path d="M 120 180 Q 200 120 280 180 M 150 210 Q 200 250 250 210 M 160 160 A 10 10 0 1 0 160 140 M 240 160 A 10 10 0 1 0 240 140" fill="none" stroke="#0f172a" stroke-width="5" stroke-linecap="round" />
    <text x="200" y="340" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="#1e293b">${cleanName}</text>
    <text x="200" y="365" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="#2563eb">OUTLINE STENCIL GUIDE</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}
