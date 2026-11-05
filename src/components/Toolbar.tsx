import React, { useState } from 'react';
import {
  Pencil,
  Brush,
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

  // Clean, rock-solid tools without jitter or dynamic badges
  const tools: { id: ToolType; label: string; icon: React.ReactNode }[] = [
    { id: 'calligraphy', label: 'Pen', icon: <Feather className="w-5 h-5" /> },
    { id: 'pencil', label: 'Pencil', icon: <Pencil className="w-5 h-5" /> },
    { id: 'brush', label: 'Paint', icon: <Brush className="w-5 h-5" /> },
    { id: 'highlighter', label: 'Marker', icon: <Highlighter className="w-5 h-5" /> },
    { id: 'eraser', label: 'Eraser', icon: <Eraser className="w-5 h-5" /> },
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

      {/* Firmly Anchored Bottom Toolbar - Completely Static, Zero Movement */}
      <div className="fixed bottom-0 left-0 right-0 z-40 w-full pointer-events-auto bg-white/95 backdrop-blur-xl border-t border-blue-200/90 shadow-[0_-8px_25px_rgba(22,75,206,0.12)] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 px-2">
        {/* Brush Size Popover */}
        {showSizeModal && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[92vw] max-w-xs p-4 rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col gap-3.5 text-xs text-slate-800 z-50">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="font-bold text-slate-800">Brush Thickness</span>
              <button
                onClick={() => setShowSizeModal(false)}
                className="text-slate-500 hover:text-slate-900 px-2 py-0.5 rounded cursor-pointer font-medium"
              >
                Done
              </button>
            </div>

            {/* Live Size Preview */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-slate-500">Preview</span>
              <div className="w-10 h-10 flex items-center justify-center bg-white rounded-lg border border-slate-200">
                <div
                  className="rounded-full"
                  style={{
                    width: `${Math.min(36, Math.max(3, currentSize))}px`,
                    height: `${Math.min(36, Math.max(3, currentSize))}px`,
                    backgroundColor: currentTool === 'eraser' ? '#94A3B8' : currentColor,
                    opacity: currentOpacity,
                  }}
                />
              </div>
              <span className="font-mono font-bold text-slate-800">{currentSize} px</span>
            </div>

            {/* Size Slider */}
            <div>
              <div className="flex justify-between mb-1 text-slate-600 font-medium">
                <span>Stroke Size</span>
                <span>{currentSize}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                value={currentSize}
                onChange={(e) => onSizeChange(parseInt(e.target.value, 10))}
                className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
            </div>

            {/* Quick Size Presets */}
            <div className="grid grid-cols-4 gap-1.5">
              {sizePresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => onSizeChange(preset.value)}
                  className={`py-1 px-1 rounded-lg font-semibold text-center cursor-pointer ${
                    currentSize === preset.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Opacity Slider */}
            <div>
              <div className="flex justify-between mb-1 text-slate-600 font-medium">
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
                className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Stable Nav Grid: Every button has fixed width and height so nothing ever moves or shifts */}
        <nav
          className="max-w-md mx-auto flex items-center justify-between gap-1"
          aria-label="Drawing Tools Navigation"
        >
          {/* Static Tools */}
          {tools.map((t) => {
            const isActive = currentTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  onToolSelect(t.id);
                  setShowSizeModal(false);
                }}
                className={`w-12 h-12 flex-1 max-w-[54px] rounded-xl flex flex-col items-center justify-center cursor-pointer select-none ${
                  isActive
                    ? 'bg-[#164BCE] text-white shadow-sm'
                    : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50/70'
                }`}
                title={t.label}
                aria-label={`Select ${t.label} tool`}
              >
                {t.icon}
                <span className="text-[10px] font-semibold mt-0.5 leading-none">
                  {t.label}
                </span>
              </button>
            );
          })}

          <div className="h-6 w-[1px] bg-slate-200 shrink-0 mx-0.5" />

          {/* Size Button */}
          <button
            onClick={() => {
              setShowSizeModal(!showSizeModal);
            }}
            className={`w-11 h-12 rounded-xl flex flex-col items-center justify-center border cursor-pointer select-none ${
              showSizeModal
                ? 'bg-blue-50 border-blue-400 text-blue-700'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title="Brush thickness"
            aria-label="Brush thickness"
          >
            <div
              className="rounded-full bg-slate-800 mb-0.5"
              style={{
                width: `${Math.min(14, Math.max(3, currentSize / 2.5))}px`,
                height: `${Math.min(14, Math.max(3, currentSize / 2.5))}px`,
              }}
            />
            <span className="text-[9px] font-mono font-semibold">{currentSize}px</span>
          </button>

          {/* Procreate Color Wheel/Disc Button */}
          <button
            onClick={() => {
              setShowColorStudio(true);
              setShowSizeModal(false);
            }}
            className="w-11 h-12 rounded-xl flex flex-col items-center justify-center border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer select-none"
            title="Open Procreate Color Disc"
            aria-label="Color Palette"
          >
            <div
              className="w-4 h-4 rounded-full border border-slate-300 shadow-sm mb-0.5"
              style={{ backgroundColor: currentColor }}
            />
            <span className="text-[9px] font-semibold text-slate-700">Color</span>
          </button>

          {/* Surprise Lucky Color Button */}
          <button
            onClick={handleRandomColorClick}
            className="w-10 h-12 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 flex flex-col items-center justify-center cursor-pointer select-none"
            title="Random color"
            aria-label="Random color suggestion"
          >
            <Shuffle className="w-4 h-4 text-blue-600" />
            <span className="text-[9px] font-semibold">Lucky</span>
          </button>

          {/* Paint Books Trigger */}
          <button
            onClick={onOpenTemplates}
            className="w-11 h-12 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex flex-col items-center justify-center cursor-pointer select-none shadow-sm"
            title="Open Template Tracing Gallery"
            aria-label="Drawing Templates"
          >
            <Layers className="w-4 h-4 text-blue-600" />
            <span className="text-[9px] font-bold text-blue-700">Books</span>
          </button>
        </nav>
      </div>
    </>
  );
};
