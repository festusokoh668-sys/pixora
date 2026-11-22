import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Pipette, Shuffle, Sun, Moon, Clock, Palette } from 'lucide-react';
import {
  hexToRgb,
  rgbToHex,
  rgbToHsv,
  hsvToRgb,
  MAX_RECENT_COLORS,
  POPULAR_COLOR_PALETTE,
  ColorTarget,
  recordRecentColor,
  resolveTargetColor,
} from '../utils/color';
import {
  COLOR_SWATCHES,
  CLASSIC_PAINT_BOX,
  SKIN_TONE_PALETTE,
  PASTEL_PALETTE,
  NEON_PALETTE,
  NATURE_PALETTE,
  JEWEL_METALLIC_PALETTE,
  getRandomColor,
} from '../data/creative';

interface ColorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  onColorChange: (hex: string) => void;
  secondaryColor?: string;
  onSecondaryColorChange?: (hex: string) => void;
  onAddCustomColor?: (hex: string) => void;
  recentColors?: string[];
  onCommitRecentColor?: (hex: string) => void;
  themeMode?: 'bright' | 'dark';
  onToggleTheme?: () => void;
}

export const ColorsModal: React.FC<ColorsModalProps> = ({
  isOpen,
  onClose,
  currentColor,
  onColorChange,
  secondaryColor,
  onSecondaryColorChange,
  onAddCustomColor,
  recentColors: recentColorsProp,
  onCommitRecentColor,
  themeMode,
  onToggleTheme,
}) => {
  const [activeTab, setActiveTab] = useState<'spectrum' | 'sliders' | 'palettes'>('spectrum');
  const [activeTarget, setActiveTarget] = useState<ColorTarget>('primary');
  const effectiveSecondaryColor = secondaryColor ?? '#FFFFFF';
  const activeColor = resolveTargetColor(activeTarget, currentColor, effectiveSecondaryColor);

  const [rgb, setRgb] = useState<{ r: number; g: number; b: number }>(() => hexToRgb(activeColor));
  const [hsv, setHsv] = useState<{ h: number; s: number; v: number }>(() => {
    const initRgb = hexToRgb(activeColor);
    return rgbToHsv(initRgb.r, initRgb.g, initRgb.b);
  });
  const [hexInput, setHexInput] = useState<string>(activeColor);
  const [previousColor, setPreviousColor] = useState<string>(activeColor);
  const [internalRecentColors, setInternalRecentColors] = useState<string[]>([]);

  const spectrumRef = useRef<HTMLDivElement>(null);
  const isDraggingSpectrum = useRef<boolean>(false);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const latestHexRef = useRef<string>(activeColor.toUpperCase());

  const effectiveRecentColors = recentColorsProp ?? internalRecentColors;

  const commitTargetColor = useCallback(
    (hex: string, targetOverride?: ColorTarget) => {
      const target = targetOverride ?? activeTarget;
      if (target === 'secondary' && onSecondaryColorChange) {
        onSecondaryColorChange(hex);
      } else {
        onColorChange(hex);
      }
    },
    [activeTarget, onColorChange, onSecondaryColorChange]
  );

  const commitRecentColor = useCallback(
    (hex: string) => {
      if (onCommitRecentColor) {
        onCommitRecentColor(hex);
      } else {
        setInternalRecentColors((prev) => recordRecentColor(prev, hex));
      }
    },
    [onCommitRecentColor]
  );

  // Snapshot previousColor and reset target to primary whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTarget('primary');
      setPreviousColor(currentColor);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync internal state when external activeColor or target changes
  useEffect(() => {
    const newRgb = hexToRgb(activeColor);
    setRgb(newRgb);
    setHsv(rgbToHsv(newRgb.r, newRgb.g, newRgb.b));
    const upper = activeColor.toUpperCase();
    setHexInput(upper);
    latestHexRef.current = upper;
  }, [activeColor]);

  // Complete spectrum drag reliably even if pointer releases outside spectrum box
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDraggingSpectrum.current) {
        isDraggingSpectrum.current = false;
        commitRecentColor(latestHexRef.current);
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [commitRecentColor]);

  if (!isOpen) return null;

  const handleSwitchTarget = (nextTarget: ColorTarget) => {
    setActiveTarget(nextTarget);
    const nextColor = resolveTargetColor(nextTarget, currentColor, effectiveSecondaryColor);
    setPreviousColor(nextColor);
  };

  // Update from HSV
  const updateFromHsv = (newHsv: { h: number; s: number; v: number }) => {
    setHsv(newHsv);
    const newRgb = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
    setRgb(newRgb);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setHexInput(newHex);
    latestHexRef.current = newHex;
    commitTargetColor(newHex);
  };

  // Update from RGB
  const updateFromRgb = (newRgb: { r: number; g: number; b: number }) => {
    setRgb(newRgb);
    setHsv(rgbToHsv(newRgb.r, newRgb.g, newRgb.b));
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setHexInput(newHex);
    latestHexRef.current = newHex;
    commitTargetColor(newHex);
  };

  // Update from Hex String
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setHexInput(val);
    if (/^#[0-9A-F]{6}$/i.test(val)) {
      const newRgb = hexToRgb(val);
      setRgb(newRgb);
      setHsv(rgbToHsv(newRgb.r, newRgb.g, newRgb.b));
      latestHexRef.current = val;
      commitTargetColor(val);
      commitRecentColor(val);
    }
  };

  // 2D HSV Spectrum Dragging (X = Saturation 0..100%, Y = Value/Brightness 100..0%)
  const handleSpectrumPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDraggingSpectrum.current = true;
    handleSpectrumPointerMove(e);
  };

  const handleSpectrumPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSpectrum.current || !spectrumRef.current) return;
    const rect = spectrumRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const s = Math.round((x / rect.width) * 100);
    const v = Math.round((1 - y / rect.height) * 100);

    updateFromHsv({ ...hsv, s, v });
  };

  const handleSpectrumPointerUp = () => {
    if (isDraggingSpectrum.current) {
      isDraggingSpectrum.current = false;
      commitRecentColor(latestHexRef.current);
    }
  };

  const handlePickPreset = (hex: string, autoClose = false, targetOverride?: ColorTarget) => {
    const upper = hex.toUpperCase();
    const resolvedTarget = targetOverride ?? activeTarget;
    commitTargetColor(upper, resolvedTarget);
    commitRecentColor(upper);
    if (resolvedTarget === activeTarget) {
      latestHexRef.current = upper;
      const newRgb = hexToRgb(upper);
      setRgb(newRgb);
      setHsv(rgbToHsv(newRgb.r, newRgb.g, newRgb.b));
      setHexInput(upper);
    }
    if (autoClose) {
      onClose();
    }
  };

  // Eyedropper trigger: closes Accurate Colors Studio immediately so full canvas is visible
  const handleTriggerEyedropper = async () => {
    onClose();
    if ('EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          const pickedHex = result.sRGBHex.toUpperCase();
          commitTargetColor(pickedHex);
          commitRecentColor(pickedHex);
        }
      } catch {
        colorInputRef.current?.click();
      }
    } else {
      colorInputRef.current?.click();
    }
  };

  const flourishPalette = [
    '#F43F5E', '#FB7185', '#FDA4AF', '#F472B6', '#E879F9', '#C084FC',
    '#818CF8', '#60A5FA', '#38BDF8', '#2DD4BF', '#34D399', '#A3E635',
    '#FACC15', '#FB923C', '#F87171', '#94A3B8', '#475569', '#1E293B',
  ];

  const royalPalette = [
    '#080B12', '#0F2B7A', '#164BCE', '#2563EB', '#3B82F6', '#60A5FA',
    '#93C5FD', '#BFDBFE', '#FFFFFF', '#D6A928', '#F59E0B', '#FBBF24',
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200 cursor-pointer"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-slate-900 border-t sm:border border-slate-800/90 rounded-t-3xl sm:rounded-2xl shadow-[0_-8px_35px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden text-white cursor-default max-h-[85vh]"
      >
        {/* Hidden Native Input */}
        <input
          ref={colorInputRef}
          type="color"
          value={activeColor.startsWith('#') && activeColor.length === 7 ? activeColor : '#164BCE'}
          onChange={(e) => handlePickPreset(e.target.value)}
          className="hidden"
        />

        {/* Top Header of Open Color Studio Modal */}
        <div className="p-3 sm:p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
              Color Studio
            </h2>
            {/* Split Swatch: Previous vs Active Selected Color */}
            <div className="flex items-center rounded-lg overflow-hidden border border-slate-700 h-6 w-12 shadow-inner">
              <div
                className="w-1/2 h-full cursor-pointer hover:opacity-90"
                style={{ backgroundColor: previousColor }}
                title="Previous color (Tap to revert)"
                onClick={() => handlePickPreset(previousColor)}
              />
              <div
                className="w-1/2 h-full"
                style={{ backgroundColor: activeColor }}
                title="Current targeted color"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Upper Color Studio Bright / Dark Mode Toggle Button */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[10px] sm:text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                  themeMode === 'dark'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-blue-500/20 text-blue-300 border-blue-400/40 hover:bg-blue-500/30'
                }`}
                title={themeMode === 'dark' ? 'Switch to Bright Mode' : 'Switch to Dark Mode'}
              >
                {themeMode === 'dark' ? (
                  <>
                    <Sun className="w-3 h-3 text-amber-400" />
                    <span>Bright Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3 h-3 text-blue-400" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const upper = activeColor.toUpperCase();
                commitRecentColor(upper);
                onAddCustomColor?.(upper);
                onClose();
              }}
              className="px-3.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              Apply
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-4 flex flex-col items-center gap-2.5 text-xs overflow-y-auto max-h-[72vh]">
          {/* Primary / Secondary Target Switcher */}
          <div
            data-testid="colors-modal-target-bar"
            className="w-full grid grid-cols-2 gap-1.5 rounded-xl bg-slate-950/80 border border-slate-800 p-1"
          >
            <button
              type="button"
              data-testid="colors-modal-target-primary"
              aria-pressed={activeTarget === 'primary'}
              onClick={() => handleSwitchTarget('primary')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer ${
                activeTarget === 'primary'
                  ? 'bg-slate-800 text-white ring-1 ring-blue-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span
                data-testid="colors-modal-primary-swatch"
                className="w-4 h-4 rounded-md border border-slate-500 shrink-0"
                style={{ backgroundColor: currentColor }}
              />
              <span className="min-w-0 flex-1 flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold">Primary</span>
                <span className="font-mono text-[10px] text-slate-400">
                  {currentColor.toUpperCase()}
                </span>
              </span>
            </button>

            <button
              type="button"
              data-testid="colors-modal-target-secondary"
              aria-pressed={activeTarget === 'secondary'}
              onClick={() => handleSwitchTarget('secondary')}
              disabled={!onSecondaryColorChange}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                activeTarget === 'secondary'
                  ? 'bg-slate-800 text-white ring-1 ring-blue-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span
                data-testid="colors-modal-secondary-swatch"
                className="w-4 h-4 rounded-md border border-slate-500 shrink-0"
                style={{ backgroundColor: effectiveSecondaryColor }}
              />
              <span className="min-w-0 flex-1 flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold">Secondary</span>
                <span className="font-mono text-[10px] text-slate-400">
                  {effectiveSecondaryColor.toUpperCase()}
                </span>
              </span>
            </button>
          </div>

          {activeTab === 'spectrum' && (
            <>
              {/* High-Precision 2D HSV Saturation-Value Canvas Box */}
              <div
                ref={spectrumRef}
                onPointerDown={handleSpectrumPointerDown}
                onPointerMove={handleSpectrumPointerMove}
                onPointerUp={handleSpectrumPointerUp}
                onPointerCancel={handleSpectrumPointerUp}
                className="relative w-full h-36 sm:h-40 rounded-xl cursor-crosshair select-none overflow-hidden shadow-inner border border-slate-700 touch-none shrink-0"
                style={{
                  backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
                  backgroundImage: `
                    linear-gradient(to top, #000, transparent),
                    linear-gradient(to right, #fff, transparent)
                  `,
                }}
              >
                {/* Precision Crosshair Thumb Marker */}
                <div
                  className="absolute w-5 h-5 rounded-full border-2 border-white shadow-xl -translate-x-1/2 -translate-y-1/2 pointer-events-none ring-2 ring-black/40"
                  style={{
                    left: `${hsv.s}%`,
                    top: `${100 - hsv.v}%`,
                    backgroundColor: activeColor,
                  }}
                />
              </div>

              {/* Hue 0-360 Spectrum Slider */}
              <div className="w-full flex flex-col gap-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>Hue Spectrum</span>
                  <span className="font-mono text-blue-400">{hsv.h}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={hsv.h}
                  onChange={(e) => updateFromHsv({ ...hsv, h: parseInt(e.target.value, 10) })}
                  onPointerUp={() => commitRecentColor(latestHexRef.current)}
                  onKeyUp={() => commitRecentColor(latestHexRef.current)}
                  className="w-full h-3 rounded-lg cursor-pointer accent-white"
                  style={{
                    background:
                      'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                  }}
                />
              </div>
            </>
          )}

          {activeTab === 'sliders' && (
            <div className="w-full flex flex-col gap-3 py-1">
              {/* Red Slider */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-red-400 mb-1">
                  <span>Red (R)</span>
                  <span className="font-mono">{rgb.r}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={rgb.r}
                  onChange={(e) => updateFromRgb({ ...rgb, r: parseInt(e.target.value, 10) })}
                  onPointerUp={() => commitRecentColor(latestHexRef.current)}
                  onKeyUp={() => commitRecentColor(latestHexRef.current)}
                  className="w-full h-2.5 rounded-lg cursor-pointer accent-red-500 bg-slate-800"
                />
              </div>

              {/* Green Slider */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-emerald-400 mb-1">
                  <span>Green (G)</span>
                  <span className="font-mono">{rgb.g}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={rgb.g}
                  onChange={(e) => updateFromRgb({ ...rgb, g: parseInt(e.target.value, 10) })}
                  onPointerUp={() => commitRecentColor(latestHexRef.current)}
                  onKeyUp={() => commitRecentColor(latestHexRef.current)}
                  className="w-full h-2.5 rounded-lg cursor-pointer accent-emerald-500 bg-slate-800"
                />
              </div>

              {/* Blue Slider */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-blue-400 mb-1">
                  <span>Blue (B)</span>
                  <span className="font-mono">{rgb.b}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={rgb.b}
                  onChange={(e) => updateFromRgb({ ...rgb, b: parseInt(e.target.value, 10) })}
                  onPointerUp={() => commitRecentColor(latestHexRef.current)}
                  onKeyUp={() => commitRecentColor(latestHexRef.current)}
                  className="w-full h-2.5 rounded-lg cursor-pointer accent-blue-500 bg-slate-800"
                />
              </div>
            </div>
          )}

          {activeTab === 'palettes' && (
            <div className="w-full flex flex-col gap-4 py-1 max-h-56 overflow-y-auto pr-1">
              {[
                { title: 'Classic MS Paint Box', items: CLASSIC_PAINT_BOX },
                { title: 'Skin & Portrait Tones', items: SKIN_TONE_PALETTE },
                { title: 'Pastels & Soft Hues', items: PASTEL_PALETTE },
                { title: 'Neon & Cyber Vibrants', items: NEON_PALETTE },
                { title: 'Nature & Earth', items: NATURE_PALETTE },
                { title: 'Jewel & Metallic Tones', items: JEWEL_METALLIC_PALETTE },
              ].map((section) => (
                <div key={section.title}>
                  <span className="text-[10.5px] font-black text-slate-300 block mb-1.5 uppercase tracking-wider">
                    {section.title}
                  </span>
                  <div className="grid grid-cols-7 sm:grid-cols-9 gap-1">
                    {section.items.map((item) => (
                      <button
                        key={item.name + item.hex}
                        onClick={() => handlePickPreset(item.hex, true)}
                        className={`h-6.5 sm:h-6 rounded-md border transition-transform active:scale-90 cursor-pointer ${
                          activeColor.toLowerCase() === item.hex.toLowerCase()
                            ? 'border-white scale-110 shadow-md ring-2 ring-blue-500 z-10'
                            : 'border-slate-700/80 hover:scale-105 hover:border-slate-400'
                        }`}
                        style={{ backgroundColor: item.hex }}
                        title={`${item.name} (${item.hex})`}
                        aria-label={item.name}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Precision HEX Input & Eyedropper Toolbar */}
          <div className="w-full flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
            {/* Hex Input */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 flex-1">
              <span className="text-slate-400 font-bold text-xs">HEX</span>
              <input
                type="text"
                value={hexInput}
                onChange={handleHexInputChange}
                maxLength={7}
                placeholder="#164BCE"
                className="w-20 bg-transparent font-mono font-bold text-blue-400 uppercase text-xs focus:outline-none"
              />
            </div>

            {/* Native Eyedropper Trigger */}
            <button
              onClick={handleTriggerEyedropper}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-bold border border-blue-500/40 cursor-pointer active:scale-95 transition-all text-xs"
              title="Pick exact color from screen"
            >
              <Pipette className="w-3.5 h-3.5 text-blue-300" />
              <span>Picker</span>
            </button>

            {/* Random Color */}
            <button
              onClick={() => {
                const s = getRandomColor();
                handlePickPreset(s.hex, true);
              }}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
              title="Random color"
            >
              <Shuffle className="w-4 h-4 text-blue-400" />
            </button>
          </div>

          {/* Color Palette Section (12 popular color presets) */}
          <div
            data-testid="color-palette-section"
            className="w-full rounded-xl bg-slate-950/70 border border-slate-800 px-2.5 py-2 flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-300">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <Palette className="w-3 h-3 text-blue-400" />
                <span>Color Palette</span>
              </span>
              <span className="text-[10px] font-medium text-slate-400">
                Updating {activeTarget === 'secondary' ? 'Secondary' : 'Primary'}
              </span>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {POPULAR_COLOR_PALETTE.map((preset, idx) => {
                const isActive = activeColor.toUpperCase() === preset.hex.toUpperCase();
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    data-testid={`color-palette-preset-${idx}`}
                    onClick={() => handlePickPreset(preset.hex, false)}
                    onContextMenu={(e) => {
                      if (!onSecondaryColorChange) return;
                      e.preventDefault();
                      handlePickPreset(preset.hex, false, 'secondary');
                    }}
                    className={`h-7 w-full rounded-lg border transition-transform active:scale-90 cursor-pointer ${
                      isActive
                        ? 'border-white scale-105 ring-2 ring-blue-400 z-10'
                        : 'border-slate-700 hover:scale-105 hover:border-slate-400'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                    title={`${preset.name} (${preset.hex}) — Click to set ${
                      activeTarget === 'secondary' ? 'Secondary' : 'Primary'
                    }${onSecondaryColorChange ? ' • Right-click for Secondary' : ''}`}
                    aria-label={`${preset.name} (${preset.hex})`}
                  />
                );
              })}
            </div>
          </div>

          {/* Recent Colors History (Last 10 unique colors selected) */}
          <div
            data-testid="recent-colors-section"
            className="w-full rounded-xl bg-slate-950/70 border border-slate-800 px-2.5 py-2 flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-300">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="w-3 h-3 text-blue-400" />
                <span>Recent Colors</span>
              </span>
              <span
                data-testid="recent-colors-count"
                className="font-mono text-[10px] text-slate-400"
              >
                {effectiveRecentColors.length}/{MAX_RECENT_COLORS}
              </span>
            </div>

            {effectiveRecentColors.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-0.5">
                No recent colors yet — select or apply colors to build your history.
              </p>
            ) : (
              <div className="grid grid-cols-10 gap-1">
                {effectiveRecentColors.map((hex, idx) => {
                  const isActive = activeColor.toUpperCase() === hex.toUpperCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      data-testid={`recent-color-swatch-${idx}`}
                      onClick={() => handlePickPreset(hex, false)}
                      className={`h-6.5 w-full rounded-md border transition-transform active:scale-90 cursor-pointer ${
                        isActive
                          ? 'border-white scale-105 ring-2 ring-blue-400 z-10'
                          : 'border-slate-700 hover:scale-105 hover:border-slate-400'
                      }`}
                      style={{ backgroundColor: hex }}
                      title={`Reuse ${hex}`}
                      aria-label={`Reuse recent color ${hex}`}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Swatches Quick Bar - Tightly Packed */}
          <div className="w-full flex items-center justify-between gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            {COLOR_SWATCHES.slice(0, 10).map((sw) => (
              <button
                key={sw.hex}
                onClick={() => handlePickPreset(sw.hex, true)}
                className={`w-6 h-6 rounded-md border shrink-0 transition-transform active:scale-90 cursor-pointer ${
                  activeColor.toLowerCase() === sw.hex.toLowerCase()
                    ? 'border-white scale-110 ring-2 ring-blue-500'
                    : 'border-slate-700'
                }`}
                style={{ backgroundColor: sw.hex }}
                title={sw.name}
              />
            ))}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 border-t border-slate-800 bg-slate-950 p-1 text-[11px] font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('spectrum')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'spectrum' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Spectrum
          </button>
          <button
            onClick={() => setActiveTab('sliders')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'sliders' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            RGB Sliders
          </button>
          <button
            onClick={() => setActiveTab('palettes')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'palettes' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Palettes
          </button>
        </div>
      </div>
    </div>
  );
};
