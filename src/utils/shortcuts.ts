export type ShortcutAction =
  | 'undo'
  | 'redo'
  | 'save'
  | 'quick-save'
  | 'open-templates'
  | 'print'
  | 'new-canvas'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'select-all'
  | 'delete-selection'
  | 'clear-selection'
  | 'crop'
  | 'resize'
  | 'flip-horizontal'
  | 'flip-vertical'
  | 'filter-invert'
  | 'toggle-grid'
  | 'toggle-rulers'
  | 'toggle-ribbon'
  | 'toggle-fullscreen'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'size-increase'
  | 'size-decrease'
  | 'tool-brush'
  | 'tool-pencil'
  | 'tool-bucket'
  | 'tool-eraser'
  | 'tool-text'
  | 'tool-picker'
  | 'tool-magnifier'
  | 'tool-select'
  | 'share';

export interface ShortcutKeyEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export interface ShortcutDescriptor {
  keys: string;
  label: string;
  category: 'Canvas & Image' | 'Edit & Selection' | 'Tools & Size' | 'File & View';
}

export const KEYBOARD_SHORTCUTS: ShortcutDescriptor[] = [
  // Canvas & Image
  { keys: 'Ctrl+F', label: 'Flip horizontal', category: 'Canvas & Image' },
  { keys: 'Ctrl+Shift+F', label: 'Flip vertical', category: 'Canvas & Image' },
  { keys: 'Ctrl+Shift+X', label: 'Crop to selection', category: 'Canvas & Image' },
  { keys: 'Ctrl+E', label: 'Resize canvas', category: 'Canvas & Image' },
  { keys: 'Ctrl+I', label: 'Invert layer colors', category: 'Canvas & Image' },

  // Edit & Selection
  { keys: 'Ctrl+Z', label: 'Undo', category: 'Edit & Selection' },
  { keys: 'Ctrl+Y / Ctrl+Shift+Z', label: 'Redo', category: 'Edit & Selection' },
  { keys: 'Ctrl+C', label: 'Copy selection / canvas', category: 'Edit & Selection' },
  { keys: 'Ctrl+X', label: 'Cut selection', category: 'Edit & Selection' },
  { keys: 'Ctrl+V', label: 'Paste from clipboard', category: 'Edit & Selection' },
  { keys: 'Ctrl+A', label: 'Select all', category: 'Edit & Selection' },
  { keys: 'Delete', label: 'Delete selection', category: 'Edit & Selection' },
  { keys: 'Esc', label: 'Clear selection', category: 'Edit & Selection' },

  // Tools & Size
  { keys: 'B', label: 'Brush tool', category: 'Tools & Size' },
  { keys: 'P', label: 'Pencil tool', category: 'Tools & Size' },
  { keys: 'K', label: 'Fill bucket tool', category: 'Tools & Size' },
  { keys: 'E', label: 'Eraser tool', category: 'Tools & Size' },
  { keys: 'T', label: 'Text tool', category: 'Tools & Size' },
  { keys: 'I', label: 'Color picker tool', category: 'Tools & Size' },
  { keys: 'M', label: 'Magnifier tool', category: 'Tools & Size' },
  { keys: 'S', label: 'Select tool', category: 'Tools & Size' },
  { keys: '[ / ]', label: 'Decrease / Increase size', category: 'Tools & Size' },

  // File & View
  { keys: 'Ctrl+S', label: 'Save / Export artwork', category: 'File & View' },
  { keys: 'Ctrl+Shift+S', label: 'Quick Save PNG to downloads', category: 'File & View' },
  { keys: 'Ctrl+Shift+H', label: 'Share canvas or session link', category: 'File & View' },
  { keys: 'Ctrl+O', label: 'Open Paint Book', category: 'File & View' },
  { keys: 'Ctrl+P', label: 'Print artwork', category: 'File & View' },
  { keys: 'Ctrl+G', label: 'Toggle gridlines', category: 'File & View' },
  { keys: 'Alt+R', label: 'Toggle pixel rulers', category: 'File & View' },
  { keys: 'Ctrl++ / - / 0', label: 'Zoom in / out / 100%', category: 'File & View' },
  { keys: 'Ctrl+F1', label: 'Collapse / Expand ribbon', category: 'File & View' },
];

/**
 * Pure keyboard shortcut matcher following classic Windows Paint bindings
 * with modifier precedence (Shift combos evaluated before non-Shift combos).
 */
export function resolveKeyboardShortcut(
  e: ShortcutKeyEvent,
  options?: { hasSelection?: boolean }
): ShortcutAction | null {
  const mod = Boolean(e.ctrlKey || e.metaKey);
  const shift = Boolean(e.shiftKey);
  const alt = Boolean(e.altKey);
  const key = e.key.toLowerCase();

  // Function keys & non-letter special keys
  if (e.ctrlKey && e.key === 'F1') {
    return 'toggle-ribbon';
  }
  if (!mod && !alt && e.key === 'F11') {
    return 'toggle-fullscreen';
  }
  if (!mod && !alt && e.key === 'Delete' && options?.hasSelection) {
    return 'delete-selection';
  }
  if (!mod && !alt && e.key === 'Escape') {
    return 'clear-selection';
  }

  // Alt-only shortcuts
  if (alt && !mod) {
    if (key === 'r') return 'toggle-rulers';
    if (key === 'n') return 'new-canvas';
    return null;
  }

  // Ctrl / Cmd modifier shortcuts
  if (mod && !alt) {
    // Shift+Ctrl combinations first (higher specificity)
    if (shift && key === 'z') return 'redo';
    if (shift && key === 's') return 'quick-save';
    if (shift && key === 'h') return 'share';
    if (shift && key === 'x') return 'crop';
    if (shift && key === 'f') return 'flip-vertical';

    // Standard Ctrl combinations
    if (key === 'z') return 'undo';
    if (key === 'y') return 'redo';
    if (key === 's') return 'save';
    if (key === 'o') return 'open-templates';
    if (key === 'p') return 'print';
    if (key === 'c') return 'copy';
    if (key === 'x') return 'cut';
    if (key === 'v') return 'paste';
    if (key === 'a') return 'select-all';
    if (key === 'f') return 'flip-horizontal';
    if (key === 'e') return 'resize';
    if (key === 'i') return 'filter-invert';
    if (key === 'g') return 'toggle-grid';
    if (key === '=' || key === '+') return 'zoom-in';
    if (key === '-') return 'zoom-out';
    if (key === '0') return 'zoom-reset';

    return null;
  }

  // Unmodified single-key tool & brush size shortcuts
  if (!mod && !alt && !shift) {
    if (key === 'b') return 'tool-brush';
    if (key === 'p') return 'tool-pencil';
    if (key === 'k') return 'tool-bucket';
    if (key === 'e') return 'tool-eraser';
    if (key === 't') return 'tool-text';
    if (key === 'i') return 'tool-picker';
    if (key === 'm') return 'tool-magnifier';
    if (key === 's') return 'tool-select';
    if (e.key === '[') return 'size-decrease';
    if (e.key === ']') return 'size-increase';
  }

  return null;
}
