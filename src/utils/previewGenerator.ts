/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Stroke, CanvasLayer } from '../types';
import { renderStrokeToContext } from './drawing';
import { createInitialLayers } from './layers';
import { renderLayeredArtworkToContext } from './filterHistory';

/**
 * Creates a lightweight thumbnail dataURL from a full-size canvas or dataURL
 */
export async function createThumbnailDataUrl(
  sourceDataUrl: string,
  maxWidth = 360,
  maxHeight = 240
): Promise<string> {
  if (typeof window === 'undefined') return sourceDataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(sourceDataUrl);
        return;
      }

      // Pure white paper background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Draw downscaled image
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      try {
        const thumbUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(thumbUrl);
      } catch {
        resolve(sourceDataUrl);
      }
    };
    img.onerror = () => {
      resolve(sourceDataUrl);
    };
    img.src = sourceDataUrl;
  });
}

/**
 * Re-renders strokes on an off-screen canvas to generate a preview image
 * Used when an artwork is restored from Firestore onto a new device
 */
export function renderStrokesToPreviewDataUrl(
  strokes: Stroke[],
  canvasWidth: number,
  canvasHeight: number,
  layers?: CanvasLayer[],
  maxWidth = 360,
  maxHeight = 240
): string {
  if (typeof document === 'undefined' || !strokes || strokes.length === 0) {
    return '';
  }

  try {
    const scale = Math.min(maxWidth / canvasWidth, maxHeight / canvasHeight, 1);
    const targetW = Math.max(1, Math.round(canvasWidth * scale));
    const targetH = Math.max(1, Math.round(canvasHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Draw white canvas paper
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);

    ctx.save();
    ctx.scale(scale, scale);

    const safeLayers = layers && layers.length > 0 ? layers : createInitialLayers();
    renderLayeredArtworkToContext(
      ctx,
      strokes,
      safeLayers,
      canvasWidth,
      canvasHeight,
      (targetCtx, stroke) => renderStrokeToContext(targetCtx, stroke)
    );

    ctx.restore();

    return canvas.toDataURL('image/jpeg', 0.82);
  } catch (err) {
    console.warn('Failed to render strokes to preview data URL:', err);
    return '';
  }
}
