import React from 'react';
import { ArrowRight, Image as ImageIcon, Sparkles, Feather, Pencil, Brush, Compass } from 'lucide-react';
import { DRAWING_COLLECTIONS } from '../data/templates';
import { DrawingTemplate, DifficultyLevel } from '../types';

interface WelcomeScreenProps {
  onStartCreating: () => void;
  onSelectTemplateDirectly: (template: DrawingTemplate) => void;
}

const renderDifficultyBadge = (difficulty: DifficultyLevel) => {
  switch (difficulty) {
    case 'Easy':
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">Easy</span>;
    case 'Medium':
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-300">Medium</span>;
    case 'Hard':
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">Hard</span>;
    case 'Pro':
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-300">Pro</span>;
    case 'Mastery':
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300">Mastery</span>;
    case 'Legend':
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-400 text-slate-950 border border-amber-500 shadow-sm">★ Legend</span>;
    default:
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-700">{difficulty}</span>;
  }
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStartCreating,
  onSelectTemplateDirectly,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50/80 to-blue-200/50 text-slate-900 flex flex-col justify-between relative overflow-hidden select-none">
      {/* Background Imagery */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <img
          src="/src/assets/images/royal_blue_white_bg_1793729884932.jpg"
          alt=""
          className="w-full h-full object-cover object-center opacity-40 scale-105 filter blur-[1px]"
        />
        {/* Soft luminous radial and linear gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-blue-50/60 to-white/90" />
        <div className="absolute top-[-10%] left-[-10%] w-[550px] h-[550px] rounded-full bg-blue-600/20 blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#164BCE]/25 blur-[140px]" />
      </div>

      {/* Top Navigation Bar */}
      <nav className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-5 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-[#0F3AA8] via-[#164BCE] to-[#3B82F6] flex items-center justify-center shadow-lg shadow-blue-600/30 border border-blue-300/40">
            <span className="text-white font-black text-xl tracking-tighter">P</span>
          </div>
          <span className="font-black text-2xl sm:text-3xl tracking-wider uppercase text-slate-950 font-sans">
            PIX<span className="text-[#164BCE]">ORA</span>
          </span>
        </div>

        <button
          onClick={onStartCreating}
          className="px-4 py-2 rounded-xl bg-white/90 backdrop-blur-md border border-blue-200/80 hover:border-blue-400 text-xs sm:text-sm font-bold text-blue-700 shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
        >
          Open Studio
        </button>
      </nav>

      {/* Main Hero & Welcome Content */}
      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col items-center text-center z-10 my-auto">
        <h1 className="font-black text-6xl sm:text-8xl md:text-9xl uppercase tracking-tight text-slate-950 drop-shadow-[0_4px_30px_rgba(22,75,206,0.18)] mb-3 font-sans">
          PIX<span className="text-[#164BCE]">ORA</span>
        </h1>

        <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight mb-3">
          Your Imagination. Your Canvas.
        </h2>
        <p className="max-w-xl text-slate-600 text-sm sm:text-base font-medium leading-relaxed mb-8">
          Relax, draw, trace and bring your imagination to life with real photo paint books and custom precision tools.
        </p>
        <div className="w-full sm:w-auto flex flex-col items-center justify-center gap-3 mb-10">
          <button
            onClick={onStartCreating}
            className="btn-glitter w-full sm:w-auto px-10 sm:px-14 py-4 rounded-2xl text-white font-black text-base sm:text-lg shadow-[0_12px_35px_rgba(22,75,206,0.38)] hover:shadow-[0_16px_45px_rgba(22,75,206,0.5)] border border-white/70 flex items-center justify-center gap-3 active:scale-95 transition-all group cursor-pointer relative"
          >
            {/* Twinkling corner glints */}
            <span className="sparkle-star absolute -top-1.5 -left-1.5 text-white/90">
              <Sparkles className="w-4 h-4 fill-white" />
            </span>
            <span className="sparkle-star absolute -bottom-1 -right-1 text-white/90" style={{ animationDelay: '1s' }}>
              <Sparkles className="w-3.5 h-3.5 fill-white" />
            </span>

            <span className="relative z-10 drop-shadow-sm tracking-wide">Start Creating</span>
            <ArrowRight className="w-5 h-5 text-white relative z-10 group-hover:translate-x-1.5 transition-transform" />
          </button>
          <span className="text-[11px] font-semibold text-slate-500">
            Instant freehand canvas · Smooth stroke stabilization
          </span>
        </div>

        {/* Real Picture Paint Books Showcase Header */}
        <div className="w-full max-w-4xl flex items-center justify-between mb-3 px-1 text-left">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-blue-600" />
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-800">
              Choose a Paint Book to Trace
            </span>
          </div>
          <span className="text-[11px] text-blue-700 font-bold">8 Drawing Collections · 24 Stencils</span>
        </div>

        {/* Real Picture Paint Books Grid */}
        <div className="w-full max-w-4xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {DRAWING_COLLECTIONS.map((col) => {
              const template = col.levels.Easy;
              const safeUrl = template.mediaUrl?.startsWith('data:')
                ? template.mediaUrl
                : template.mediaUrl
                ? encodeURI(decodeURI(template.mediaUrl))
                : '';
              return (
                <button
                  key={col.id}
                  onClick={() => onSelectTemplateDirectly(template)}
                  className="group relative aspect-square rounded-2xl overflow-hidden bg-white border-2 border-blue-200/70 hover:border-blue-500 shadow-md hover:shadow-xl transition-all duration-300 active:scale-95 text-left cursor-pointer"
                  title={`Start tracing ${col.title} (${template.difficulty})`}
                >
                  {safeUrl && (
                    <img
                      src={safeUrl}
                      alt={col.title}
                      className="w-full h-full object-contain p-2 group-hover:scale-108 transition-transform duration-500 bg-slate-50"
                    />
                  )}
                  {/* Gradient Scrim for readable title */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
                  <div className="absolute bottom-2.5 left-2.5 right-2.5">
                    <span className="text-xs sm:text-sm font-black text-white block truncate drop-shadow-sm">
                      {col.title}
                    </span>
                    <div className="flex items-center justify-between text-[10px] text-blue-200 mt-0.5">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-slate-300">{col.category}</span>
                      {renderDifficultyBadge(template.difficulty)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 px-6 z-10 text-center text-xs font-semibold text-slate-500 flex flex-col sm:flex-row items-center justify-center gap-2">
        <span className="font-bold text-slate-700">PIXORA Studio © 2026</span>
        <span className="hidden sm:inline text-slate-400">•</span>
        <span>Mobile-First Creative Canvas</span>
      </footer>
    </div>
  );
};
