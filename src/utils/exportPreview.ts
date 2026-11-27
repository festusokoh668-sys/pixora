export type ExportPreviewFormat = 'png' | 'jpg' | 'svg';
export type ExportPreviewScale = 1 | 2 | 4;

export interface ExportOutputDimensions {
  width: number;
  height: number;
}

/**
 * Compute final exported pixel dimensions for raster vs vector outputs.
 */
export function computeExportDimensions(
  canvasDimensions: { width: number; height: number },
  format: ExportPreviewFormat,
  scale: ExportPreviewScale
): ExportOutputDimensions {
  const baseW = Math.max(1, Math.round(canvasDimensions.width || 819));
  const baseH = Math.max(1, Math.round(canvasDimensions.height || 460));
  if (format === 'svg') {
    return { width: baseW, height: baseH };
  }
  return {
    width: baseW * scale,
    height: baseH * scale,
  };
}

/**
 * Estimate raw binary byte size from a base64/URL data URL string.
 */
export function estimateDataUrlBytes(dataUrl: string): number {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;

  const header = dataUrl.slice(0, commaIdx);
  const body = dataUrl.slice(commaIdx + 1);

  if (header.includes(';base64')) {
    const clean = body.replace(/\s+/g, '');
    if (!clean) return 0;
    let padding = 0;
    if (clean.endsWith('==')) padding = 2;
    else if (clean.endsWith('=')) padding = 1;
    return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
  }

  try {
    return decodeURIComponent(body).length;
  } catch {
    return body.length;
  }
}

/**
 * Estimate UTF-8 byte length of an SVG string.
 */
export function estimateSvgBytes(svgString: string): number {
  if (!svgString) return 0;
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(svgString).length;
  }
  return svgString.length;
}

/**
 * Format byte size cleanly for display (B, KB, MB).
 */
export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Convert raw SVG markup into a safe UTF-8 data URL for <img> preview rendering.
 */
export function svgStringToDataUrl(svgString: string): string {
  if (!svgString) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
}
