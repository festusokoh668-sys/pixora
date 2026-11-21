import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  BookmarkPlus,
  Check,
  Image as ImageIcon,
  Share2,
  Copy,
  FileCode,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CanvasLayer, DrawingTemplate, SavedArtwork, Stroke } from '../types';
import {
  generateArtworkFilename,
  renderStrokeToContext,
  exportStrokesToSvgString,
  getContainDrawRect,
} from '../utils/drawing';
import { getVisibleOrderedStrokes } from '../utils/layers';
import { getSafeShareUrl } from '../utils/color';

interface SaveArtworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  strokes: Stroke[];
  layers?: CanvasLayer[];
  activeTemplate: DrawingTemplate | null;
  onSaveToGallery: (artwork: SavedArtwork) => void;
  canvasDimensions?: { width: number; height: number };
}

export const SaveArtworkModal: React.FC<SaveArtworkModalProps> = ({
  isOpen,
  onClose,
  strokes,
  layers,
  activeTemplate,
  onSaveToGallery,
  canvasDimensions = { width: 1200, height: 1200 },
}) => {
  const orderedStrokes = React.useMemo(
    () => (layers && layers.length > 0 ? getVisibleOrderedStrokes(strokes, layers) : strokes),
    [strokes, layers]
  );
  const [artworkTitle, setArtworkTitle] = useState<string>('');
  const [includeTemplateGuide, setIncludeTemplateGuide] = useState<boolean>(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg' | 'svg'>('png');
  const [pngResolution, setPngResolution] = useState<1 | 2 | 4>(2); // Default to 2x (2400x2400 High-Res)
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const templateImgRef = useRef<HTMLImageElement | null>(null);

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

  // Generate high-resolution export canvas data URL matching studio canvas dimensions
  const renderExportCanvasDataUrl = (
    scale: number,
    format: 'png' | 'jpg' = 'png'
  ): string => {
    const baseW = Math.max(300, canvasDimensions.width);
    const baseH = Math.max(300, canvasDimensions.height);
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = baseW * scale;
    exportCanvas.height = baseH * scale;

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return previewDataUrl;

    ctx.scale(scale, scale);

    // Pure white paper background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, baseW, baseH);

    // If template image exists and includeTemplateGuide is true
    if (includeTemplateGuide && templateImgRef.current) {
      const imgW = templateImgRef.current.naturalWidth || templateImgRef.current.width || baseW;
      const imgH = templateImgRef.current.naturalHeight || templateImgRef.current.height || baseH;
      const drawRect = getContainDrawRect(imgW, imgH, baseW, baseH);
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.drawImage(templateImgRef.current, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
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
        const s = Math.min(baseW, baseH) / 200;
        const offsetX = (baseW - 200 * s) / 2;
        const offsetY = (baseH - 200 * s) / 2;
        ctx.translate(offsetX, offsetY);
        ctx.scale(s, s);
        ctx.stroke(p2d);
      } catch {
        // fallback
      }
      ctx.restore();
    }

    // Render all visible strokes in layer z-order
    for (const stroke of orderedStrokes) {
      renderStrokeToContext(ctx, stroke, 'export');
    }

    // Artist watermark in the bottom corner
    ctx.save();
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('PIXORA Studio', 32, baseH - 32);
    ctx.restore();

    return exportCanvas.toDataURL(
      format === 'jpg' ? 'image/jpeg' : 'image/png',
      0.92
    );
  };

  // Generate preview data URL on 1200x1200 export canvas
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    const renderAll = (templateImg?: HTMLImageElement) => {
      if (templateImg) {
        templateImgRef.current = templateImg;
      }
      const dataUrl = renderExportCanvasDataUrl(1);
      if (!isCancelled) {
        setPreviewDataUrl(dataUrl);
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
      templateImgRef.current = null;
      renderAll();
    }

    return () => {
      isCancelled = true;
    };
  }, [isOpen, strokes, activeTemplate, includeTemplateGuide, canvasDimensions]);

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

  const getSvgString = (): string => {
    return exportStrokesToSvgString(orderedStrokes, {
      width: Math.max(300, canvasDimensions.width),
      height: Math.max(300, canvasDimensions.height),
      title: artworkTitle.trim() || 'PIXORA Artwork',
      includeWatermark: true,
      includeTemplateGuide,
      templateSvgPath: activeTemplate?.svgPath,
      templateMediaUrl: activeTemplate?.mediaUrl,
    });
  };

  const handleDownload = () => {
    if (exportFormat === 'svg') {
      const svgString = getSvgString();
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = generateArtworkFilename(artworkTitle, 'svg');
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // High-resolution JPG or PNG at selected scale
      const rasterFormat = exportFormat === 'jpg' ? 'jpg' : 'png';
      const rasterUrl =
        rasterFormat === 'png' && pngResolution === 1
          ? previewDataUrl
          : renderExportCanvasDataUrl(pngResolution, rasterFormat);
      const link = document.createElement('a');
      link.download = generateArtworkFilename(artworkTitle, rasterFormat);
      link.href = rasterUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

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

  const handleCopySvgCode = async () => {
    try {
      const svg = getSvgString();
      let copied = false;

      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(svg);
          copied = true;
        } catch {
          // fall through to document.execCommand
        }
      }

      if (!copied) {
        const textArea = document.createElement('textarea');
        textArea.value = svg;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.select();
        try {
          copied = document.execCommand('copy');
        } catch {
          copied = false;
        }
        document.body.removeChild(textArea);
      }

      if (copied) {
        setShareFeedback('SVG markup copied to clipboard!');
      } else {
        setShareFeedback('SVG ready — click Download SVG below!');
      }
    } catch {
      setShareFeedback('SVG ready — click Download SVG below!');
    }
    setTimeout(() => setShareFeedback(null), 3000);
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
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200 cursor-pointer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-artwork-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[94vh] bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 cursor-default"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            <h2 id="save-artwork-modal-title" className="text-lg font-bold text-slate-900">
              Export Artwork
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-4 text-xs bg-slate-50/50">
          {/* Artwork Preview Frame */}
          <div className="w-full aspect-square max-h-52 sm:max-h-60 rounded-2xl bg-white border border-slate-200 shadow-md overflow-hidden flex items-center justify-center p-2 relative group">
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
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-900/75 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
              {exportFormat === 'svg'
                ? 'Scalable SVG'
                : `${canvasDimensions.width * pngResolution}×${canvasDimensions.height * pngResolution} ${exportFormat.toUpperCase()}`}
            </div>
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

          {/* Format Selection Tabs */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              Export Format
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-200/70 p-1 rounded-2xl">
              <button
                type="button"
                data-testid="modal-format-png"
                onClick={() => setExportFormat('png')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                  exportFormat === 'png'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ImageIcon className="w-4 h-4 text-blue-600" />
                <span>PNG</span>
              </button>
              <button
                type="button"
                data-testid="modal-format-jpg"
                onClick={() => setExportFormat('jpg')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                  exportFormat === 'jpg'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ImageIcon className="w-4 h-4 text-amber-600" />
                <span>JPG</span>
              </button>
              <button
                type="button"
                data-testid="modal-format-svg"
                onClick={() => setExportFormat('svg')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                  exportFormat === 'svg'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCode className="w-4 h-4 text-indigo-600" />
                <span>SVG</span>
              </button>
            </div>
          </div>

          {/* Format-Specific Options */}
          {exportFormat === 'png' || exportFormat === 'jpg' ? (
            <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between text-slate-700">
                <span className="font-bold text-xs">{exportFormat.toUpperCase()} Resolution</span>
                <span className="text-[11px] font-semibold text-blue-600">
                  {pngResolution === 1 && `${canvasDimensions.width} × ${canvasDimensions.height} px (Standard)`}
                  {pngResolution === 2 && `${canvasDimensions.width * 2} × ${canvasDimensions.height * 2} px (2K Retina • Sharp)`}
                  {pngResolution === 4 && `${canvasDimensions.width * 4} × ${canvasDimensions.height * 4} px (4K Ultra HD • Print)`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { scale: 1, label: `${canvasDimensions.width}px`, sub: '1x Standard' },
                  { scale: 2, label: `${canvasDimensions.width * 2}px`, sub: '2x High-Res' },
                  { scale: 4, label: `${canvasDimensions.width * 4}px`, sub: '4x Ultra HD' },
                ].map((opt) => (
                  <button
                    key={opt.scale}
                    type="button"
                    onClick={() => setPngResolution(opt.scale as 1 | 2 | 4)}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                      pngResolution === opt.scale
                        ? 'border-blue-600 bg-blue-50/80 text-blue-700 font-bold shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <span className="block font-bold text-xs">{opt.label}</span>
                    <span className="block text-[9px] text-slate-400 font-medium">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/70 shadow-sm flex items-start gap-2.5 text-indigo-900">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-bold block text-indigo-950">Scalable Vector Graphic (SVG)</span>
                Mathematical vector paths with infinite resolution. Fully editable in Figma, Illustrator, Inkscape, or web browsers.
              </div>
            </div>
          )}

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
                <span className="font-semibold block text-xs">Include Reference Template Guide</span>
                <span className="text-[11px] text-slate-500">
                  Embed the reference template or outline stencil in the exported file
                </span>
              </div>
            </label>
          )}

          {/* Success Banner when saved */}
          {isSavedSuccessfully && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2.5 animate-in fade-in duration-200">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-xs">Artwork Exported Successfully!</p>
                <p className="text-[11px] text-emerald-700">
                  {exportFormat === 'png'
                    ? 'High-res PNG'
                    : exportFormat === 'jpg'
                      ? 'JPEG Image'
                      : 'Vector SVG'}{' '}
                  file downloaded and saved to your Studio Gallery.
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
            <span>
              {exportFormat === 'svg'
                ? 'Download SVG'
                : `Download ${canvasDimensions.width * pngResolution}px ${exportFormat.toUpperCase()}`}
            </span>
          </button>

          {exportFormat === 'svg' && (
            <button
              onClick={handleCopySvgCode}
              className="w-full sm:w-auto py-3 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-indigo-200/70"
              title="Copy SVG markup to clipboard"
            >
              <Copy className="w-4 h-4 text-indigo-600" />
              <span>Copy SVG</span>
            </button>
          )}

          <button
            onClick={handleShareLink}
            className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Share this artwork or studio link"
          >
            <Share2 className="w-4 h-4 text-blue-600" />
            <span>Share</span>
          </button>

          <button
            onClick={handleSaveToGalleryOnly}
            className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Save to session gallery without downloading"
          >
            <BookmarkPlus className="w-4 h-4 text-slate-600" />
            <span>Gallery</span>
          </button>
        </div>
      </div>
    </div>
  );
};
