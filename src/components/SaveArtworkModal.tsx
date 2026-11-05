import React, { useState, useEffect } from 'react';
import { X, Download, BookmarkPlus, Check, Image as ImageIcon, Share2, Copy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { DrawingTemplate, SavedArtwork, Stroke } from '../types';
import { generateArtworkFilename, drawQuadraticPath, applyToolStyleToContext } from '../utils/drawing';
import { getSafeShareUrl } from '../utils/color';

interface SaveArtworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  strokes: Stroke[];
  activeTemplate: DrawingTemplate | null;
  onSaveToGallery: (artwork: SavedArtwork) => void;
}

export const SaveArtworkModal: React.FC<SaveArtworkModalProps> = ({
  isOpen,
  onClose,
  strokes,
  activeTemplate,
  onSaveToGallery,
}) => {
  const [artworkTitle, setArtworkTitle] = useState<string>('');
  const [includeTemplateGuide, setIncludeTemplateGuide] = useState<boolean>(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // Initialize title
  useEffect(() => {
    if (isOpen) {
      setIsSavedSuccessfully(false);
      setShareFeedback(null);
      const defaultTitle = activeTemplate
        ? `pixora ${activeTemplate.name}`
        : 'pixora Artwork';
      setArtworkTitle(defaultTitle);
    }
  }, [isOpen, activeTemplate]);

  // Generate PNG data URL on export canvas using smooth quadratic curves
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    const exportCanvas = document.createElement('canvas');
    const width = 1200;
    const height = 1200;
    exportCanvas.width = width;
    exportCanvas.height = height;

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    const renderAll = (templateImg?: HTMLImageElement) => {
      // Pure white paper background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // If template image exists and includeTemplateGuide is true
      if (includeTemplateGuide && templateImg) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.drawImage(templateImg, 0, 0, width, height);
        ctx.restore();
      } else if (includeTemplateGuide && activeTemplate?.svgPath) {
        ctx.save();
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 6]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        try {
          const p2d = new Path2D(activeTemplate.svgPath);
          const scale = 1200 / 200;
          ctx.scale(scale, scale);
          ctx.stroke(p2d);
        } catch {
          // fallback
        }
        ctx.restore();
      }

      // Render all strokes with distinct tool properties (sharp pen, blunt pencil, original paint)
      for (const stroke of strokes) {
        if (stroke.points.length === 0) continue;
        ctx.save();
        applyToolStyleToContext(ctx, stroke, 'export');
        drawQuadraticPath(ctx, stroke.points);
        ctx.restore();
      }

      // Artist watermark in the bottom corner
      ctx.save();
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 22px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('PIXORA Studio', 32, height - 32);
      ctx.restore();

      if (!isCancelled) {
        setPreviewDataUrl(exportCanvas.toDataURL('image/png'));
      }
    };

    if (includeTemplateGuide && activeTemplate?.mediaUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        renderAll(img);
      };
      img.onerror = () => {
        renderAll();
      };
      img.src = activeTemplate.mediaUrl;
    } else {
      renderAll();
    }

    return () => {
      isCancelled = true;
    };
  }, [isOpen, strokes, activeTemplate, includeTemplateGuide]);

  if (!isOpen) return null;

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2563EB', '#60A5FA', '#93C5FD', '#164BCE', '#E2E8F0'],
      });
    } catch {
      // ignore
    }
  };

  const handleDownload = () => {
    if (!previewDataUrl) return;

    const link = document.createElement('a');
    link.download = generateArtworkFilename(artworkTitle);
    link.href = previewDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const artwork: SavedArtwork = {
      id: `art_${Date.now()}`,
      title: artworkTitle.trim() || 'Untitled Artwork',
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dataUrl: previewDataUrl,
      templateName: activeTemplate ? activeTemplate.name : undefined,
      strokesCount: strokes.length,
    };
    onSaveToGallery(artwork);

    setIsSavedSuccessfully(true);
    triggerConfetti();
  };

  const handleSaveToGalleryOnly = () => {
    if (!previewDataUrl) return;

    const artwork: SavedArtwork = {
      id: `art_${Date.now()}`,
      title: artworkTitle.trim() || 'Untitled Artwork',
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dataUrl: previewDataUrl,
      templateName: activeTemplate ? activeTemplate.name : undefined,
      strokesCount: strokes.length,
    };
    onSaveToGallery(artwork);

    setIsSavedSuccessfully(true);
    triggerConfetti();
  };

  // Safe link sharing that never breaks
  const handleShareLink = async () => {
    try {
      const shareUrl = getSafeShareUrl(activeTemplate ? activeTemplate.id : undefined);

      if (navigator.share) {
        try {
          await navigator.share({
            title: `pixora — ${artworkTitle}`,
            text: `Check out this artwork on pixora Studio!`,
            url: shareUrl,
          });
          setShareFeedback('Shared successfully!');
          return;
        } catch {
          // fallback to clipboard
        }
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareFeedback('Link copied to clipboard!');
      } else {
        // Ultimate fallback
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setShareFeedback('Link copied to clipboard!');
      }
    } catch {
      setShareFeedback('Link ready to share');
    }

    setTimeout(() => setShareFeedback(null), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-artwork-modal-title"
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            <h2 id="save-artwork-modal-title" className="text-lg font-bold text-slate-900">
              Save Your Artwork
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close save dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-4 text-xs bg-slate-50/50">
          {/* Artwork Preview Frame */}
          <div className="w-full aspect-square max-h-56 sm:max-h-64 rounded-2xl bg-white border border-slate-200 shadow-md overflow-hidden flex items-center justify-center p-2 relative group">
            {previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt="Artwork Preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <ImageIcon className="w-8 h-8 text-blue-400 animate-pulse" />
                <span>Preparing smooth canvas preview...</span>
              </div>
            )}
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              Artwork Title
            </label>
            <input
              type="text"
              value={artworkTitle}
              onChange={(e) => setArtworkTitle(e.target.value)}
              placeholder="Give your masterpiece a title..."
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition-colors shadow-sm"
            />
          </div>

          {/* Tracing Guide Option */}
          {activeTemplate && (
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer shadow-sm">
              <input
                type="checkbox"
                checked={includeTemplateGuide}
                onChange={(e) => setIncludeTemplateGuide(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
              <div className="text-slate-700">
                <span className="font-semibold block text-xs">Include Reference Image Guide</span>
                <span className="text-[11px] text-slate-500">
                  Merge the real photo or outline into your saved PNG image
                </span>
              </div>
            </label>
          )}

          {/* Success Banner when saved */}
          {isSavedSuccessfully && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2.5 animate-in fade-in duration-200">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-xs">Artwork Saved Successfully!</p>
                <p className="text-[11px] text-emerald-700">
                  High-res image downloaded and added to your Studio Session Gallery.
                </p>
              </div>
            </div>
          )}

          {/* Share Feedback Toast */}
          {shareFeedback && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 flex items-center gap-2.5 animate-in fade-in duration-200">
              <Copy className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-semibold text-xs">{shareFeedback}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center gap-2.5">
          <button
            onClick={handleDownload}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Download PNG</span>
          </button>

          <button
            onClick={handleShareLink}
            className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Share this artwork or studio link"
          >
            <Share2 className="w-4 h-4 text-blue-600" />
            <span>Share Link</span>
          </button>

          <button
            onClick={handleSaveToGalleryOnly}
            className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <BookmarkPlus className="w-4 h-4 text-slate-600" />
            <span>Gallery</span>
          </button>
        </div>
      </div>
    </div>
  );
};
