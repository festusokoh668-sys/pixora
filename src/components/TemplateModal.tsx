import React, { useState, useRef, useEffect } from 'react';
import { X, Search, Check, Layers, Image as ImageIcon, Video, Upload, Loader2, Sparkles, Globe, ShieldAlert, Award } from 'lucide-react';
import { DrawingTemplate, DifficultyLevel } from '../types';
import { TEMPLATES } from '../data/templates';
import { searchRealPhotoTemplates } from '../utils/mediaSearch';
import { generateFallbackSvgDataUrl } from '../utils/edgeDetection';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTemplate: DrawingTemplate | null;
  onSelectTemplate: (template: DrawingTemplate) => void;
  onClearTemplate: () => void;
  templateOpacity: number;
  onOpacityChange: (opacity: number) => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  activeTemplate,
  onSelectTemplate,
  onClearTemplate,
  templateOpacity,
  onOpacityChange,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [liveSearchResults, setLiveSearchResults] = useState<DrawingTemplate[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Live real-photo search when user types in search box
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setLiveSearchResults([]);
      setIsSearchingOnline(false);
      return;
    }

    setIsSearchingOnline(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchRealPhotoTemplates(query);
        setLiveSearchResults(results);
      } catch (err) {
        console.warn('Real photo search error:', err);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 280);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  if (!isOpen) return null;

  const categoryFilters = [
    { id: 'all', label: 'All Categories' },
    { id: 'photos', label: 'Real Pictures & Photos' },
    { id: 'animals', label: 'Animals' },
    { id: 'nature', label: 'Flowers & Nature' },
    { id: 'vehicles', label: 'Vehicles' },
    { id: 'characters', label: 'Characters' },
    { id: 'fruits', label: 'Fruits & Food' },
    { id: 'shapes', label: 'Shapes & Patterns' },
  ];

  const difficultyFilters: { id: string; label: string }[] = [
    { id: 'all', label: 'All Difficulties' },
    { id: 'Easy', label: 'Easy' },
    { id: 'Medium', label: 'Medium' },
    { id: 'Hard', label: 'Hard' },
    { id: 'Pro', label: 'Pro' },
    { id: 'Mastery', label: 'Mastery' },
    { id: 'Legend', label: 'Legend' },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const url = URL.createObjectURL(file);

    const customTemplate: DrawingTemplate = {
      id: `custom_${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, '').slice(0, 24) || 'Custom Media',
      category: 'nature',
      difficulty: 'Easy',
      type: isVideo ? 'video' : 'photo',
      mediaUrl: url,
      description: `Your uploaded ${isVideo ? 'video' : 'photo'} reference`,
    };

    onSelectTemplate(customTemplate);
    onClose();
  };

  // 1. Local filtered templates
  const localFilteredTemplates = TEMPLATES.filter((tpl) => {
    let matchesCategory = true;
    if (selectedFilter === 'photos') {
      matchesCategory = tpl.type === 'photo' || tpl.type === 'video';
    } else if (selectedFilter !== 'all') {
      matchesCategory = tpl.category === selectedFilter;
    }

    let matchesDifficulty = true;
    if (selectedDifficulty !== 'all') {
      matchesDifficulty = tpl.difficulty === selectedDifficulty;
    }

    if (!searchQuery.trim()) return matchesCategory && matchesDifficulty;

    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      tpl.name.toLowerCase().includes(q) ||
      tpl.description.toLowerCase().includes(q) ||
      tpl.category.toLowerCase().includes(q) ||
      (tpl.tags && tpl.tags.some((tag) => tag.toLowerCase().includes(q)));

    return matchesCategory && matchesDifficulty && matchesQuery;
  });

  // 2. Combine local matches and live online search results
  const combinedTemplates: DrawingTemplate[] = [...localFilteredTemplates];
  const seenNames = new Set(localFilteredTemplates.map((t) => t.name.toLowerCase()));

  for (const liveTpl of liveSearchResults) {
    let matchesDifficulty = true;
    if (selectedDifficulty !== 'all') {
      matchesDifficulty = liveTpl.difficulty === selectedDifficulty;
    }

    if (matchesDifficulty && !seenNames.has(liveTpl.name.toLowerCase())) {
      seenNames.add(liveTpl.name.toLowerCase());
      combinedTemplates.push(liveTpl);
    }
  }

  // Helper for difficulty badge styling
  const renderDifficultyBadge = (difficulty: DifficultyLevel) => {
    switch (difficulty) {
      case 'Easy':
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
            Easy
          </span>
        );
      case 'Medium':
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-300">
            Medium
          </span>
        );
      case 'Hard':
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
            Hard
          </span>
        );
      case 'Pro':
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-300">
            Pro
          </span>
        );
      case 'Mastery':
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
            Mastery
          </span>
        );
      case 'Legend':
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 border border-amber-400 shadow-sm shadow-amber-400/40">
            ★ Legend
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
            {difficulty}
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-gallery-title"
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div>
            <h2
              id="template-gallery-title"
              className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2"
            >
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Outline Tracing Paint Books</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any level from Easy to Legend or search any real photo from the web
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close paint books"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Search, Upload, and Filters */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {/* Live Search Box */}
            <div className="relative flex-1">
              {isSearchingOnline ? (
                <Loader2 className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              )}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search anything from the web (e.g. Spider-Man, Dragon, Ferrari, Tiger)..."
                className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors shadow-sm font-medium"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Upload Own Picture */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-all shrink-0 cursor-pointer shadow-sm active:scale-95"
              title="Upload your own photo or video to trace"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload Photo</span>
              <span className="sm:hidden">Upload</span>
            </button>
          </div>

          {/* Difficulty Levels Filter Strip: Easy, Medium, Hard, Pro, Mastery, Legend */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-blue-600" />
              <span>Level:</span>
            </span>
            {difficultyFilters.map((diff) => (
              <button
                key={diff.id}
                onClick={() => setSelectedDifficulty(diff.id)}
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                  selectedDifficulty === diff.id
                    ? diff.id === 'Legend'
                      ? 'bg-amber-400 text-slate-950 border border-amber-500 shadow-md ring-2 ring-amber-400/40'
                      : 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/30'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {diff.label}
              </button>
            ))}
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {categoryFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all font-semibold cursor-pointer ${
                  selectedFilter === f.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Quick Search Inspiration Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-[11px]">
            <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Web Suggestions:</span>
            </span>
            {['Spider-Man', 'Dragon', 'Ferrari', 'Tiger', 'Dolphin', 'Castle', 'Pizza', 'Anime', 'Panda'].map((suggest) => (
              <button
                key={suggest}
                onClick={() => setSearchQuery(suggest)}
                className="px-2.5 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold border border-blue-200/60 shrink-0 cursor-pointer active:scale-95 transition-all"
              >
                {suggest}
              </button>
            ))}
          </div>

          {/* Real-time search status banner */}
          {searchQuery.trim().length >= 2 && (
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>
                {isSearchingOnline ? (
                  <span className="text-blue-600 font-semibold flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Searching the web for "{searchQuery}"...
                  </span>
                ) : (
                  <span>
                    Found web pictures for <strong className="text-blue-700 font-bold">"{searchQuery}"</strong> ({combinedTemplates.length} results)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Template Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50/40">
          {/* Option for Clean Blank Canvas */}
          <button
            onClick={() => {
              onClearTemplate();
              onClose();
            }}
            className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all group active:scale-95 cursor-pointer bg-white ${
              !activeTemplate
                ? 'border-blue-600 ring-2 ring-blue-500/25 bg-blue-50/40'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="w-full h-28 mb-2 flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <span className="text-xs text-slate-600 font-semibold">Blank Canvas</span>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Freehand Draw</span>
                {!activeTemplate && <Check className="w-4 h-4 text-blue-600" />}
              </div>
              <span className="text-[10px] text-slate-500">Pure white empty sheet</span>
            </div>
          </button>

          {/* Templates Display */}
          {combinedTemplates.map((template) => {
            const isSelected = activeTemplate?.id === template.id;
            return (
              <button
                key={template.id}
                onClick={() => {
                  onSelectTemplate(template);
                  onClose();
                }}
                className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all group active:scale-95 cursor-pointer relative overflow-hidden bg-white ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-500/30 bg-blue-50/30 shadow-md'
                    : 'border-slate-200 hover:border-blue-400 hover:shadow-md'
                }`}
              >
                {/* Media Preview Box */}
                <div className="w-full h-28 mb-2 rounded-xl overflow-hidden bg-slate-100 relative flex items-center justify-center border border-slate-200">
                  {template.mediaUrl && template.type !== 'video' ? (
                    <img
                      src={template.mediaUrl}
                      alt={template.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.onerror = null; // prevent loop
                        target.src = generateFallbackSvgDataUrl(template.name);
                      }}
                    />
                  ) : template.type === 'video' && template.mediaUrl ? (
                    <video
                      src={template.mediaUrl}
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : template.svgPath ? (
                    <div className="w-full h-full p-3 flex items-center justify-center bg-white">
                      <svg
                        viewBox={template.viewBox || '0 0 200 200'}
                        className="w-full h-full stroke-slate-900 group-hover:stroke-blue-600 transition-colors"
                        fill="none"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={template.svgPath} />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-400 font-bold text-xs">
                      {template.name}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {template.name}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span className="capitalize text-slate-500">{template.category}</span>
                    {renderDifficultyBadge(template.difficulty)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer with Opacity Tuning */}
        <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="w-full sm:w-auto flex items-center gap-3">
            <span className="text-slate-600 font-medium whitespace-nowrap">Guide Opacity:</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={templateOpacity}
              onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
              className="w-32 accent-blue-600 cursor-pointer"
            />
            <span className="font-mono text-blue-600 font-bold">{Math.round(templateOpacity * 100)}%</span>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold transition-colors cursor-pointer"
          >
            Close Paint Books
          </button>
        </div>
      </div>
    </div>
  );
};
