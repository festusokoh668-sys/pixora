import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Download,
  Eye,
  FileImage,
  FileCode,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { CanvasLayer, DrawingTemplate, Stroke } from '../types';
import {
  exportStrokesToSvgString,
  generateArtworkFilename,
  getContainDrawRect,
  renderStrokeToContext,
} from '../utils/drawing';
import { createInitialLayers, getVisibleOrderedStrokes } from '../utils/layers';
import { renderLayeredArtworkToContext } from '../utils/filterHistory';
import {
  computeExportDimensions,
  estimateDataUrlBytes,
  estimateSvgBytes,
  ExportPreviewFormat,
  ExportPreviewScale,
  formatByteSize,
  svgStringToDataUrl,
} from '../utils/exportPreview';

interface ExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  strokes: Stroke[];
  layers?: CanvasLayer[];
  activeTemplate: DrawingTemplate | null;
  templateOpacity?: number;
  canvasDimensions: { width: number; height: number };
  defaultTitle?: string;
  initialFormat?: ExportPreviewFormat;
  onDownloadComplete?: (filename: string, format: ExportPreviewFormat) => void;
}

export const ExportPreviewModal: React.FC<ExportPreviewModalProps> = ({
  isOpen,
  onClose,
  strokes,
  layers,
  activeTemplate,
  templateOpacity = 0.35,
  canvasDimensions,
  defaultTitle,
  initialFormat = 'png',
  onDownloadComplete,
}) => {
  const [format, setFormat] = useState<ExportPreviewFormat>(initialFormat);
  const [scale, setScale] = useState<ExportPreviewScale>(1);
  const [jpgQuality, setJpgQuality] = useState<number>(0.92);
  const [includeTemplateGuide, setIncludeTemplateGuide] = useState<boolean>(false);
  const [includeWatermark, setIncludeWatermark] = useState<boolean>(false);
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string>('');
  const [estimatedBytes, setEstimatedBytes] = useState<number>(0);
  const [downloadedNotice, setDownloadedNotice] = useState<string | null>(null);

  const templateImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormat(initialFormat);
      setPreviewZoom(1);
      setDownloadedNotice(null);
    }
  }, [isOpen, initialFormat]);

  const orderedStrokes = useMemo(
    () => (layers && layers.length > 0 ? getVisibleOrderedStrokes(strokes, layers) : strokes),
    [strokes, layers]
  );

  const artworkTitle = useMemo(() => {
    if (defaultTitle && defaultTitle.trim()) return defaultTitle.trim();
    if (activeTemplate) return `Pixora ${activeTemplate.name}`;
    return 'Pixora Artwork';
  }, [defaultTitle, activeTemplate]);

  const outputDimensions = useMemo(
    () => computeExportDimensions(canvasDimensions, format, scale),
    [canvasDimensions, format, scale]
  );

  const outputFilename = useMemo(
    () => generateArtworkFilename(artworkTitle, format),
    [artworkTitle, format]
  );

  const renderFinalRasterDataUrl = (
    targetScale: ExportPreviewScale,
    targetFormat: 'png' | 'jpg',
    quality: number
  ): string => {
    const baseW = Math.max(1, Math.round(canvasDimensions.width || 819));
    const baseH = Math.max(1, Math.round(canvasDimensions.height || 460));
    const canvas = document.createElement('canvas');
    canvas.width = baseW * targetScale;
    canvas.height = baseH * targetScale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.scale(targetScale, targetScale);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, baseW, baseH);

    if (includeTemplateGuide && templateImgRef.current) {
      const img = templateImgRef.current;
      const imgW = img.naturalWidth || img.width || baseW;
      const imgH = img.naturalHeight || img.height || baseH;
      const drawRect = getContainDrawRect(imgW, imgH, baseW, baseH);
      ctx.save();
      ctx.globalAlpha = Math.max(0.05, Math.min(1, templateOpacity));
      ctx.drawImage(img, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
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
        // Ignore invalid SVG path fallback
      }
      ctx.restore();
    }

    const safeLayers = layers && layers.length > 0 ? layers : createInitialLayers();
    renderLayeredArtworkToContext(
      ctx,
      strokes,
      safeLayers,
      baseW,
      baseH,
      (targetCtx, stroke) => renderStrokeToContext(targetCtx, stroke, 'export')
    );

    if (includeWatermark) {
      ctx.save();
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 18px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('PIXORA Studio', 24, baseH - 22);
      ctx.restore();
    }

    return canvas.toDataURL(
      targetFormat === 'jpg' ? 'image/jpeg' : 'image/png',
      quality
    );
  };

  const buildFinalSvgString = (): string => {
    return exportStrokesToSvgString(orderedStrokes, {
      width: Math.max(1, Math.round(canvasDimensions.width || 819)),
      height: Math.max(1, Math.round(canvasDimensions.height || 460)),
      title: artworkTitle,
      includeWatermark,
      includeTemplateGuide,
      templateSvgPath: activeTemplate?.svgPath,
      templateMediaUrl: activeTemplate?.mediaUrl,
    });
  };

  // Live render whenever modal is open or canvas/export settings change
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const updateLivePreview = (loadedImg?: HTMLImageElement | null) => {
      if (loadedImg !== undefined) {
        templateImgRef.current = loadedImg;
      }
      if (cancelled) return;

      if (format === 'svg') {
        const svgStr = buildFinalSvgString();
        setLivePreviewUrl(svgStringToDataUrl(svgStr));
        setEstimatedBytes(estimateSvgBytes(svgStr));
      } else {
        const dataUrl = renderFinalRasterDataUrl(scale, format, jpgQuality);
        setLivePreviewUrl(dataUrl);
        setEstimatedBytes(estimateDataUrlBytes(dataUrl));
      }
    };

    if (includeTemplateGuide && activeTemplate?.mediaUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => updateLivePreview(img);
      img.onerror = () => updateLivePreview(null);
      img.src = activeTemplate.mediaUrl;
    } else {
      updateLivePreview(null);
    }

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    format,
    scale,
    jpgQuality,
    includeTemplateGuide,
    includeWatermark,
    orderedStrokes,
    activeTemplate,
    templateOpacity,
    canvasDimensions,
    artworkTitle,
  ]);

  if (!isOpen) return null;

  const handleDownloadFinalImage = () => {
    if (format === 'svg') {
      const svgStr = buildFinalSvgString();
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = outputFilename;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      const dataUrl = livePreviewUrl || renderFinalRasterDataUrl(scale, format, jpgQuality);
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.download = outputFilename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setDownloadedNotice(`Downloaded ${outputFilename}`);
    onDownloadComplete?.(outputFilename, format);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-preview-modal-title"
      data-testid="export-preview-modal"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92vh] bg-[#FBFBFB] dark:bg-[#1E232D] border border-[#A0A0A0] dark:border-[#3E485C] shadow-2xl rounded-xl overflow-hidden flex flex-col text-[#1E1E1E] dark:text-[#E6EDF7] font-sans"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-white dark:bg-[#161B22] border-b border-[#D8D8D8] dark:border-[#2D333B] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-[#1979CA] text-white flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="export-preview-modal-title"
                className="text-[14px] font-semibold tracking-tight leading-tight"
              >
                Export Preview
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                Live preview of the final exported file before downloading ({outputFilename})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Export Preview"
            data-testid="export-preview-close-btn"
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#E5F1FB] dark:hover:bg-[#2D333B] text-[#555] dark:text-[#A0AEC0] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Left Live Canvas Preview + Right Export Settings */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: Live Rendered Export Stage */}
          <div className="flex-1 min-h-[260px] bg-[#E8ECF2] dark:bg-[#12161E] p-4 flex flex-col gap-3 overflow-hidden relative">
            {/* Live Metadata Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span
                  data-testid="export-preview-dimensions"
                  className="px-2 py-0.5 rounded bg-white dark:bg-[#222834] border border-[#CBD5E1] dark:border-[#374151] font-mono font-semibold text-[#1E293B] dark:text-[#E2E8F0]"
                >
                  {outputDimensions.width} × {outputDimensions.height} px
                </span>
                <span
                  data-testid="export-preview-filesize"
                  className="px-2 py-0.5 rounded bg-white dark:bg-[#222834] border border-[#CBD5E1] dark:border-[#374151] font-mono text-[#1979CA] dark:text-sky-400 font-semibold"
                >
                  ~{formatByteSize(estimatedBytes)}
                </span>
                <span className="px-2 py-0.5 rounded bg-[#1979CA]/10 text-[#1979CA] dark:text-sky-300 font-semibold uppercase tracking-wider">
                  {format}
                </span>
              </div>

              {/* Preview Inspection Zoom Controls */}
              <div className="flex items-center gap-1 bg-white dark:bg-[#222834] border border-[#CBD5E1] dark:border-[#374151] rounded px-1.5 py-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  aria-label="Zoom out preview"
                  className="p-0.5 hover:text-[#1979CA] cursor-pointer"
                  title="Zoom out preview"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10.5px] font-mono min-w-[38px] text-center">
                  {Math.round(previewZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                  aria-label="Zoom in preview"
                  className="p-0.5 hover:text-[#1979CA] cursor-pointer"
                  title="Zoom in preview"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(1)}
                  aria-label="Reset preview zoom"
                  className="p-0.5 hover:text-[#1979CA] cursor-pointer"
                  title="Fit preview"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Checkerboard Preview Container */}
            <div
              className="flex-1 min-h-0 rounded-lg border border-[#CBD5E1] dark:border-[#334155] overflow-auto flex items-center justify-center p-4"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, rgba(148,163,184,0.16) 25%, transparent 25%), linear-gradient(-45deg, rgba(148,163,184,0.16) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(148,163,184,0.16) 75%), linear-gradient(-45deg, transparent 75%, rgba(148,163,184,0.16) 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
              }}
            >
              {livePreviewUrl ? (
                <img
                  data-testid="export-preview-image"
                  src={livePreviewUrl}
                  alt={`Final ${format.toUpperCase()} export preview of ${artworkTitle}`}
                  style={{
                    transform: `scale(${previewZoom})`,
                    transformOrigin: 'center center',
                  }}
                  className="max-w-full max-h-full object-contain bg-white shadow-lg border border-slate-300 transition-transform duration-150"
                />
              ) : (
                <div className="text-[12px] text-[#64748B]">Rendering export preview...</div>
              )}
            </div>
          </div>

          {/* Right: Live Export Controls */}
          <div className="w-full lg:w-72 bg-white dark:bg-[#1E232D] border-t lg:border-t-0 lg:border-l border-[#D8D8D8] dark:border-[#2D333B] p-4 flex flex-col justify-between gap-4 overflow-y-auto shrink-0">
            <div className="space-y-4">
              {/* Format Selection */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] mb-1.5">
                  File Format
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'png', label: 'PNG', icon: FileImage },
                      { id: 'jpg', label: 'JPG', icon: FileImage },
                      { id: 'svg', label: 'SVG', icon: FileCode },
                    ] as const
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const active = format === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={`export-preview-format-${opt.id}`}
                        aria-pressed={active}
                        onClick={() => setFormat(opt.id)}
                        className={`py-2 px-2 rounded-md border text-[11.5px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                          active
                            ? 'bg-[#D8E8FA] dark:bg-sky-950/60 border-[#1979CA] text-[#0F2C4C] dark:text-sky-300'
                            : 'bg-[#F8FAFC] dark:bg-[#252C37] border-[#CBD5E1] dark:border-[#475569] text-[#475569] dark:text-[#CBD5E1] hover:bg-[#EFF6FF]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resolution Scale (PNG/JPG) */}
              {format !== 'svg' && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] mb-1.5">
                    Resolution Scale
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([1, 2, 4] as ExportPreviewScale[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        data-testid={`export-preview-scale-${s}x`}
                        aria-pressed={scale === s}
                        onClick={() => setScale(s)}
                        className={`py-1.5 px-2 rounded-md border text-[11px] font-semibold cursor-pointer ${
                          scale === s
                            ? 'bg-[#D8E8FA] dark:bg-sky-950/60 border-[#1979CA] text-[#0F2C4C] dark:text-sky-300'
                            : 'bg-[#F8FAFC] dark:bg-[#252C37] border-[#CBD5E1] dark:border-[#475569] text-[#475569] dark:text-[#CBD5E1]'
                        }`}
                      >
                        {s}×
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* JPG Compression Slider */}
              {format === 'jpg' && (
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                      JPEG Quality
                    </span>
                    <span className="font-mono font-semibold text-[#1979CA]">
                      {Math.round(jpgQuality * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={1}
                    step={0.05}
                    value={jpgQuality}
                    onChange={(e) => setJpgQuality(parseFloat(e.target.value))}
                    aria-label="JPEG quality"
                    className="w-full accent-[#1979CA] cursor-pointer"
                  />
                </div>
              )}

              {/* Layer / Export Options */}
              <div className="space-y-2 pt-1 border-t border-[#E2E8F0] dark:border-[#2D333B]">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                  Included Elements
                </div>

                {activeTemplate && (
                  <label className="flex items-start gap-2 text-[11.5px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeTemplateGuide}
                      onChange={(e) => setIncludeTemplateGuide(e.target.checked)}
                      className="mt-0.5 accent-[#1979CA] cursor-pointer"
                    />
                    <span>Include Paint Book reference guide</span>
                  </label>
                )}

                <label className="flex items-start gap-2 text-[11.5px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeWatermark}
                    onChange={(e) => setIncludeWatermark(e.target.checked)}
                    className="mt-0.5 accent-[#1979CA] cursor-pointer"
                  />
                  <span>Include PIXORA Studio watermark</span>
                </label>
              </div>

              {downloadedNotice && (
                <div
                  data-testid="export-preview-download-success"
                  className="p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-[11.5px] flex items-center gap-2"
                >
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="truncate">{downloadedNotice}</span>
                </div>
              )}
            </div>

            {/* Bottom Action Buttons */}
            <div className="space-y-2 pt-3 border-t border-[#E2E8F0] dark:border-[#2D333B]">
              <button
                type="button"
                data-testid="export-preview-download-btn"
                onClick={handleDownloadFinalImage}
                className="w-full py-2.5 px-4 rounded-md bg-[#1979CA] hover:bg-[#1464A8] text-white text-[12.5px] font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download {format.toUpperCase()}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 px-4 rounded-md border border-[#CBD5E1] dark:border-[#475569] hover:bg-[#F1F5F9] dark:hover:bg-[#2D3748] text-[12px] font-medium cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
