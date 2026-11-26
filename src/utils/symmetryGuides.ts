import { SymmetryGuideMode } from '../types';

export function hasVerticalSymmetryGuide(mode: SymmetryGuideMode): boolean {
  return mode === 'vertical' || mode === 'both';
}

export function hasHorizontalSymmetryGuide(mode: SymmetryGuideMode): boolean {
  return mode === 'horizontal' || mode === 'both';
}

/**
 * Toggles overall Symmetry Guides visibility on or off without enabling mirror drawing.
 * Restores the last active guide orientation (defaulting to 'both' center lines).
 */
export function toggleSymmetryGuides(
  currentMode: SymmetryGuideMode,
  lastActiveMode: Exclude<SymmetryGuideMode, 'none'> = 'both'
): SymmetryGuideMode {
  return currentMode === 'none' ? lastActiveMode : 'none';
}

/**
 * Independently toggles the vertical or horizontal center alignment guide line.
 */
export function toggleSymmetryGuideAxis(
  currentMode: SymmetryGuideMode,
  axis: 'vertical' | 'horizontal'
): SymmetryGuideMode {
  const hasV = hasVerticalSymmetryGuide(currentMode);
  const hasH = hasHorizontalSymmetryGuide(currentMode);

  const nextV = axis === 'vertical' ? !hasV : hasV;
  const nextH = axis === 'horizontal' ? !hasH : hasH;

  if (nextV && nextH) return 'both';
  if (nextV) return 'vertical';
  if (nextH) return 'horizontal';
  return 'none';
}

/**
 * Computes exact canvas center coordinates for vertical and horizontal alignment guides.
 */
export function getSymmetryGuideCoordinates(
  canvasWidth: number,
  canvasHeight: number
): { centerX: number; centerY: number } {
  const safeW = Number.isFinite(canvasWidth) && canvasWidth > 0 ? canvasWidth : 0;
  const safeH = Number.isFinite(canvasHeight) && canvasHeight > 0 ? canvasHeight : 0;
  return {
    centerX: Math.round((safeW / 2) * 10) / 10,
    centerY: Math.round((safeH / 2) * 10) / 10,
  };
}

/**
 * Returns a concise toast/status message describing the active Symmetry Guides state.
 */
export function getSymmetryGuidesStatusMessage(mode: SymmetryGuideMode): string {
  switch (mode) {
    case 'vertical':
      return 'Vertical Symmetry Guide shown (no mirror drawing)';
    case 'horizontal':
      return 'Horizontal Symmetry Guide shown (no mirror drawing)';
    case 'both':
      return 'Center Symmetry Guides shown — Vertical & Horizontal (no mirror drawing)';
    default:
      return 'Symmetry Guides hidden';
  }
}
