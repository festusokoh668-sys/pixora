import React, { useState, useEffect, useRef } from 'react';
import {
  Pencil,
  Brush,
  PaintBucket,
  Highlighter,
  Feather,
  Eraser,
  Shuffle,
  Layers,
} from 'lucide-react';
import { ToolType } from '../types';
import { getRandomColor } from '../data/creative';
import { ColorsModal } from './ColorsModal';

interface ToolbarProps {
  currentTool: ToolType;
  onToolSelect: (tool: ToolType) => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  currentSize: number;
  onSizeChange: (size: number) => void;
  currentOpacity: number;
  onOpacityChange: (opacity: number) => void;
  onOpenTemplates: () => void;
  onLuckyColor: (name: string, hex: string) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  onToolSelect,
  currentColor,
  onColorChange,
  currentSize,
  onSizeChange,
  currentOpacity,
  onOpacityChange,
  onOpenTemplates,
  onLuckyColor,
}) => {
  const [showSizeModal, setShowSizeModal] = useState<boolean>(false);
  const [showColorStudio, setShowColorStudio] = useState<boolean>(false);
  const sizeModalRef = useRef<HTMLDivElement>(null);
  const sizeButtonRef = useRef<HTMLButtonElement>(null);

  // Close Brush Thickness popover when clicking outside
  useEffect(() => {
    if (!showSizeModal) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        sizeModalRef.current &&
        !sizeModalRef.current.contains(target) &&
        sizeButtonRef.current &&
        !sizeButtonRef.current.contains(target)
      ) {
        setShowSizeModal(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [showSizeModal]);

  // Realistic Paint App Studio Tools with authentic physical tool styling & SVG graphics
  const tools: { id: ToolType; label: string; icon: (active: boolean, color: string) => React.ReactNode }[] = [
    {
      id: 'calligraphy',
      label: 'Pen',
      icon: (active, color) => (
        <div className="relative flex items-center justify-center">
          <svg className="w-5 h-5 drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z" fill={active ? 'currentColor' : '#334155'} />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18" strokeWidth="2.2" />
            <path d="M2 2l7.5 7.5" strokeWidth="2" />
            <circle cx="11" cy="11" r="1.5" fill={active ? '#FFFFFF' : color} />
          </svg>
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: color }}
          />
        </div>
      ),
    },
    {
      id: 'pencil',
      label: 'Pencil',
      icon: (active, color) => (
        <div className="relative flex items-center justify-center">
          <svg className="w-5 h-5 drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            <path d="M15 5l4 4" />
            <path d="M5.5 16.5l3 3" />
            <polygon points="2 22 3.5 16.5 7.5 20.5" fill={active ? 'currentColor' : color} opacity="0.9" />
          </svg>
        </div>
      ),
    },
    {
      id: 'brush',
      label: 'Paint Brush',
      icon: (active, color) => (
        <div className="relative flex items-center justify-center">
          <svg className="w-5 h-5 drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11.5l-6 6" />
            <path d="M14 6l4 4" />
            <path d="M3 21l3.5-3.5" />
            <path d="M6.5 17.5l6-6c1.5-1.5 3.5-2.5 5.5-2.5 0 2-1 4-2.5 5.5l-6 6" strokeWidth="2" />
            {/* Paint Dipped Tip */}
            <path d="M16 4c1.5-1.5 3.5-2 5-2s-0.5 3.5-2 5-3 0.5-3 0.5z" fill={color} stroke={active ? '#FFFFFF' : color} strokeWidth="1" />
          </svg>
          <span
            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ring-1 ring-black/10"
            style={{ backgroundColor: color }}
          />
        </div>
      ),
    },
    {
      id: 'bucket',
      label: 'Paint Bucket',
      icon: (active, color) => (
        <div className="relative flex items-center justify-center">
          <svg className="w-5 h-5 drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 11L13 5l-7 7 6 6 7-7z" fill={active ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)'} />
            <path d="M5 2l5 5" strokeWidth="2" />
            <path d="M22 20c0 1.1-.9 2-2 2s-2-.9-2-2c0-1.5 2-3.5 2-3.5s2 2 2 3.5z" fill={color} stroke={active ? '#FFFFFF' : color} strokeWidth="1" />
          </svg>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: color }}
          />
        </div>
      ),
    },
    {
      id: 'highlighter',
      label: 'Marker',
      icon: (active, color) => (
        <div className="relative flex items-center justify-center">
          <svg className="w-5 h-5 drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 11-6 6v3h3l6-6" fill={active ? 'currentColor' : '#475569'} />
            <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" strokeWidth="2" />
            <path d="m14 4 4 4" />
            {/* Chisel Highlight Tip */}
            <polygon points="18 2 22 6 18 8 14 4" fill={color} opacity="0.85" />
          </svg>
        </div>
      ),
    },
    {
      id: 'eraser',
      label: 'Eraser',
      icon: (active) => (
        <div className="relative flex items-center justify-center">
          <svg className="w-5 h-5 drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" fill={active ? '#FDA4AF' : '#F1F5F9'} />
            <path d="M22 21H7" strokeWidth="2.2" />
            <path d="m5 11 9 9" />
          </svg>
        </div>
      ),
    },
  ];

  const sizePresets = [
    { label: 'Fine', value: 3 },
    { label: 'Medium', value: 8 },
    { label: 'Bold', value: 16 },
    { label: 'Thick', value: 32 },
  ];

  const handleRandomColorClick = () => {
    const sug = getRandomColor();
    onColorChange(sug.hex);
    onLuckyColor(sug.name, sug.hex);
  };

  return (
    <>
      {/* Procreate-Style Color Studio Modal */}
      <ColorsModal
        isOpen={showColorStudio}
        onClose={() => setShowColorStudio(false)}
        currentColor={currentColor}
        onColorChange={onColorChange}
      />

      {/* Firmly Anchored Bottom Toolbar - Completely Static Studio Dock */}
      <div className="fixed bottom-0 left-0 right-0 z-40 w-full pointer-events-auto bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 shadow-[0_-8px_30px_rgba(0,0,0,0.4)] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 px-2 text-white">
        {/* Brush Size Popover */}
        {showSizeModal && (
          <div
            ref={sizeModalRef}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[92vw] max-w-xs p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col gap-3.5 text-xs text-white z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-bold text-slate-200">Brush Thickness & Opacity</span>
              <button
                onClick={() => setShowSizeModal(false)}
                className="text-blue-400 hover:text-blue-300 font-bold px-2 py-0.5 rounded cursor-pointer"
              >
                Done
              </button>
            </div>

            {/* Live Size Preview */}
            <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400">Stroke Preview</span>
              <div className="w-10 h-10 flex items-center justify-center bg-slate-900 rounded-lg border border-slate-800">
                <div
                  className="rounded-full shadow-inner"
                  style={{
                    width: `${Math.min(36, Math.max(3, currentSize))}px`,
                    height: `${Math.min(36, Math.max(3, currentSize))}px`,
                    backgroundColor: currentTool === 'eraser' ? '#94A3B8' : currentColor,
                    opacity: currentOpacity,
                  }}
                />
              </div>
              <span className="font-mono font-bold text-blue-400">{currentSize} px</span>
            </div>

            {/* Size Slider */}
            <div>
              <div className="flex justify-between mb-1 text-slate-300 font-medium">
                <span>Stroke Size</span>
                <span>{currentSize}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                value={currentSize}
                onChange={(e) => onSizeChange(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Quick Size Presets */}
            <div className="grid grid-cols-4 gap-1.5">
              {sizePresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => onSizeChange(preset.value)}
                  className={`py-1 px-1 rounded-lg font-semibold text-center cursor-pointer transition-all ${
                    currentSize === preset.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Opacity Slider */}
            <div>
              <div className="flex justify-between mb-1 text-slate-300 font-medium">
                <span>Opacity</span>
                <span>{Math.round(currentOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={currentOpacity}
                onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Stable Nav Grid: Every button has fixed width and height so nothing ever moves or shifts */}
        <nav
          className="max-w-xl mx-auto flex items-center justify-between gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar"
          aria-label="Drawing Tools Navigation"
        >
          {/* Real Studio Tools */}
          {tools.map((t) => {
            const isActive = currentTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  onToolSelect(t.id);
                  setShowSizeModal(false);
                }}
                className={`w-11 sm:w-12 h-12 flex-1 max-w-[58px] rounded-xl flex flex-col items-center justify-center cursor-pointer select-none shrink-0 transition-all ${
                  isActive
                    ? 'bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-lg ring-2 ring-blue-400/60 scale-[1.03]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
                title={t.label}
                aria-label={`Select ${t.label} tool`}
              >
                {t.icon(isActive, currentColor)}
                <span className="text-[8px] sm:text-[9.5px] font-bold mt-0.5 leading-none text-center truncate max-w-full px-0.5">
                  {t.label}
                </span>
              </button>
            );
          })}

          <div className="h-6 w-[1px] bg-slate-800 shrink-0 mx-0.5" />

          {/* Size Button */}
          <button
            ref={sizeButtonRef}
            onClick={() => {
              setShowSizeModal(!showSizeModal);
            }}
            className={`w-11 h-12 rounded-xl flex flex-col items-center justify-center border cursor-pointer select-none transition-all ${
              showSizeModal
                ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                : 'bg-slate-800/90 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title="Brush thickness"
            aria-label="Brush thickness"
          >
            <div
              className="rounded-full bg-white mb-0.5 shadow-sm"
              style={{
                width: `${Math.min(14, Math.max(3, currentSize / 2.5))}px`,
                height: `${Math.min(14, Math.max(3, currentSize / 2.5))}px`,
                backgroundColor: currentTool === 'eraser' ? '#94A3B8' : currentColor,
              }}
            />
            <span className="text-[9px] font-mono font-bold">{currentSize}px</span>
          </button>

          {/* Procreate Color Wheel/Disc Button */}
          <button
            onClick={() => {
              setShowColorStudio(true);
              setShowSizeModal(false);
            }}
            className="w-11 h-12 rounded-xl flex flex-col items-center justify-center border border-slate-700/80 bg-slate-800/90 hover:bg-slate-800 transition-all cursor-pointer select-none"
            title="Open Color Palette"
            aria-label="Color Palette"
          >
            <div
              className="w-4 h-4 rounded-full border-2 border-white/90 shadow-md mb-0.5 ring-1 ring-black/40"
              style={{ backgroundColor: currentColor }}
            />
            <span className="text-[9px] font-bold text-slate-200">Color</span>
          </button>

          {/* Surprise Lucky Color Button */}
          <button
            onClick={handleRandomColorClick}
            className="w-10 h-12 rounded-xl text-slate-400 hover:text-blue-400 hover:bg-slate-800/80 flex flex-col items-center justify-center transition-colors cursor-pointer select-none"
            title="Random color"
            aria-label="Random color suggestion"
          >
            <Shuffle className="w-4 h-4 text-blue-400" />
            <span className="text-[9px] font-bold">Lucky</span>
          </button>

          {/* Paint Books Trigger */}
          <button
            onClick={onOpenTemplates}
            className="w-11 h-12 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white border border-blue-400/50 flex flex-col items-center justify-center cursor-pointer select-none shadow-md transition-all active:scale-95"
            title="Open Paint Books Stencil Gallery"
            aria-label="Drawing Templates"
          >
            <Layers className="w-4 h-4 text-white" />
            <span className="text-[9px] font-bold text-white">Books</span>
          </button>
        </nav>
      </div>
    </>
  );
};
