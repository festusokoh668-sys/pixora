export interface RulerTickStep {
  minorStep: number;
  midStep: number;
  majorStep: number;
}

export interface RulerTick {
  posPx: number;
  displayOffsetPx: number;
  level: 'major' | 'mid' | 'minor';
  label?: string;
}

/**
 * Selects readable pixel tick intervals according to current canvas zoom level.
 */
export function getRulerStepInterval(zoomLevel: number): RulerTickStep {
  const safeZoom = Math.max(0.1, zoomLevel);
  if (safeZoom >= 2.0) {
    return { minorStep: 5, midStep: 25, majorStep: 50 };
  }
  if (safeZoom >= 0.75) {
    return { minorStep: 10, midStep: 50, majorStep: 100 };
  }
  if (safeZoom >= 0.4) {
    return { minorStep: 25, midStep: 100, majorStep: 200 };
  }
  return { minorStep: 50, midStep: 200, majorStep: 400 };
}

/**
 * Generates tick marks and pixel labels along a canvas axis [0..totalPixels].
 */
export function generateRulerTicks(totalPixels: number, zoomLevel: number): RulerTick[] {
  if (totalPixels <= 0) return [];
  const { minorStep, midStep, majorStep } = getRulerStepInterval(zoomLevel);
  const ticks: RulerTick[] = [];

  for (let px = 0; px <= totalPixels; px += minorStep) {
    const level: RulerTick['level'] =
      px % majorStep === 0 ? 'major' : px % midStep === 0 ? 'mid' : 'minor';
    ticks.push({
      posPx: px,
      displayOffsetPx: Math.round(px * zoomLevel * 10) / 10,
      level,
      ...(level === 'major' ? { label: String(px) } : {}),
    });
  }

  return ticks;
}

/**
 * Converts a pointer coordinate inside a ruler track into clamped canvas pixel coordinates.
 */
export function clientCoordToRulerCanvasPx(
  clientCoord: number,
  rulerOriginCoord: number,
  scrollOffset: number,
  zoomLevel: number,
  maxCanvasPx: number,
  sheetPadPx: number = 6
): number {
  const safeZoom = Math.max(0.1, zoomLevel);
  const displayCoord = clientCoord - rulerOriginCoord + scrollOffset - sheetPadPx;
  const rawCanvasPx = Math.round(displayCoord / safeZoom);
  return Math.max(0, Math.min(maxCanvasPx, rawCanvasPx));
}
