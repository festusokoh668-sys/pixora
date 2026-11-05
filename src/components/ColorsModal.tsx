import React, { useState, useEffect, useRef } from 'react';
import { X, Pipette, Shuffle } from 'lucide-react';
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } from '../utils/color';
import { COLOR_SWATCHES, getRandomColor } from '../data/creative';

interface ColorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  onColorChange: (hex: string) => void;
}

export const ColorsModal: React.FC<ColorsModalProps> = ({
  isOpen,
  onClose,
  currentColor,
  onColorChange,
}) => {
  const [activeTab, setActiveTab] = useState<'spectrum' | 'sliders' | 'palettes'>('spectrum');
  const [rgb, setRgb] = useState<{ r: number; g: number; b: number }>(() => hexToRgb(currentColor));
  const [hsv, setHsv] = useState<{ h: number; s: number; v: number }>(() => {
    const initRgb = hexToRgb(currentColor);
    return rgbToHsv(initRgb.r, initRgb.g, initRgb.b);
  });
  const [hexInput, setHexInput] = useState<string>(currentColor);
  const [previousColor] = useState<string>(currentColor);

  const spectrumRef = useRef<HTMLDivElement>(null);
  const isDraggingSpectrum = useRef<boolean>(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Sync internal state when external currentColor changes
  useEffect(() => {
    const newRgb = hexToRgb(currentColor);
    setRgb(newRgb);
    setHsv(rgbToHsv(newRgb.r, newRgb.g, newRgb.b));
    setHexInput(currentColor.toUpperCase());
  }, [currentColor]);

  if (!isOpen) return null;

  // Update from HSV
  const updateFromHsv = (newHsv: { h: number; s: number; v: number }) => {
    setHsv(newHsv);
    const newRgb = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
    setRgb(newRgb);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setHexInput(newHex);
    onColorChange(newHex);
  };

  // Update from RGB
  const updateFromRgb = (newRgb: { r: number; g: number; b: number }) => {
    setRgb(newRgb);
    setHsv(rgbToHsv(newRgb.r, newRgb.g, newRgb.b));
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setHexInput(newHex);
    onColorChange(newHex);
  };

  // Update from Hex String
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setHexInput(val);
    if (/^#[0-9A-F]{6}$/i.test(val)) {
      const newRgb = hexToRgb(val);
      setRgb(newRgb);
      setHsv(rgbToHsv(newRgb.r, newRgb.g, newRgb.b));
      onColorChange(val);
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
    isDraggingSpectrum.current = false;
  };

  const handlePickPreset = (hex: string) => {
    onColorChange(hex);
    const newRgb = hexToRgb(hex);
    setRgb(newRgb);
    setHsv(rgbToHsv(newRgb.r, newRgb.g, newRgb.b));
    setHexInput(hex.toUpperCase());
  };

  // Eyedropper trigger
  const handleTriggerEyedropper = async () => {
    if ('EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          handlePickPreset(result.sRGBHex.toUpperCase());
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-sm bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Hidden Native Input */}
        <input
          ref={colorInputRef}
          type="color"
          value={currentColor.startsWith('#') && currentColor.length === 7 ? currentColor : '#164BCE'}
          onChange={(e) => handlePickPreset(e.target.value)}
          className="hidden"
        />

        {/* Top Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Accurate Color Studio</h2>
            {/* Split Swatch: Previous vs Active Selected Color */}
            <div className="flex items-center rounded-lg overflow-hidden border border-slate-700 h-6 w-14 shadow-inner">
              <div
                className="w-1/2 h-full cursor-pointer"
                style={{ backgroundColor: previousColor }}
                title="Previous color (Tap to revert)"
                onClick={() => handlePickPreset(previousColor)}
              />
              <div
                className="w-1/2 h-full"
                style={{ backgroundColor: currentColor }}
                title="Current active color"
              />
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition-all cursor-pointer shadow-sm active:scale-95"
          >
            Apply
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 flex flex-col items-center gap-4 text-xs">
          {activeTab === 'spectrum' && (
            <>
              {/* High-Precision 2D HSV Saturation-Value Canvas Box */}
              <div
                ref={spectrumRef}
                onPointerDown={handleSpectrumPointerDown}
                onPointerMove={handleSpectrumPointerMove}
                onPointerUp={handleSpectrumPointerUp}
                onPointerCancel={handleSpectrumPointerUp}
                className="relative w-full h-48 rounded-2xl cursor-crosshair select-none overflow-hidden shadow-inner border border-slate-700 touch-none"
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
                    backgroundColor: currentColor,
                  }}
                />
              </div>

              {/* Hue 0-360 Spectrum Slider */}
              <div className="w-full flex flex-col gap-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-400">
                  <span>Hue Spectrum</span>
                  <span>{hsv.h}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={hsv.h}
                  onChange={(e) => updateFromHsv({ ...hsv, h: parseInt(e.target.value, 10) })}
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
            <div className="w-full flex flex-col gap-3.5 py-1">
              {/* Red Slider */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-red-400 mb-1">
                  <span>Red (R)</span>
                  <span>{rgb.r}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={rgb.r}
                  onChange={(e) => updateFromRgb({ ...rgb, r: parseInt(e.target.value, 10) })}
                  className="w-full h-2.5 rounded-lg cursor-pointer accent-red-500"
                />
              </div>

              {/* Green Slider */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-emerald-400 mb-1">
                  <span>Green (G)</span>
                  <span>{rgb.g}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={rgb.g}
                  onChange={(e) => updateFromRgb({ ...rgb, g: parseInt(e.target.value, 10) })}
                  className="w-full h-2.5 rounded-lg cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Blue Slider */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-blue-400 mb-1">
                  <span>Blue (B)</span>
                  <span>{rgb.b}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={rgb.b}
                  onChange={(e) => updateFromRgb({ ...rgb, b: parseInt(e.target.value, 10) })}
                  className="w-full h-2.5 rounded-lg cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'palettes' && (
            <div className="w-full flex flex-col gap-4 py-1 max-h-56 overflow-y-auto">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">
                  Royalty Studio Palette
                </span>
                <div className="grid grid-cols-6 gap-2">
                  {royalPalette.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => handlePickPreset(hex)}
                      className={`h-8 rounded-lg border-2 transition-transform active:scale-90 cursor-pointer ${
                        currentColor.toLowerCase() === hex.toLowerCase()
                          ? 'border-white scale-110 shadow-lg ring-2 ring-blue-500'
                          : 'border-slate-700 hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                      aria-label={hex}
                    />
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">
                  Flourish Palette
                </span>
                <div className="grid grid-cols-6 gap-2">
                  {flourishPalette.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => handlePickPreset(hex)}
                      className={`h-8 rounded-lg border-2 transition-transform active:scale-90 cursor-pointer ${
                        currentColor.toLowerCase() === hex.toLowerCase()
                          ? 'border-white scale-110 shadow-lg ring-2 ring-blue-500'
                          : 'border-slate-700 hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                      aria-label={hex}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Precision HEX Input & Eyedropper Toolbar */}
          <div className="w-full flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
            {/* Hex Input */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 flex-1">
              <span className="text-slate-400 font-bold text-xs">HEX</span>
              <input
                type="text"
                value={hexInput}
                onChange={handleHexInputChange}
                maxLength={7}
                placeholder="#164BCE"
                className="w-24 bg-transparent font-mono font-bold text-blue-400 uppercase text-xs focus:outline-none"
              />
            </div>

            {/* Native Eyedropper Trigger */}
            <button
              onClick={handleTriggerEyedropper}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-bold border border-blue-500/40 cursor-pointer active:scale-95 transition-all"
              title="Pick exact color from screen"
            >
              <Pipette className="w-3.5 h-3.5" />
              <span>Picker</span>
            </button>

            {/* Random Color */}
            <button
              onClick={() => {
                const s = getRandomColor();
                handlePickPreset(s.hex);
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
              title="Random color"
            >
              <Shuffle className="w-4 h-4 text-blue-400" />
            </button>
          </div>

          {/* Swatches Quick Bar */}
          <div className="w-full flex items-center justify-between gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            {COLOR_SWATCHES.slice(0, 9).map((sw) => (
              <button
                key={sw.hex}
                onClick={() => handlePickPreset(sw.hex)}
                className={`w-7 h-7 rounded-lg border shrink-0 transition-transform active:scale-90 cursor-pointer ${
                  currentColor.toLowerCase() === sw.hex.toLowerCase()
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
        <div className="grid grid-cols-3 border-t border-slate-800 bg-slate-950 p-1 text-[11px] font-bold">
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
