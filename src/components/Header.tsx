import React from 'react';
import { Lightbulb, Image as ImageIcon, Download, Trash2, Home, Sliders, Undo2, Redo2, Share2, Sun, Moon } from 'lucide-react';
import { DrawingTemplate } from '../types';

interface HeaderProps {
  onBackToHome: () => void;
  onOpenTemplates: () => void;
  onOpenSaveModal: () => void;
  onOpenClearConfirm: () => void;
  onOpenGallery: () => void;
  onOpenSpark: () => void;
  onShare: () => void;
  themeMode: 'bright' | 'dark';
  onToggleTheme: () => void;
  activeTemplate: DrawingTemplate | null;
  savedCount: number;
  templateOpacity: number;
  onOpacityChange: (opacity: number) => void;
  strokesCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onBackToHome,
  onOpenTemplates,
  onOpenSaveModal,
  onOpenClearConfirm,
  onOpenGallery,
  onOpenSpark,
  onShare,
  themeMode,
  onToggleTheme,
  activeTemplate,
  savedCount,
  strokesCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  const isDark = themeMode === 'dark';

  return (
    <header className={`sticky top-0 z-30 w-full backdrop-blur-xl border-b transition-colors ${
      isDark
        ? 'bg-slate-950/95 border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.5)] text-white'
        : 'bg-white/90 border-blue-200/80 shadow-[0_4px_20px_rgba(22,75,206,0.08)] text-slate-900'
    } px-2 sm:px-6 py-2.5`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-4">
        {/* Zone 1: Home Button */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            onClick={onBackToHome}
            className={`p-1.5 sm:p-2 rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 ${
              isDark
                ? 'border-slate-800 text-slate-200 hover:bg-slate-900'
                : 'border-slate-200/80 text-slate-600 hover:text-blue-700 hover:bg-blue-50'
            }`}
            title="Return to Home"
            aria-label="Return to Home"
          >
            <Home className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            <span className="text-xs font-bold hidden sm:inline">Home</span>
          </button>
        </div>

        {/* Center: Tracing template indicator & Theme Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeTemplate && (
            <button
              onClick={onOpenTemplates}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors max-w-[110px] sm:max-w-[190px] cursor-pointer font-medium"
              title="Change guided template"
            >
              <Sliders className="w-3 h-3 text-blue-600 shrink-0" />
              <span className="truncate">{activeTemplate.name}</span>
            </button>
          )}

          {/* Bright Mode / Dark Mode Toggle Button */}
          <button
            onClick={onToggleTheme}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm ${
              isDark
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
            }`}
            title={isDark ? 'Switch to Bright Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Bright/Dark Mode"
          >
            {isDark ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Bright Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">Dark Mode</span>
              </>
            )}
          </button>

          {/* Quick Tips */}
          <button
            onClick={onOpenSpark}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              isDark
                ? 'border-slate-800 text-slate-300 hover:bg-slate-900'
                : 'border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50'
            }`}
            title="Drawing Tips & Studio Harmonizers"
            aria-label="Drawing Tips"
          >
            <Lightbulb className="w-4 h-4 text-amber-500" />
          </button>

          {/* Share Button */}
          <button
            onClick={onShare}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              isDark
                ? 'border-slate-800 text-slate-300 hover:bg-slate-900'
                : 'border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50'
            }`}
            title="Share Studio or Paint Book"
            aria-label="Share Link"
          >
            <Share2 className="w-4 h-4 text-blue-600" />
          </button>
        </div>

        {/* Zone 3: Undo, Redo, Gallery, Clear, Save */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Undo */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Undo"
            aria-label="Undo"
          >
            <Undo2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Redo */}
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Redo"
            aria-label="Redo"
          >
            <Redo2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Gallery Button with badge */}
          <button
            onClick={onOpenGallery}
            className="relative p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Session Gallery"
            aria-label="View Saved Artwork Gallery"
          >
            <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            {savedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center shadow-md">
                {savedCount}
              </span>
            )}
          </button>

          {/* Clear Canvas */}
          <button
            onClick={onOpenClearConfirm}
            disabled={strokesCount === 0}
            className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Clear Canvas"
            aria-label="Clear Canvas"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Save Artwork CTA */}
          <button
            onClick={onOpenSaveModal}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
            title="Save Finished Artwork"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            <span>Save</span>
          </button>
        </div>
      </div>
    </header>
  );
};
