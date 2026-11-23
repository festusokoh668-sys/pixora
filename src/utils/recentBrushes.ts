import { ToolType } from '../types';

export interface BrushOptionMeta {
  id: ToolType;
  label: string;
  desc: string;
}

export const BRUSH_OPTIONS: BrushOptionMeta[] = [
  { id: 'brush', label: 'Brush', desc: 'Smooth paint brush' },
  { id: 'calligraphy', label: 'Calligraphy brush 1', desc: 'Sharp nib ink stroke' },
  { id: 'highlighter', label: 'Marker', desc: 'Semi-transparent marker wash' },
  { id: 'airbrush', label: 'Airbrush', desc: 'Soft scattered spray' },
  { id: 'oil', label: 'Oil brush', desc: 'Rich textured oil stroke' },
  { id: 'crayon', label: 'Crayon', desc: 'Wax grain crayon texture' },
  { id: 'pencil', label: 'Natural pencil', desc: 'Textured graphite pencil' },
  { id: 'watercolor', label: 'Watercolor brush', desc: 'Translucent watercolor bleed' },
  { id: 'stamp', label: 'Stamp brush', desc: 'Place star, heart & circle stamps' },
  { id: 'blur', label: 'Blur', desc: 'Soften canvas pixels within stroke area (Gaussian blur)' },
];

export interface RecentBrushSetting {
  id: string;
  tool: ToolType;
  label: string;
  size: number;
  color: string;
}

export const MAX_RECENT_BRUSHES = 5;

export function getBrushOptionLabel(tool: ToolType): string | null {
  const match = BRUSH_OPTIONS.find((b) => b.id === tool);
  return match ? match.label : null;
}

export function createRecentBrushSettingId(
  tool: ToolType,
  size: number,
  color: string
): string {
  return `${tool}|${size}|${color.trim().toUpperCase()}`;
}

/**
 * Records a brush setting (tool + size + color) into the recent brushes list,
 * deduplicating identical settings, promoting the latest to index 0, and
 * capping the history length to `maxItems` (default 5).
 */
export function recordRecentBrushSetting(
  history: RecentBrushSetting[],
  tool: ToolType,
  size: number,
  color: string,
  maxItems: number = MAX_RECENT_BRUSHES
): RecentBrushSetting[] {
  const label = getBrushOptionLabel(tool);
  if (!label) return history;

  const normalizedColor = color.trim().toUpperCase();
  const normalizedSize = Math.max(1, Math.round(size));
  const id = createRecentBrushSettingId(tool, normalizedSize, normalizedColor);

  const entry: RecentBrushSetting = {
    id,
    tool,
    label,
    size: normalizedSize,
    color: normalizedColor,
  };

  const filtered = history.filter((item) => item.id !== id);
  return [entry, ...filtered].slice(0, Math.max(1, maxItems));
}
