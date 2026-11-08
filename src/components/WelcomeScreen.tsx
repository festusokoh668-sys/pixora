import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface WelcomeScreenProps {
  onStartCreating: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStartCreating,
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
          {/* Original Emblem Logo Badge */}
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
      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20 flex flex-col items-center text-center z-10 my-auto">
        <h1 className="font-black text-6xl sm:text-8xl md:text-9xl uppercase tracking-tight text-slate-950 drop-shadow-[0_4px_30px_rgba(22,75,206,0.18)] mb-3 font-sans">
          PIX<span className="text-[#164BCE]">ORA</span>
        </h1>

        <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight mb-3">
          Your Imagination. Your Canvas.
        </h2>
        <p className="max-w-xl text-slate-600 text-sm sm:text-base font-medium leading-relaxed mb-8">
          Relax, draw, trace and bring your imagination to life with precision drawing tools and real paint books.
        </p>

        {/* Flashy & Sparkling Start Creating CTA Button */}
        <div className="w-full sm:w-auto flex flex-col items-center justify-center gap-3">
          <button
            onClick={onStartCreating}
            className="btn-glitter w-full sm:w-auto px-10 sm:px-14 py-4 rounded-2xl text-white font-black text-base sm:text-xl shadow-[0_14px_40px_rgba(22,75,206,0.45)] hover:shadow-[0_20px_50px_rgba(22,75,206,0.6)] border-2 border-white/80 flex items-center justify-center gap-3 active:scale-95 transition-all group cursor-pointer relative ring-4 ring-blue-500/20 animate-pulse"
          >
            <span className="relative z-10 text-white font-black text-lg sm:text-xl tracking-wide uppercase drop-shadow-md">
              Start Creating
            </span>
            <ArrowRight className="w-5 h-5 text-white relative z-10 group-hover:translate-x-1.5 transition-transform shrink-0" />
          </button>
          <span className="text-[11px] font-semibold text-slate-500">
            Instant freehand canvas · Real Paint Books · Smooth stroke stabilization
          </span>
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
