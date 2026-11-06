/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CanvasStudio } from './components/CanvasStudio';
import { Toolbar } from './components/Toolbar';
import { TemplateModal } from './components/TemplateModal';
import { SaveArtworkModal } from './components/SaveArtworkModal';
import { SessionGalleryModal } from './components/SessionGalleryModal';
import { CreativeSparkModal } from './components/CreativeSparkModal';
import { ClearConfirmModal } from './components/ClearConfirmModal';
import { DrawingTemplate, SavedArtwork, Stroke, ToolType } from './types';
import { HistoryManager } from './utils/drawing';
import { TEMPLATES } from './data/templates';
import { getSafeShareUrl } from './utils/color';

export default function App() {
  // Navigation / View State: Welcome Page as front page
  const [currentView, setCurrentView] = useState<'welcome' | 'studio'>('welcome');

  // Drawing Tools State
  const [tool, setTool] = useState<ToolType>('brush');
  const [color, setColor] = useState<string>('#164BCE'); // Royal Blue default
  const [size, setSize] = useState<number>(8);
  const [opacity, setOpacity] = useState<number>(1.0);

  // Strokes and History
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const historyRef = useRef<HistoryManager>(new HistoryManager(35));
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  // Templates & Tracing
  const [activeTemplate, setActiveTemplate] = useState<DrawingTemplate | null>(null);
  const [lastClosedTemplate, setLastClosedTemplate] = useState<DrawingTemplate | null>(null);
  const [templateOpacity, setTemplateOpacity] = useState<number>(0.35);

  // Saved Artworks (Session Gallery)
  const [savedArtworks, setSavedArtworks] = useState<SavedArtwork[]>([]);

  // Modals
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState<boolean>(false);
  const [isSparkModalOpen, setIsSparkModalOpen] = useState<boolean>(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState<boolean>(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; hex?: string } | null>(null);

  // Safe link and URL parameter router: Never breaks on shared links or query params
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;

      const params = new URLSearchParams(window.location.search);
      const templateParam = params.get('template') || params.get('paintbook');

      if (templateParam) {
        const found = TEMPLATES.find(
          (t) => t.id.toLowerCase() === templateParam.toLowerCase() ||
                 t.name.toLowerCase().includes(templateParam.toLowerCase())
        );
        if (found) {
          setActiveTemplate(found);
          setCurrentView('studio');
          return;
        } else {
          // Graceful fallback: open studio without broken error
          setCurrentView('studio');
          return;
        }
      }

      if (
        params.get('autostart') === '1' ||
        params.get('studio') === '1' ||
        params.get('view') === 'studio' ||
        window.location.hash === '#studio'
      ) {
        setCurrentView('studio');
      }
    } catch (err) {
      console.warn('URL parsing skipped gracefully:', err);
    }
  }, []);

  // Update undo/redo flags
  const updateHistoryFlags = () => {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  };

  // Strokes change handler
  const handleStrokesChange = (newStrokes: Stroke[]) => {
    historyRef.current.pushState(strokes);
    setStrokes(newStrokes);
    updateHistoryFlags();
  };

  const handleUndo = () => {
    const previous = historyRef.current.undo(strokes);
    if (previous !== null) {
      setStrokes(previous);
      updateHistoryFlags();
    }
  };

  const handleRedo = () => {
    const next = historyRef.current.redo(strokes);
    if (next !== null) {
      setStrokes(next);
      updateHistoryFlags();
    }
  };

  const handleConfirmClear = () => {
    historyRef.current.pushState(strokes);
    setStrokes([]);
    updateHistoryFlags();
    showToast('Canvas cleared');
  };

  // Tracing Paint Book selection, close, and undo-close / restore handlers
  const handleCloseTemplate = () => {
    if (activeTemplate) {
      setLastClosedTemplate(activeTemplate);
      setActiveTemplate(null);
    }
  };

  const handleRestoreTemplate = () => {
    if (lastClosedTemplate) {
      const templateToRestore = lastClosedTemplate;
      setActiveTemplate(templateToRestore);
      setLastClosedTemplate(null);
      showToast(`Restored: ${templateToRestore.name}`);
    }
  };

  const handleSelectTemplate = (template: DrawingTemplate) => {
    setActiveTemplate(template);
    setLastClosedTemplate(null);
    showToast(`Tracing: ${template.name}`);
  };

  // Start with a clean, plain white paper sheet from Welcome Screen
  const handleStartFreshCanvas = () => {
    if (activeTemplate) {
      setLastClosedTemplate(activeTemplate);
      setActiveTemplate(null);
    }
    setCurrentView('studio');
  };

  // Toast trigger
  const showToast = (text: string, hex?: string) => {
    setToastMessage({ text, hex });
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleLuckyColor = (name: string, hex: string) => {
    showToast(`Lucky Color: ${name}`, hex);
  };

  // Share Studio or Paint Book safely without breaking
  const handleShareStudio = async () => {
    try {
      const shareUrl = getSafeShareUrl(activeTemplate ? activeTemplate.id : undefined);

      if (navigator.share) {
        try {
          await navigator.share({
            title: 'pixora — Creative Drawing & Tracing Studio',
            text: activeTemplate
              ? `Check out the ${activeTemplate.name} paint book on pixora Studio!`
              : 'Create art and trace with real photo paint books on pixora Studio!',
            url: shareUrl,
          });
          showToast('Shared successfully!');
          return;
        } catch {
          // fallback to clipboard
        }
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Link copied to clipboard!');
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('Link copied to clipboard!');
      }
    } catch {
      showToast('Ready to share');
    }
  };

  // Keyboard shortcuts (Desktop power users)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 'b') {
        setTool('brush');
      } else if (e.key.toLowerCase() === 'k') {
        setTool('bucket');
      } else if (e.key.toLowerCase() === 'p') {
        setTool('pencil');
      } else if (e.key.toLowerCase() === 'e') {
        setTool('eraser');
      } else if (e.key.toLowerCase() === 'm') {
        setTool('highlighter');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleSaveToGallery = (artwork: SavedArtwork) => {
    setSavedArtworks((prev) => [artwork, ...prev]);
    showToast(`Saved "${artwork.title}"!`);
  };

  const handleDeleteFromGallery = (id: string) => {
    setSavedArtworks((prev) => prev.filter((a) => a.id !== id));
    showToast('Artwork removed from session');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50/70 to-blue-200/40 text-slate-900 flex flex-col font-sans selection:bg-blue-200 selection:text-blue-900 overflow-x-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-white/95 border border-blue-200 shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-bold text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
          {toastMessage.hex && (
            <div
              className="w-3.5 h-3.5 rounded-full border border-blue-300 shadow-sm"
              style={{ backgroundColor: toastMessage.hex }}
            />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {currentView === 'welcome' ? (
        <WelcomeScreen
          onStartCreating={handleStartFreshCanvas}
          onSelectTemplateDirectly={(tpl) => {
            handleSelectTemplate(tpl);
            setCurrentView('studio');
          }}
        />
      ) : (
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Main Top Header */}
          <Header
            onBackToHome={() => setCurrentView('welcome')}
            onOpenTemplates={() => setIsTemplateModalOpen(true)}
            onOpenSaveModal={() => setIsSaveModalOpen(true)}
            onOpenClearConfirm={() => setIsClearConfirmOpen(true)}
            onOpenGallery={() => setIsGalleryModalOpen(true)}
            onOpenSpark={() => setIsSparkModalOpen(true)}
            onShare={handleShareStudio}
            activeTemplate={activeTemplate}
            savedCount={savedArtworks.length}
            templateOpacity={templateOpacity}
            onOpacityChange={setTemplateOpacity}
            strokesCount={strokes.length}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />

          {/* Canvas Working Area: Mixed Royalty Blue & Crisp White */}
          <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br from-blue-50/40 via-white/50 to-blue-900/10">
            <CanvasStudio
              tool={tool}
              color={color}
              size={size}
              opacity={opacity}
              strokes={strokes}
              onStrokesChange={handleStrokesChange}
              activeTemplate={activeTemplate}
              lastClosedTemplate={lastClosedTemplate}
              templateOpacity={templateOpacity}
              onTemplateOpacityChange={setTemplateOpacity}
              onOpenTemplates={() => setIsTemplateModalOpen(true)}
              onClearTemplate={handleCloseTemplate}
              onRestoreTemplate={handleRestoreTemplate}
            />
          </main>

          {/* Bottom Interactive Toolbar */}
          <Toolbar
            currentTool={tool}
            onToolSelect={setTool}
            currentColor={color}
            onColorChange={setColor}
            currentSize={size}
            onSizeChange={setSize}
            currentOpacity={opacity}
            onOpacityChange={setOpacity}
            onOpenTemplates={() => setIsTemplateModalOpen(true)}
            onLuckyColor={handleLuckyColor}
          />

          {/* Template Gallery Modal */}
          <TemplateModal
            isOpen={isTemplateModalOpen}
            onClose={() => setIsTemplateModalOpen(false)}
            activeTemplate={activeTemplate}
            onSelectTemplate={handleSelectTemplate}
            onClearTemplate={() => {
              handleCloseTemplate();
              showToast('Blank canvas enabled');
            }}
            templateOpacity={templateOpacity}
            onOpacityChange={setTemplateOpacity}
          />

          {/* Save Artwork Modal */}
          <SaveArtworkModal
            isOpen={isSaveModalOpen}
            onClose={() => setIsSaveModalOpen(false)}
            strokes={strokes}
            activeTemplate={activeTemplate}
            onSaveToGallery={handleSaveToGallery}
          />

          {/* Session Gallery Modal */}
          <SessionGalleryModal
            isOpen={isGalleryModalOpen}
            onClose={() => setIsGalleryModalOpen(false)}
            artworks={savedArtworks}
            onDeleteArtwork={handleDeleteFromGallery}
            onOpenCanvas={() => setIsGalleryModalOpen(false)}
          />

          {/* Creative Spark / Tips Modal */}
          <CreativeSparkModal
            isOpen={isSparkModalOpen}
            onClose={() => setIsSparkModalOpen(false)}
            onSelectColor={(hex) => {
              setColor(hex);
              showToast('Color applied to brush', hex);
            }}
          />

          {/* Clear Canvas Confirmation */}
          <ClearConfirmModal
            isOpen={isClearConfirmOpen}
            onClose={() => setIsClearConfirmOpen(false)}
            onConfirmClear={handleConfirmClear}
            strokesCount={strokes.length}
          />
        </div>
      )}
    </div>
  );
}
