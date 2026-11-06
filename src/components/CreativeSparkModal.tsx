import React, { useState } from 'react';
import { X, RefreshCw, Lightbulb, Palette } from 'lucide-react';
import { getRandomSpark, COLOR_SUGGESTIONS } from '../data/creative';

interface CreativeSparkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectColor: (hex: string) => void;
}

export const CreativeSparkModal: React.FC<CreativeSparkModalProps> = ({
  isOpen,
  onClose,
  onSelectColor,
}) => {
  const [currentTip, setCurrentTip] = useState<string>(getRandomSpark());

  if (!isOpen) return null;

  const handleNextTip = () => {
    setCurrentTip(getRandomSpark());
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200 cursor-pointer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="creative-spark-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 cursor-default"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h2 id="creative-spark-title" className="text-base font-bold text-slate-900">
              Studio Tips & Harmonizers
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close tips"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-5 text-xs bg-slate-50/50">
          {/* Inspiration Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/80 border border-blue-100 relative overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-blue-900 font-bold text-xs">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span>Creative Insight</span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed font-medium mb-3">
              "{currentTip}"
            </p>
            <button
              onClick={handleNextTip}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-blue-50 border border-blue-200 text-[11px] font-semibold text-blue-700 transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
              <span>Next Idea</span>
            </button>
          </div>

          {/* Curated Color Harmonizer */}
          <div>
            <div className="flex items-center gap-1.5 text-slate-800 font-bold mb-1">
              <Palette className="w-4 h-4 text-blue-600" />
              <span>Curated Studio Harmonizers</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2.5">
              Tap any signature shade to load it instantly onto your brush:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {COLOR_SUGGESTIONS.slice(0, 6).map((color) => (
                <button
                  key={color.name}
                  onClick={() => {
                    onSelectColor(color.hex);
                    onClose();
                  }}
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:border-blue-400 flex items-center gap-2.5 text-left transition-all active:scale-95 shadow-sm cursor-pointer hover:shadow"
                >
                  <div
                    className="w-7 h-7 rounded-lg border border-slate-200 shrink-0 shadow-inner"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div className="truncate">
                    <span className="block font-bold text-slate-800 text-[11px] truncate">
                      {color.name}
                    </span>
                    <span className="block text-[9px] text-slate-400 font-mono">
                      {color.hex}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
