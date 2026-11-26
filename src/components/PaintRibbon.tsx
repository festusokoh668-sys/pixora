import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  FolderOpen,
  Save,
  Printer,
  ChevronDown,
  ChevronUp,
  FlipHorizontal,
  FlipVertical,
  ImagePlus,
  BookOpen,
  Pin,
  PinOff,
  Grid,
  Maximize,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Check,
  X,
  FileImage,
  FileCode,
  Download,
  Layers,
  Sparkles,
  Moon,
  Sun,
  Share2,
  CloudUpload,
  FolderHeart,
  User as UserIcon,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { ThemeMode, getThemeToggleIcon } from '../utils/theme';
import {
  DrawingTemplate,
  LayerFilterType,
  MirrorMode,
  ShapeFillStyle,
  ShapeOutlineStyle,
  ShapeType,
  StampShape,
  SymmetryGuideMode,
  ToolType,
} from '../types';
import { LayerFilterOptions } from '../utils/filters';
import { PAINT_SHAPES, QUICK_SHAPES } from '../utils/shapes';
import { STAMP_SHAPES, toggleMirrorAxis, resolveSymmetryToggle } from '../utils/drawing';
import { buildMultiStopGradientColors } from '../utils/color';
import {
  BRUSH_OPTIONS,
  RecentBrushSetting,
  recordRecentBrushSetting,
} from '../utils/recentBrushes';
import {
  DEFAULT_BUCKET_TOLERANCE,
  getBucketToleranceLabel,
} from '../utils/floodFill';
import {
  hasHorizontalSymmetryGuide,
  hasVerticalSymmetryGuide,
  toggleSymmetryGuideAxis,
  toggleSymmetryGuides,
} from '../utils/symmetryGuides';

export interface PaintRibbonProps {
  activeTab: 'file' | 'home' | 'view';
  onTabChange: (tab: 'file' | 'home' | 'view') => void;
  currentTool: ToolType;
  onToolSelect: (tool: ToolType) => void;
  stampShape?: StampShape;
  onStampShapeChange?: (shape: StampShape) => void;
  currentShape: ShapeType;
  onShapeSelect: (shape: ShapeType) => void;
  outlineStyle: ShapeOutlineStyle;
  onOutlineStyleChange: (style: ShapeOutlineStyle) => void;
  fillStyle: ShapeFillStyle;
  onFillStyleChange: (style: ShapeFillStyle) => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  secondaryColor: string;
  onSecondaryColorChange: (color: string) => void;
  customColors?: string[];
  onEditColors: () => void;
  currentSize: number;
  onSizeChange: (size: number) => void;
  stabilization?: number;
  onStabilizationChange?: (value: number) => void;
  bucketTolerance?: number;
  onBucketToleranceChange?: (tolerance: number) => void;
  pressureSensitive?: boolean;
  onPressureSensitiveChange?: (enabled: boolean) => void;
  isGradientBrush?: boolean;
  onGradientBrushChange?: (enabled: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNew: () => void;
  onOpen: () => void;
  onUploadImage?: (file: File) => void;
  onSave: () => void;
  onOpenExport?: () => void;
  onQuickSave?: () => void;
  isQuickSaving?: boolean;
  onExportFormat?: (format: 'jpg' | 'png' | 'svg') => void;
  onPrint: () => void;
  onClearPage?: () => void;
  onExitStudio?: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  canPaste?: boolean;
  hasSelection?: boolean;
  onCropToSelection: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteSelection: () => void;
  onOpenResize: () => void;
  onFlipHorizontal?: () => void;
  onFlipVertical?: () => void;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToWindow: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showRulers: boolean;
  onToggleRulers: () => void;
  showStatusBar: boolean;
  onToggleStatusBar: () => void;
  showLayersSidebar?: boolean;
  onToggleLayersSidebar?: () => void;
  showGlitter?: boolean;
  onToggleGlitter?: () => void;
  layersCount?: number;
  onToggleFullScreen: () => void;
  activeTemplate: DrawingTemplate | null;
  lastClosedTemplate?: DrawingTemplate | null;
  onRestoreTemplate?: () => void;
  onOpenTemplates: () => void;
  onOpenHelp?: () => void;
  isRibbonOpen?: boolean;
  onToggleRibbon?: () => void;
  isRibbonPinned?: boolean;
  onToggleRibbonPin?: () => void;
  mirrorMode?: MirrorMode;
  onMirrorModeChange?: (mode: MirrorMode) => void;
  symmetryGuides?: SymmetryGuideMode;
  onSymmetryGuidesChange?: (mode: SymmetryGuideMode) => void;
  onMirrorHorizontal?: () => void;
  onMirrorVertical?: () => void;
  onApplyFilter?: (filter: LayerFilterType, options?: LayerFilterOptions) => void;
  onApplyGrayscale?: () => void;
  onApplySepia?: () => void;
  onApplyBrightness?: (delta: number) => void;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
  onShare?: () => void;
  isSharing?: boolean;
  user?: User | null;
  onOpenAuth?: (mode?: 'signin' | 'signup' | 'profile') => void;
  onSaveToCloud?: () => void;
  onOpenCloudGallery?: () => void;
  hasUnsavedChanges?: boolean;
  currentArtworkTitle?: string;
}

const WINDOWS_PAINT_PALETTE = [
  // Row 1 (classic Windows Paint defaults)
  '#000000', '#7F7F7F', '#880015', '#ED1C24', '#FF7F27', '#FFF200', '#22B14C', '#00A2E8', '#3F48CC', '#A349A4',
  // Row 2
  '#FFFFFF', '#C3C3C3', '#B97A57', '#FFAEC9', '#FFC90E', '#EFE4B0', '#B5E61D', '#99D9EA', '#7092BE', '#C8BFE7',
];

const STYLE_OPTIONS: Array<{ id: ShapeOutlineStyle; label: string }> = [
  { id: 'none', label: 'No outline' },
  { id: 'solid', label: 'Solid color' },
  { id: 'crayon', label: 'Crayon' },
  { id: 'marker', label: 'Marker' },
  { id: 'oil', label: 'Oil' },
  { id: 'pencil', label: 'Natural pencil' },
  { id: 'watercolor', label: 'Watercolor' },
];

export const PaintRibbon: React.FC<PaintRibbonProps> = ({
  activeTab,
  onTabChange,
  currentTool,
  onToolSelect,
  stampShape = 'star',
  onStampShapeChange,
  currentShape,
  onShapeSelect,
  outlineStyle,
  onOutlineStyleChange,
  fillStyle,
  onFillStyleChange,
  currentColor,
  onColorChange,
  secondaryColor,
  onSecondaryColorChange,
  customColors = [],
  onEditColors,
  currentSize,
  onSizeChange,
  stabilization = 45,
  onStabilizationChange,
  bucketTolerance = DEFAULT_BUCKET_TOLERANCE,
  onBucketToleranceChange,
  pressureSensitive = true,
  onPressureSensitiveChange,
  isGradientBrush = false,
  onGradientBrushChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onNew,
  onOpen,
  onUploadImage,
  onSave,
  onOpenExport,
  onQuickSave,
  isQuickSaving = false,
  onExportFormat,
  onPrint,
  onClearPage,
  onExitStudio,
  onCut,
  onCopy,
  onPaste,
  canPaste = false,
  hasSelection = false,
  onCropToSelection,
  onSelectAll,
  onClearSelection,
  onDeleteSelection,
  onOpenResize,
  onFlipHorizontal,
  onFlipVertical,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToWindow,
  showGrid,
  onToggleGrid,
  showRulers,
  onToggleRulers,
  showStatusBar,
  onToggleStatusBar,
  showLayersSidebar = true,
  onToggleLayersSidebar,
  showGlitter = true,
  onToggleGlitter,
  layersCount,
  onToggleFullScreen,
  activeTemplate,
  lastClosedTemplate,
  onRestoreTemplate,
  onOpenTemplates,
  onOpenHelp,
  isRibbonOpen = true,
  onToggleRibbon,
  isRibbonPinned = true,
  onToggleRibbonPin,
  mirrorMode = 'none',
  onMirrorModeChange,
  symmetryGuides = 'none',
  onSymmetryGuidesChange,
  onMirrorHorizontal,
  onMirrorVertical,
  onApplyFilter,
  onApplyGrayscale,
  onApplySepia,
  onApplyBrightness,
  themeMode = 'light',
  onToggleTheme,
  onShare,
  isSharing = false,
  user,
  onOpenAuth,
  onSaveToCloud,
  onOpenCloudGallery,
  hasUnsavedChanges = false,
  currentArtworkTitle,
}) => {
  const [activeDropdown, setActiveDropdown] = useState<
    | null
    | 'file'
    | 'select'
    | 'brushes'
    | 'shapes'
    | 'quickShapes'
    | 'outline'
    | 'fill'
    | 'size'
  >(null);
  const [activeColorSlot, setActiveColorSlot] = useState<1 | 2>(1);
  const [brightnessDelta, setBrightnessDelta] = useState<number>(25);
  const [shapeRowOffset, setShapeRowOffset] = useState<number>(0);
  const [recentBrushes, setRecentBrushes] = useState<RecentBrushSetting[]>(() =>
    recordRecentBrushSetting([], currentTool, currentSize, currentColor)
  );

  const ribbonRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const lastSymmetryAxisRef = useRef<Exclude<MirrorMode, 'none'>>('horizontal');
  const lastSymmetryGuideRef = useRef<Exclude<SymmetryGuideMode, 'none'>>('both');

  useEffect(() => {
    if (mirrorMode !== 'none') {
      lastSymmetryAxisRef.current = mirrorMode;
    }
  }, [mirrorMode]);

  useEffect(() => {
    if (symmetryGuides !== 'none') {
      lastSymmetryGuideRef.current = symmetryGuides;
    }
  }, [symmetryGuides]);

  // Track last 5 used brush settings (brush type + size + primary color)
  useEffect(() => {
    setRecentBrushes((prev) =>
      recordRecentBrushSetting(prev, currentTool, currentSize, currentColor)
    );
  }, [currentTool, currentSize, currentColor]);

  // Close open dropdowns when clicking outside Ribbon
  useEffect(() => {
    if (!activeDropdown) return;
    const handleDocClick = (e: MouseEvent) => {
      if (ribbonRef.current && !ribbonRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('pointerdown', handleDocClick);
    return () => document.removeEventListener('pointerdown', handleDocClick);
  }, [activeDropdown]);

  const handlePaletteSwatchClick = (hex: string) => {
    if (activeColorSlot === 1) {
      onColorChange(hex);
    } else {
      onSecondaryColorChange(hex);
    }
  };

  const isBrushTool =
    currentTool === 'brush' ||
    currentTool === 'calligraphy' ||
    currentTool === 'airbrush' ||
    currentTool === 'oil' ||
    currentTool === 'crayon' ||
    currentTool === 'watercolor' ||
    currentTool === 'stamp' ||
    currentTool === 'blur' ||
    currentTool === 'highlighter';

  const renderStampMiniIcon = (shape: StampShape, fillHex: string = '#1979CA', strokeHex: string = '#0F4C81') => {
    switch (shape) {
      case 'star':
        return (
          <polygon
            points="8,1.5 9.9,5.5 14.3,6.1 11.1,9.2 11.9,13.6 8,11.5 4.1,13.6 4.9,9.2 1.7,6.1 6.1,5.5"
            fill={fillHex}
            stroke={strokeHex}
            strokeWidth="1"
            strokeLinejoin="round"
          />
        );
      case 'heart':
        return (
          <path
            d="M8 13.8 C8 13.8 2 9.7 2 5.9 C2 3.8 3.6 2.4 5.4 2.4 C6.6 2.4 7.5 3.1 8 4.1 C8.5 3.1 9.4 2.4 10.6 2.4 C12.4 2.4 14 3.8 14 5.9 C14 9.7 8 13.8 8 13.8 Z"
            fill={fillHex}
            stroke={strokeHex}
            strokeWidth="1"
            strokeLinejoin="round"
          />
        );
      case 'circle':
        return (
          <circle
            cx="8"
            cy="8"
            r="5.2"
            fill={fillHex}
            stroke={strokeHex}
            strokeWidth="1"
          />
        );
    }
  };

  const gradientStops = buildMultiStopGradientColors(currentColor, secondaryColor, 3);
  const gradientCss = `linear-gradient(90deg, ${gradientStops.join(', ')})`;

  const handleToggleGradientBrush = () => {
    const next = !isGradientBrush;
    onGradientBrushChange?.(next);
    if (
      next &&
      !isBrushTool &&
      currentTool !== 'pencil'
    ) {
      onToolSelect('brush');
    }
  };

  // Render crisp Windows-Paint shape SVG icon
  const renderShapeMiniIcon = (shapeId: ShapeType) => {
    const stroke = '#2D5A9E';
    const fill = '#DDE9F9';
    switch (shapeId) {
      case 'line':
        return <line x1="3" y1="13" x2="13" y2="3" stroke={stroke} strokeWidth="1.4" />;
      case 'curve':
        return <path d="M2 12 C5 3, 11 13, 14 4" fill="none" stroke={stroke} strokeWidth="1.4" />;
      case 'oval':
        return <ellipse cx="8" cy="8" rx="6" ry="4.5" fill={fill} stroke={stroke} strokeWidth="1.2" />;
      case 'rectangle':
        return <rect x="2.5" y="4" width="11" height="8" fill={fill} stroke={stroke} strokeWidth="1.2" />;
      case 'rounded-rectangle':
        return <rect x="2.5" y="4" width="11" height="8" rx="2.2" fill={fill} stroke={stroke} strokeWidth="1.2" />;
      case 'polygon':
        return <polygon points="3,5 9,3 13,8 10,13 4,12" fill={fill} stroke={stroke} strokeWidth="1.2" />;
      case 'triangle':
        return <polygon points="8,3 13.5,13 2.5,13" fill={fill} stroke={stroke} strokeWidth="1.2" />;
      case 'right-triangle':
        return <polygon points="3,3 3,13 13,13" fill={fill} stroke={stroke} strokeWidth="1.2" />;
      case 'diamond':
        return <polygon points="8,2 14,8 8,14 2,8" fill={fill} stroke={stroke} strokeWidth="1.2" />;
      case 'pentagon':
        return <polygon points="8,2.2 13.5,6.2 11.4,13 4.6,13 2.5,6.2" fill={fill} stroke={stroke} strokeWidth="1.2" />;
      case 'hexagon':
        return <polygon points="8,2 13,5 13,11 8,14 3,11 3,5" fill={fill} stroke={stroke} strokeWidth="1.2" />;
      case 'arrow-right':
        return <polygon points="2,6 9,6 9,3 14,8 9,13 9,10 2,10" fill={fill} stroke={stroke} strokeWidth="1.1" />;
      case 'arrow-left':
        return <polygon points="14,6 7,6 7,3 2,8 7,13 7,10 14,10" fill={fill} stroke={stroke} strokeWidth="1.1" />;
      case 'arrow-up':
        return <polygon points="6,14 6,7 3,7 8,2 13,7 10,7 10,14" fill={fill} stroke={stroke} strokeWidth="1.1" />;
      case 'arrow-down':
        return <polygon points="6,2 6,9 3,9 8,14 13,9 10,9 10,2" fill={fill} stroke={stroke} strokeWidth="1.1" />;
      case 'star-4':
        return <polygon points="8,2 9.5,6.5 14,8 9.5,9.5 8,14 6.5,9.5 2,8 6.5,6.5" fill={fill} stroke={stroke} strokeWidth="1.1" />;
      case 'star-5':
        return <polygon points="8,2 9.6,6 14,6.2 10.6,9 11.8,13.5 8,11 4.2,13.5 5.4,9 2,6.2 6.4,6" fill={fill} stroke={stroke} strokeWidth="1.1" />;
      case 'star-6':
        return <polygon points="8,2 9.8,5 13,5 11.5,8 13,11 9.8,11 8,14 6.2,11 3,11 4.5,8 3,5 6.2,5" fill={fill} stroke={stroke} strokeWidth="1.1" />;
      case 'heart':
        return <path d="M8 13.5 C8 13.5 2.5 9.5 2.5 6 C2.5 4.1 4 2.8 5.6 2.8 C6.8 2.8 7.6 3.6 8 4.4 C8.4 3.6 9.2 2.8 10.4 2.8 C12 2.8 13.5 4.1 13.5 6 C13.5 9.5 8 13.5 8 13.5 Z" fill={fill} stroke={stroke} strokeWidth="1.1" />;
      case 'callout':
        return <path d="M2.5 4.5 A1.5 1.5 0 0 1 4 3 H12 A1.5 1.5 0 0 1 13.5 4.5 V9.5 A1.5 1.5 0 0 1 12 11 H7 L4.5 13.5 V11 H4 A1.5 1.5 0 0 1 2.5 9.5 Z" fill={fill} stroke={stroke} strokeWidth="1.1" />;
      case 'cloud':
        return <path d="M4.2 12.8 C2.1 12.8 2 9.4 4.2 9 C4.4 6.2 7.8 5.2 9.8 7 C11.8 6.4 13.8 8.4 13.2 10.8 C13 12 12 12.8 10.6 12.8 Z" fill={fill} stroke={stroke} strokeWidth="1.1" />;
      case 'lightning':
        return <polygon points="9.2,2 3.2,8.8 7.5,8.8 6,14 12.8,6.8 8.3,6.8" fill={fill} stroke={stroke} strokeWidth="1.1" />;
    }
  };

  const isQuickShapeSelected =
    currentTool === 'shape' && QUICK_SHAPES.some((sh) => sh.id === currentShape);

  // Visible 14 shapes inside the 7x2 shapes gallery box (scrolled cleanly via shapeRowOffset)
  const visibleShapes = PAINT_SHAPES.slice(shapeRowOffset * 7, shapeRowOffset * 7 + 14);
  const maxShapeRowOffset = Math.max(0, Math.ceil(PAINT_SHAPES.length / 7) - 2);

  // 10 custom slots for row 3
  const customRow = Array.from({ length: 10 }, (_, idx) => customColors[idx] || null);

  return (
    <div
      ref={ribbonRef}
      data-testid="paint-ribbon"
      className="bg-[#FFFFFF] text-[#1E1E1E] select-none font-sans relative z-40 shrink-0"
    >
      {/* Hidden File Input for Open/Import Image */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && onUploadImage) {
            onUploadImage(file);
          }
          e.target.value = '';
        }}
      />

      {/* 1. Paint Studio Title Bar */}
      <div className="h-[28px] bg-white px-2 flex items-center justify-between text-[12px] text-[#1E1E1E]">
        <div className="flex items-center gap-1 min-w-0">
          {/* App Paint Palette Icon */}
          <button
            type="button"
            onClick={onOpenTemplates}
            className="w-5 h-5 flex items-center justify-center shrink-0 hover:bg-[#E5F1FB] cursor-pointer"
            title="Pixora"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3C6.5 3 2 7 2 11.8C2 15.2 4.8 17.5 8 17.5C9.4 17.5 10.2 18.2 10.2 19.3C10.2 20.5 11.1 21 12.5 21C18 21 22 17 22 12C22 7 17.5 3 12 3Z"
                fill="#F6D57E"
                stroke="#8B6F29"
                strokeWidth="1.4"
              />
              <circle cx="7.5" cy="9.5" r="1.6" fill="#ED1C24" />
              <circle cx="12" cy="7.2" r="1.6" fill="#22B14C" />
              <circle cx="16.5" cy="9.5" r="1.6" fill="#00A2E8" />
              <circle cx="16.5" cy="14" r="1.6" fill="#FFF200" />
            </svg>
          </button>

          {/* Quick Access Toolbar: Save, Undo, Redo */}
          <div className="flex items-center gap-0.5 ml-1">
            <button
              type="button"
              data-testid="qat-save-btn"
              onClick={onSave}
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-95 cursor-pointer"
              title="Save Artwork (Ctrl+S)"
              aria-label="Save Artwork"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                <path d="M2 2H11.5L14 4.5V14H2V2Z" fill="#635BA2" stroke="#3E3770" strokeWidth="1" />
                <rect x="4" y="2" width="6" height="4.5" fill="#E6E7EB" />
                <rect x="4" y="9" width="8" height="5" fill="#FFFFFF" />
              </svg>
            </button>

            <button
              type="button"
              data-testid="qat-undo-btn"
              onClick={onUndo}
              disabled={!canUndo}
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-transparent hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-35 transition-all active:scale-95 cursor-pointer disabled:cursor-default"
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 4.5H10C12.2 4.5 13.5 6 13.5 8C13.5 10 12.2 11.5 10 11.5H5.5"
                  stroke={canUndo ? '#1979CA' : '#9AA4B2'}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path d="M6.5 2L3.2 4.6L6.5 7.2V2Z" fill={canUndo ? '#1979CA' : '#9AA4B2'} />
              </svg>
            </button>

            <button
              type="button"
              data-testid="qat-redo-btn"
              onClick={onRedo}
              disabled={!canRedo}
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-transparent hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-35 transition-all active:scale-95 cursor-pointer disabled:cursor-default"
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                <path
                  d="M10 4.5H6C3.8 4.5 2.5 6 2.5 8C2.5 10 3.8 11.5 6 11.5H10.5"
                  stroke={canRedo ? '#1979CA' : '#9AA4B2'}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path d="M9.5 2L12.8 4.6L9.5 7.2V2Z" fill={canRedo ? '#1979CA' : '#9AA4B2'} />
              </svg>
            </button>

            {onSaveToCloud && (
              <button
                type="button"
                data-testid="qat-cloud-save-btn"
                onClick={onSaveToCloud}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-sky-50 dark:hover:bg-sky-950/40 border border-transparent hover:border-sky-300 dark:hover:border-sky-700 transition-all active:scale-95 cursor-pointer"
                title="Save to Cloud"
                aria-label="Save to Cloud"
              >
                <CloudUpload className="w-3.5 h-3.5 text-[#1979CA]" />
              </button>
            )}

            <span className="w-[1px] h-3.5 bg-[#D9D9D9] mx-1.5" />
          </div>

          {/* Document Title with Unsaved indicator */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[12px] font-normal text-[#1E1E1E] truncate">
              {currentArtworkTitle
                ? `${currentArtworkTitle} - Pixora`
                : activeTemplate
                ? `${activeTemplate.name} - Pixora`
                : 'Untitled - Pixora'}
            </span>
            {hasUnsavedChanges ? (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Unsaved changes" />
            ) : (
              <span className="text-[10px] text-emerald-600 font-medium hidden sm:inline" title="All changes saved">
                ✓
              </span>
            )}
          </div>
        </div>

        {/* Right side of Title Bar: Cloud Actions & User Profile (Circular & Professional) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onSaveToCloud && (
            <button
              type="button"
              data-testid="titlebar-cloud-save-btn"
              onClick={onSaveToCloud}
              className="w-6 h-6 rounded-full flex items-center justify-center bg-white dark:bg-[#1E232D] border border-slate-300 dark:border-slate-600 hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/50 text-sky-600 dark:text-sky-400 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
              title="Save drawing to Google Firebase Cloud"
              aria-label="Save to Cloud"
            >
              <CloudUpload className="w-3.5 h-3.5" />
            </button>
          )}

          {onOpenCloudGallery && (
            <button
              type="button"
              data-testid="titlebar-cloud-gallery-btn"
              onClick={onOpenCloudGallery}
              className="w-6 h-6 rounded-full flex items-center justify-center bg-white dark:bg-[#1E232D] border border-slate-300 dark:border-slate-600 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-amber-600 dark:text-amber-400 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
              title="My Artwork (Cloud Gallery)"
              aria-label="My Artwork"
            >
              <FolderHeart className="w-3.5 h-3.5" />
            </button>
          )}

          {/* User Account / Profile Button (Circular) */}
          {onOpenAuth && (
            <button
              type="button"
              data-testid="titlebar-user-btn"
              onClick={() => onOpenAuth(user ? 'profile' : 'signin')}
              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer shadow-2xs ${
                user
                  ? 'bg-gradient-to-tr from-sky-600 to-blue-500 border-sky-400 text-white font-bold text-[10px] hover:ring-2 hover:ring-sky-300 dark:hover:ring-sky-700'
                  : 'bg-white dark:bg-[#1E232D] border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-600 dark:text-slate-300'
              }`}
              title={user ? `Signed in as ${user.displayName || user.email}` : 'Sign In to Pixora'}
              aria-label={user ? `Account (${user.displayName || user.email})` : 'Sign In'}
            >
              {user ? (
                <span>{(user.displayName || user.email || 'P')[0].toUpperCase()}</span>
              ) : (
                <UserIcon className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 2. File | Home | View Tabs Strip */}
      <div className="h-[24px] bg-white border-b border-[#DADBDC] flex items-end justify-between pr-1">
        <div className="flex items-end h-full">
          {/* File Tab (Classic Windows Blue) */}
          <button
            type="button"
            data-testid="ribbon-tab-file"
            onClick={() => {
              setActiveDropdown(activeDropdown === 'file' ? null : 'file');
              onTabChange('file');
            }}
            className={`px-4 h-[23px] text-[12px] font-normal text-white cursor-pointer transition-colors ${
              activeDropdown === 'file' || activeTab === 'file'
                ? 'bg-[#1464A8]'
                : 'bg-[#1979CA] hover:bg-[#1464A8]'
            }`}
          >
            File
          </button>

          {/* Home Tab */}
          <button
            type="button"
            data-testid="ribbon-tab-home"
            onClick={() => {
              onTabChange('home');
              setActiveDropdown(null);
              if (!isRibbonOpen) onToggleRibbon?.();
            }}
            className={`px-3.5 h-[23px] text-[12px] font-normal cursor-pointer ${
              activeTab === 'home' && isRibbonOpen && activeDropdown !== 'file'
                ? 'bg-[#F5F6F7] border-t border-x border-[#DADBDC] text-[#1E1E1E] -mb-px z-10'
                : 'bg-white text-[#1E1E1E] hover:bg-[#F2F2F2]'
            }`}
          >
            Home
          </button>

          {/* View Tab */}
          <button
            type="button"
            data-testid="ribbon-tab-view"
            onClick={() => {
              onTabChange('view');
              setActiveDropdown(null);
              if (!isRibbonOpen) onToggleRibbon?.();
            }}
            className={`px-3.5 h-[23px] text-[12px] font-normal cursor-pointer ${
              activeTab === 'view' && isRibbonOpen && activeDropdown !== 'file'
                ? 'bg-[#F5F6F7] border-t border-x border-[#DADBDC] text-[#1E1E1E] -mb-px z-10'
                : 'bg-white text-[#1E1E1E] hover:bg-[#F2F2F2]'
            }`}
          >
            View
          </button>
        </div>

        {/* Right Tab-Bar Strip Controls: Quick Save, Share, Sparkle, Layers, Pin, Collapse (^), Theme, Help (?) (Circular & Professional) */}
        <div className="flex items-center gap-1.5 pb-0.5">
          {onQuickSave && (
            <button
              type="button"
              data-testid="ribbon-quick-save-btn"
              disabled={isQuickSaving}
              aria-label="Quick Save PNG to downloads"
              onClick={onQuickSave}
              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer disabled:opacity-60 shadow-2xs ${
                isQuickSaving
                  ? 'bg-sky-100 border-sky-400 text-sky-700 animate-pulse'
                  : 'bg-white dark:bg-[#1E232D] border-slate-300 dark:border-slate-600 hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/50 text-[#1979CA]'
              }`}
              title="Quick Save current canvas as timestamped PNG to downloads/ (Ctrl+Shift+S)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          {onShare && (
            <button
              type="button"
              data-testid="ribbon-share-btn"
              disabled={isSharing}
              aria-label="Share drawing or canvas link"
              onClick={onShare}
              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer disabled:opacity-60 shadow-2xs ${
                isSharing
                  ? 'bg-sky-100 border-sky-400 text-sky-700 animate-pulse'
                  : 'bg-white dark:bg-[#1E232D] border-slate-300 dark:border-slate-600 hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/50 text-[#1979CA]'
              }`}
              title="Share current canvas image or session link (Web Share API) (Ctrl+Shift+H)"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}

          {onToggleGlitter && (
            <button
              type="button"
              data-testid="ribbon-sparkle-toggle-btn"
              aria-pressed={showGlitter}
              aria-label={showGlitter ? 'Turn mouse sparkle off' : 'Turn mouse sparkle on'}
              onClick={onToggleGlitter}
              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer shadow-2xs ${
                showGlitter
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 text-amber-500 hover:bg-amber-100 ring-1 ring-amber-300/60'
                  : 'bg-white dark:bg-[#1E232D] border-slate-300 dark:border-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400'
              }`}
              title={
                showGlitter
                  ? 'Mouse Sparkle is ON (click to turn off)'
                  : 'Mouse Sparkle is OFF (click to turn on)'
              }
            >
              <Sparkles
                className={`w-3.5 h-3.5 ${showGlitter ? 'text-[#D97706]' : 'text-[#888888]'}`}
              />
            </button>
          )}

          {onToggleLayersSidebar && (
            <button
              type="button"
              data-testid="ribbon-layers-toggle-btn"
              aria-expanded={showLayersSidebar}
              aria-pressed={showLayersSidebar}
              aria-label={showLayersSidebar ? 'Hide Layers panel' : 'Reveal Layers panel'}
              onClick={onToggleLayersSidebar}
              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer shadow-2xs ${
                showLayersSidebar
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 text-[#1979CA] hover:bg-blue-100 ring-1 ring-blue-300/60'
                  : 'bg-white dark:bg-[#1E232D] border-slate-300 dark:border-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
              title={showLayersSidebar ? 'Hide Layers panel' : 'Reveal Layers panel'}
            >
              <Layers className="w-3.5 h-3.5 text-[#1979CA]" />
            </button>
          )}

          {onToggleRibbonPin && (
            <button
              type="button"
              data-testid="pin-ribbon-btn"
              aria-pressed={isRibbonPinned}
              aria-label={isRibbonPinned ? 'Pinned open (click to auto-hide)' : 'Unpinned (click to pin open)'}
              onClick={onToggleRibbonPin}
              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer shadow-2xs ${
                isRibbonPinned
                  ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 dark:border-sky-600 text-[#1979CA] hover:bg-sky-100'
                  : 'bg-white dark:bg-[#1E232D] border-slate-300 dark:border-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400'
              }`}
              title={
                isRibbonPinned
                  ? 'Pinned open (click to unpin and auto-hide when drawing)'
                  : 'Unpinned (auto-hides while drawing — click to pin open)'
              }
            >
              {isRibbonPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
            </button>
          )}

          {onToggleRibbon && (
            <button
              type="button"
              data-testid="toggle-ribbon-btn"
              aria-expanded={isRibbonOpen}
              onClick={() => {
                setActiveDropdown(null);
                onToggleRibbon();
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center border border-transparent hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all active:scale-95 cursor-pointer"
              title={isRibbonOpen ? 'Minimize the Ribbon (Ctrl+F1)' : 'Expand the Ribbon (Ctrl+F1)'}
            >
              {isRibbonOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {onToggleTheme && (
            <button
              type="button"
              data-testid="theme-toggle-btn"
              data-theme-icon={getThemeToggleIcon(themeMode)}
              aria-pressed={themeMode === 'dark'}
              aria-label={getThemeToggleIcon(themeMode) === 'moon' ? 'Moon' : 'Sun'}
              onClick={onToggleTheme}
              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer shadow-2xs ${
                themeMode === 'dark'
                  ? 'bg-[#252C3A] border-[#4A5568] hover:border-amber-400 hover:bg-[#2D3748] text-amber-400'
                  : 'bg-white border-slate-300 hover:border-amber-400 hover:bg-amber-50 text-slate-600'
              }`}
            >
              {getThemeToggleIcon(themeMode) === 'moon' ? (
                <Moon className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
              )}
            </button>
          )}

          <button
            type="button"
            data-testid="ribbon-help-btn"
            onClick={onOpenHelp}
            className="w-6 h-6 rounded-full bg-[#1979CA] hover:bg-[#1464A8] border border-sky-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer ml-0.5"
            title="Paint Help, Keyboard Shortcuts & Color Tips"
            aria-label="Help"
          >
            ?
          </button>
        </div>
      </div>

      {/* File Backstage Dropdown Menu */}
      {activeDropdown === 'file' && (
        <div
          data-testid="file-dropdown-menu"
          className="absolute left-0 top-[52px] z-50 w-60 bg-[#FBFBFB] border border-[#A0A0A0] shadow-md py-1 text-[12px] text-[#1E1E1E]"
        >
          <button
            type="button"
            onClick={() => {
              setActiveDropdown(null);
              onNew();
            }}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#E5F1FB] text-left cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-[#1979CA]" />
              <span>New</span>
            </span>
            <span className="text-[10px] text-[#666666] font-mono">Alt+N</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveDropdown(null);
              onOpen();
            }}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#E5F1FB] text-left cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <FolderOpen className="w-4 h-4 text-[#D49B27]" />
              <span>Open Paint Book</span>
            </span>
            <span className="text-[10px] text-[#666666] font-mono">Ctrl+O</span>
          </button>
          {onUploadImage && (
            <button
              type="button"
              onClick={() => {
                setActiveDropdown(null);
                uploadInputRef.current?.click();
              }}
              className="w-full px-3 py-2 flex items-center gap-3 hover:bg-[#E5F1FB] text-left cursor-pointer"
            >
              <ImagePlus className="w-4 h-4 text-[#22B14C]" />
              <span>Open Image File...</span>
            </button>
          )}
          {!activeTemplate && lastClosedTemplate && onRestoreTemplate && (
            <button
              type="button"
              onClick={() => {
                setActiveDropdown(null);
                onRestoreTemplate();
              }}
              className="w-full px-3 py-2 flex items-center gap-3 hover:bg-[#E5F1FB] text-left cursor-pointer text-[#1979CA] font-medium"
            >
              <BookOpen className="w-4 h-4" />
              <span>Restore {lastClosedTemplate.name}</span>
            </button>
          )}
          <div className="my-1 border-t border-[#E0E1E2]" />
          {onQuickSave && (
            <button
              type="button"
              data-testid="file-quick-save-btn"
              disabled={isQuickSaving}
              onClick={() => {
                setActiveDropdown(null);
                onQuickSave();
              }}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#E5F1FB] text-left cursor-pointer disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <Download className="w-4 h-4 text-[#1979CA]" />
                <span className="font-medium">Quick Save (PNG)</span>
              </span>
              <span className="text-[10px] text-[#666666] font-mono">Ctrl+Shift+S</span>
            </button>
          )}
          {onShare && (
            <button
              type="button"
              data-testid="file-share-btn"
              disabled={isSharing}
              onClick={() => {
                setActiveDropdown(null);
                onShare();
              }}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#E5F1FB] text-left cursor-pointer disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <Share2 className="w-4 h-4 text-[#1979CA]" />
                <span className="font-medium">Share Canvas</span>
              </span>
              <span className="text-[10px] text-[#666666] font-mono">Ctrl+Shift+H</span>
            </button>
          )}
          <button
            type="button"
            data-testid="file-save-as-btn"
            onClick={() => {
              setActiveDropdown(null);
              onSave();
            }}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#E5F1FB] text-left cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <Save className="w-4 h-4 text-[#635BA2]" />
              <span className="font-medium">Save Artwork</span>
            </span>
            <span className="text-[10px] text-[#666666] font-mono">Ctrl+S</span>
          </button>
          {onSaveToCloud && (
            <button
              type="button"
              data-testid="file-cloud-save-btn"
              onClick={() => {
                setActiveDropdown(null);
                onSaveToCloud();
              }}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#E5F1FB] text-left cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <CloudUpload className="w-4 h-4 text-[#1979CA]" />
                <span>Save to Cloud...</span>
              </span>
              <span className="text-[10px] text-[#1979CA] font-medium">Firestore</span>
            </button>
          )}
          {onOpenCloudGallery && (
            <button
              type="button"
              data-testid="file-cloud-gallery-btn"
              onClick={() => {
                setActiveDropdown(null);
                onOpenCloudGallery();
              }}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#E5F1FB] text-left cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <FolderHeart className="w-4 h-4 text-[#D49B27]" />
                <span>My Artwork</span>
              </span>
              <span className="text-[10px] text-[#666666]">Gallery</span>
            </button>
          )}
          {onOpenExport && (
            <button
              type="button"
              data-testid="file-export-dialog-btn"
              onClick={() => {
                setActiveDropdown(null);
                onOpenExport();
              }}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#E5F1FB] text-left cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <FileImage className="w-4 h-4 text-[#0F766E]" />
                <span>Export High-Res Artwork...</span>
              </span>
            </button>
          )}
          {onExportFormat && (
            <>
              <div className="my-1 border-t border-[#E0E1E2]" />
              <div className="px-3 py-1 flex items-center gap-2 text-[11px] font-semibold text-[#555555]">
                <Download className="w-3.5 h-3.5 text-[#1979CA]" />
                <span>Export Canvas As</span>
              </div>
              <button
                type="button"
                data-testid="file-export-jpg-btn"
                onClick={() => {
                  setActiveDropdown(null);
                  onExportFormat('jpg');
                }}
                className="w-full pl-6 pr-3 py-1.5 flex items-center justify-between hover:bg-[#E5F1FB] text-left cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <FileImage className="w-4 h-4 text-[#D97706]" />
                  <span>Export as JPG</span>
                </span>
                <span className="text-[10px] text-[#666666] font-mono">.jpg</span>
              </button>
              <button
                type="button"
                data-testid="file-export-png-btn"
                onClick={() => {
                  setActiveDropdown(null);
                  onExportFormat('png');
                }}
                className="w-full pl-6 pr-3 py-1.5 flex items-center justify-between hover:bg-[#E5F1FB] text-left cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <FileImage className="w-4 h-4 text-[#1979CA]" />
                  <span>Export as PNG</span>
                </span>
                <span className="text-[10px] text-[#666666] font-mono">.png</span>
              </button>
              <button
                type="button"
                data-testid="file-export-svg-btn"
                onClick={() => {
                  setActiveDropdown(null);
                  onExportFormat('svg');
                }}
                className="w-full pl-6 pr-3 py-1.5 flex items-center justify-between hover:bg-[#E5F1FB] text-left cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <FileCode className="w-4 h-4 text-[#4F46E5]" />
                  <span>Export as SVG</span>
                </span>
                <span className="text-[10px] text-[#666666] font-mono">.svg</span>
              </button>
            </>
          )}
          <div className="my-1 border-t border-[#E0E1E2]" />
          <button
            type="button"
            onClick={() => {
              setActiveDropdown(null);
              onPrint();
            }}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#E5F1FB] text-left cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <Printer className="w-4 h-4 text-[#555555]" />
              <span>Print</span>
            </span>
            <span className="text-[10px] text-[#666666] font-mono">Ctrl+P</span>
          </button>
          <div className="my-1 border-t border-[#E0E1E2]" />
          <button
            type="button"
            onClick={() => {
              setActiveDropdown(null);
              onTabChange('home');
            }}
            className="w-full px-3 py-1.5 flex items-center gap-3 hover:bg-[#E5F1FB] text-left cursor-pointer text-[#444]"
          >
            <X className="w-3.5 h-3.5" />
            <span>Return to Canvas</span>
          </button>
        </div>
      )}

      {/* 3. Ribbon Toolbars Body */}
      {isRibbonOpen && (
        <div
          data-testid="ribbon-toolbar-body"
          className="bg-[#F5F6F7] border-b border-[#DADBDC] h-[94px] px-1.5 py-1 flex items-stretch overflow-x-auto no-scrollbar"
        >
          {activeTab === 'view' ? (
            /* VIEW TAB CONTROLS */
            <div className="flex items-stretch h-full">
              {/* Zoom Group */}
              <div className="flex flex-col justify-between h-full px-1.5 border-r border-[#E0E1E2] shrink-0">
                <div className="flex items-center gap-0.5 pt-0.5">
                  <button
                    type="button"
                    onClick={onZoomIn}
                    className="flex flex-col items-center px-1 py-1 hover:bg-[#E5F1FB] border border-transparent hover:border-[#A0C5E8] cursor-pointer"
                    title="Zoom in (Ctrl++)"
                  >
                    <ZoomIn className="w-6 h-6 text-[#1979CA]" />
                    <span className="text-[11px] leading-tight mt-0.5 text-center">Zoom<br />in</span>
                  </button>
                  <button
                    type="button"
                    onClick={onZoomOut}
                    className="flex flex-col items-center px-1 py-1 hover:bg-[#E5F1FB] border border-transparent hover:border-[#A0C5E8] cursor-pointer"
                    title="Zoom out (Ctrl+-)"
                  >
                    <ZoomOut className="w-6 h-6 text-[#1979CA]" />
                    <span className="text-[11px] leading-tight mt-0.5 text-center">Zoom<br />out</span>
                  </button>
                  <button
                    type="button"
                    onClick={onResetZoom}
                    className="flex flex-col items-center px-1 py-1 hover:bg-[#E5F1FB] border border-transparent hover:border-[#A0C5E8] cursor-pointer"
                    title="100% actual pixel size (Ctrl+0)"
                  >
                    <span className="w-6 h-6 flex items-center justify-center font-bold text-[#1979CA] text-[12px]">
                      100%
                    </span>
                    <span className="text-[11px] leading-tight mt-0.5 text-center">100%</span>
                  </button>
                  <button
                    type="button"
                    onClick={onFitToWindow}
                    className="flex flex-col items-center px-1 py-1 hover:bg-[#E5F1FB] border border-transparent hover:border-[#A0C5E8] cursor-pointer"
                    title="Fit canvas to window"
                  >
                    <Maximize2 className="w-5 h-5 my-0.5 text-[#555]" />
                    <span className="text-[11px] leading-tight mt-0.5 text-center">Fit to<br />window</span>
                  </button>
                </div>
                <span className="text-[11px] text-[#666666] text-center leading-none">Zoom</span>
              </div>

              {/* Show or hide Group */}
              <div className="flex flex-col justify-between h-full px-1.5 border-r border-[#E0E1E2] shrink-0">
                <div className="grid grid-cols-3 gap-x-1.5 gap-y-1.5 pt-1.5 text-[11px]">
                  <label className="flex items-center gap-1 cursor-pointer" title="Show or hide pixel rulers (Alt+R)">
                    <input
                      type="checkbox"
                      checked={showRulers}
                      onChange={onToggleRulers}
                      className="accent-[#1979CA]"
                    />
                    <span>Rulers</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer" title="Show or hide gridlines (Ctrl+G)">
                    <input
                      type="checkbox"
                      data-testid="ribbon-toggle-grid-checkbox"
                      checked={showGrid}
                      onChange={onToggleGrid}
                      className="accent-[#1979CA]"
                    />
                    <span>Gridlines</span>
                  </label>
                  {onToggleGlitter && (
                    <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap" title="Turn mouse sparkle on or off">
                      <input
                        type="checkbox"
                        data-testid="ribbon-toggle-glitter-checkbox"
                        checked={showGlitter}
                        onChange={onToggleGlitter}
                        className="accent-[#1979CA]"
                      />
                      <span>Sparkle</span>
                    </label>
                  )}
                  <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={showStatusBar}
                      onChange={onToggleStatusBar}
                      className="accent-[#1979CA]"
                    />
                    <span>Status bar</span>
                  </label>
                  {onToggleLayersSidebar && (
                    <label className="flex items-center gap-1 cursor-pointer" title="Show or hide Layers sidebar">
                      <input
                        type="checkbox"
                        data-testid="ribbon-toggle-layers-checkbox"
                        checked={showLayersSidebar}
                        onChange={onToggleLayersSidebar}
                        className="accent-[#1979CA]"
                      />
                      <span>Layers</span>
                    </label>
                  )}
                  {onSymmetryGuidesChange && (
                    <label
                      className="flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      title="Show or hide center Symmetry Guides without enabling mirror drawing"
                    >
                      <input
                        type="checkbox"
                        data-testid="ribbon-toggle-symmetry-guides-checkbox"
                        aria-label="Symmetry guides"
                        checked={symmetryGuides !== 'none'}
                        onChange={() =>
                          onSymmetryGuidesChange(
                            toggleSymmetryGuides(symmetryGuides, lastSymmetryGuideRef.current)
                          )
                        }
                        className="accent-[#0D9488]"
                      />
                      <span>Guides</span>
                    </label>
                  )}
                </div>
                <span className="text-[11px] text-[#666666] text-center leading-none">Show or hide</span>
              </div>

              {/* Display Group */}
              <div className="flex flex-col justify-between h-full px-1.5 border-r border-[#E0E1E2] shrink-0">
                <div className="flex items-center gap-0.5 pt-0.5">
                  <button
                    type="button"
                    data-testid="ribbon-grid-toggle-btn"
                    aria-label="Grid Overlay"
                    aria-pressed={showGrid}
                    onClick={onToggleGrid}
                    className={`flex flex-col items-center px-1 py-1 border cursor-pointer ${
                      showGrid
                        ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                        : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                    }`}
                    title="Overlay alignment grid on canvas (Ctrl+G)"
                  >
                    <Grid className="w-6 h-6 text-[#1979CA]" />
                    <span className="text-[11px] leading-tight mt-0.5 text-center">Grid<br />Overlay</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleFullScreen}
                    className="flex flex-col items-center px-1 py-1 hover:bg-[#E5F1FB] border border-transparent hover:border-[#A0C5E8] cursor-pointer"
                    title="Full screen (F11)"
                  >
                    <Maximize className="w-6 h-6 text-[#1979CA]" />
                    <span className="text-[11px] leading-tight mt-0.5 text-center">Full<br />screen</span>
                  </button>
                </div>
                <span className="text-[11px] text-[#666666] text-center leading-none">Display</span>
              </div>

              {/* Flip Canvas Group (Horizontal & Vertical) */}
              <div
                data-testid="view-flip-group"
                className="flex flex-col justify-between h-full px-1.5 border-r border-[#E0E1E2] shrink-0"
              >
                <div className="flex items-center gap-0.5 pt-0.5">
                  <button
                    type="button"
                    data-testid="view-flip-horizontal-btn"
                    aria-label="Flip Horizontal"
                    onClick={() => onFlipHorizontal?.()}
                    className="flex flex-col items-center px-1 py-1 hover:bg-[#E5F1FB] border border-transparent hover:border-[#A0C5E8] cursor-pointer"
                    title="Flip canvas horizontally (Ctrl+F)"
                  >
                    <FlipHorizontal className="w-6 h-6 text-[#1979CA]" />
                    <span className="text-[11px] leading-tight mt-0.5 text-center">
                      Flip<br />Horizontal
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="view-flip-vertical-btn"
                    aria-label="Flip Vertical"
                    onClick={() => onFlipVertical?.()}
                    className="flex flex-col items-center px-1 py-1 hover:bg-[#E5F1FB] border border-transparent hover:border-[#A0C5E8] cursor-pointer"
                    title="Flip canvas vertically (Ctrl+Shift+F)"
                  >
                    <FlipVertical className="w-6 h-6 text-[#1979CA]" />
                    <span className="text-[11px] leading-tight mt-0.5 text-center">
                      Flip<br />Vertical
                    </span>
                  </button>
                </div>
                <span className="text-[11px] text-[#666666] text-center leading-none">
                  Flip Canvas
                </span>
              </div>

              {/* Symmetry & Mirror Axis Group */}
              {(onMirrorModeChange || onMirrorHorizontal || onMirrorVertical) && (
                <div
                  data-testid="view-symmetry-group"
                  className="flex flex-col justify-between h-full px-1.5 border-r border-[#E0E1E2] shrink-0"
                >
                  <div className="flex items-center gap-0.5 pt-0.5">
                    <button
                      type="button"
                      data-testid="ribbon-symmetry-toggle-btn"
                      aria-label="Symmetry Mode"
                      aria-pressed={mirrorMode !== 'none'}
                      onClick={() =>
                        onMirrorModeChange?.(
                          resolveSymmetryToggle(mirrorMode, lastSymmetryAxisRef.current)
                        )
                      }
                      className={`flex flex-col items-center px-1 py-1 border text-[11px] cursor-pointer ${
                        mirrorMode !== 'none'
                          ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                          : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                      }`}
                      title="Toggle Symmetry Mode (vertical or horizontal mirror axis on canvas)"
                    >
                      <svg className="w-5 h-5 my-0.5" viewBox="0 0 24 24" fill="none">
                        <line
                          x1="12"
                          y1="3"
                          x2="12"
                          y2="21"
                          stroke="#1979CA"
                          strokeWidth="1.6"
                          strokeDasharray="2.5 2"
                        />
                        <path
                          d="M10 6.5C7 6.5 4.5 9 4.5 12C4.5 15 7 17.5 10 17.5"
                          stroke="#1E304B"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M14 6.5C17 6.5 19.5 9 19.5 12C19.5 15 17 17.5 14 17.5"
                          stroke="#1979CA"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="leading-tight mt-0.5 font-medium text-center">
                        Symmetry
                        <br />
                        Mode
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="ribbon-mirror-h-btn"
                      aria-pressed={mirrorMode === 'horizontal' || mirrorMode === 'quad'}
                      onClick={() =>
                        onMirrorHorizontal
                          ? onMirrorHorizontal()
                          : onMirrorModeChange?.(toggleMirrorAxis(mirrorMode, 'horizontal'))
                      }
                      className={`flex flex-col items-center px-1 py-1 border cursor-pointer ${
                        mirrorMode === 'horizontal' || mirrorMode === 'quad'
                          ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                          : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                      }`}
                      title="Mirror Horizontal — draw mirrored strokes left & right across vertical axis"
                    >
                      <FlipHorizontal className="w-5 h-5 my-0.5 text-[#1979CA]" />
                      <span className="text-[11px] leading-tight mt-0.5 text-center">
                        Mirror{' '}
                        <br />
                        Horizontal
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="ribbon-mirror-v-btn"
                      aria-pressed={mirrorMode === 'vertical' || mirrorMode === 'quad'}
                      onClick={() =>
                        onMirrorVertical
                          ? onMirrorVertical()
                          : onMirrorModeChange?.(toggleMirrorAxis(mirrorMode, 'vertical'))
                      }
                      className={`flex flex-col items-center px-1 py-1 border cursor-pointer ${
                        mirrorMode === 'vertical' || mirrorMode === 'quad'
                          ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                          : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                      }`}
                      title="Mirror Vertical — draw mirrored strokes top & bottom across horizontal axis"
                    >
                      <FlipVertical className="w-5 h-5 my-0.5 text-[#1979CA]" />
                      <span className="text-[11px] leading-tight mt-0.5 text-center">
                        Mirror{' '}
                        <br />
                        Vertical
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="ribbon-mirror-quad-btn"
                      aria-pressed={mirrorMode === 'quad'}
                      onClick={() =>
                        onMirrorModeChange?.(mirrorMode === 'quad' ? 'none' : 'quad')
                      }
                      className={`flex flex-col items-center px-1 py-1 border text-[11px] cursor-pointer ${
                        mirrorMode === 'quad'
                          ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                          : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                      }`}
                      title="4-Way Quad Symmetry (Horizontal + Vertical mirror)"
                    >
                      <span className="font-bold text-[#1979CA] text-[12px] leading-6">4x</span>
                      <span className="mt-0.5">Quad</span>
                    </button>

                    {onSymmetryGuidesChange && (
                      <div
                        data-testid="ribbon-symmetry-guides-group"
                        className={`w-[88px] h-[56px] px-1 py-0.5 border flex flex-col justify-between items-center ml-0.5 ${
                          symmetryGuides !== 'none'
                            ? 'bg-[#EAF7F5] border-[#0D9488]'
                            : 'bg-[#F8FAFC] border-[#DADBDC]'
                        }`}
                        title="Symmetry Guides: show vertical or horizontal dashed center lines for alignment without mirror drawing"
                      >
                        <button
                          type="button"
                          data-testid="ribbon-symmetry-guides-btn"
                          aria-label="Symmetry Guides"
                          aria-pressed={symmetryGuides !== 'none'}
                          onClick={() =>
                            onSymmetryGuidesChange(
                              toggleSymmetryGuides(symmetryGuides, lastSymmetryGuideRef.current)
                            )
                          }
                          className={`w-full px-1 py-0.5 flex items-center justify-center gap-1 border text-[10.5px] font-medium cursor-pointer whitespace-nowrap ${
                            symmetryGuides !== 'none'
                              ? 'bg-[#CCFBF1] border-[#0D9488] text-[#0F524C]'
                              : 'border-transparent hover:bg-[#E5F1FB] text-[#1E1E1E]'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none">
                            <line x1="8" y1="1.5" x2="8" y2="14.5" stroke="#0D9488" strokeWidth="1.4" strokeDasharray="2.2 1.8" />
                            <line x1="1.5" y1="8" x2="14.5" y2="8" stroke="#0D9488" strokeWidth="1.4" strokeDasharray="2.2 1.8" />
                            <circle cx="8" cy="8" r="1.4" fill="#0D9488" />
                          </svg>
                          <span>Guides</span>
                        </button>
                        <div className="flex items-center gap-0.5 w-full" role="group" aria-label="Symmetry guide orientation">
                          <button
                            type="button"
                            data-testid="ribbon-symmetry-guide-v-btn"
                            aria-label="Vertical center guide"
                            aria-pressed={hasVerticalSymmetryGuide(symmetryGuides)}
                            onClick={() =>
                              onSymmetryGuidesChange(toggleSymmetryGuideAxis(symmetryGuides, 'vertical'))
                            }
                            className={`flex-1 h-[21px] px-0.5 text-[10px] border cursor-pointer flex items-center justify-center gap-0.5 ${
                              hasVerticalSymmetryGuide(symmetryGuides)
                                ? 'bg-[#CCFBF1] border-[#0D9488] text-[#0F524C] font-semibold'
                                : 'bg-white/80 border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8] text-[#333]'
                            }`}
                            title="Toggle Vertical Center Dashed Guide"
                          >
                            <span aria-hidden="true">┆</span>V
                          </button>
                          <button
                            type="button"
                            data-testid="ribbon-symmetry-guide-h-btn"
                            aria-label="Horizontal center guide"
                            aria-pressed={hasHorizontalSymmetryGuide(symmetryGuides)}
                            onClick={() =>
                              onSymmetryGuidesChange(toggleSymmetryGuideAxis(symmetryGuides, 'horizontal'))
                            }
                            className={`flex-1 h-[21px] px-0.5 text-[10px] border cursor-pointer flex items-center justify-center gap-0.5 ${
                              hasHorizontalSymmetryGuide(symmetryGuides)
                                ? 'bg-[#CCFBF1] border-[#0D9488] text-[#0F524C] font-semibold'
                                : 'bg-white/80 border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8] text-[#333]'
                            }`}
                            title="Toggle Horizontal Center Dashed Guide"
                          >
                            <span aria-hidden="true">┄</span>H
                          </button>
                          <button
                            type="button"
                            data-testid="ribbon-symmetry-guide-both-btn"
                            aria-label="Both center guides"
                            aria-pressed={symmetryGuides === 'both'}
                            onClick={() =>
                              onSymmetryGuidesChange(symmetryGuides === 'both' ? 'none' : 'both')
                            }
                            className={`flex-1 h-[21px] px-0.5 text-[10px] border cursor-pointer flex items-center justify-center ${
                              symmetryGuides === 'both'
                                ? 'bg-[#CCFBF1] border-[#0D9488] text-[#0F524C] font-semibold'
                                : 'bg-white/80 border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8] text-[#333]'
                            }`}
                            title="Show Both Vertical & Horizontal Center Guides"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-[#666666] text-center leading-none">
                    Symmetry
                  </span>
                </div>
              )}

              {/* Filters Group (Grayscale, Sepia, Brightness, Invert) */}
              {(onApplyFilter || onApplyGrayscale || onApplySepia || onApplyBrightness) && (
                <div
                  data-testid="view-filters-group"
                  className="flex flex-col justify-between h-full px-1.5 border-r border-[#E0E1E2] shrink-0"
                >
                  <div className="flex items-center gap-1 pt-0.5">
                    <button
                      type="button"
                      data-testid="ribbon-filter-grayscale-btn"
                      onClick={() =>
                        onApplyGrayscale ? onApplyGrayscale() : onApplyFilter?.('grayscale')
                      }
                      className="flex flex-col items-center px-1 py-1 border border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8] text-[11px] cursor-pointer"
                      title="Convert current layer pixel data to grayscale"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="7" fill="#D4D7DC" stroke="#45505E" strokeWidth="1.2" />
                        <path d="M10 3 A7 7 0 0 1 10 17 Z" fill="#636B75" />
                        <path d="M10 6 A4 4 0 0 0 10 14 Z" fill="#F5F6F7" />
                      </svg>
                      <span className="mt-1">Grayscale</span>
                    </button>

                    <button
                      type="button"
                      data-testid="ribbon-filter-sepia-btn"
                      onClick={() =>
                        onApplySepia ? onApplySepia() : onApplyFilter?.('sepia')
                      }
                      className="flex flex-col items-center px-1 py-1 border border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8] text-[11px] cursor-pointer"
                      title="Apply warm sepia tone to current layer pixel data"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                        <rect x="3" y="4" width="14" height="12" rx="1" fill="#E8D2B0" stroke="#8A6030" strokeWidth="1.2" />
                        <path d="M4.5 14 L8.5 9.5 L11.5 12.5 L13.5 10.5 L15.5 14 Z" fill="#9E6E3B" />
                        <circle cx="13.5" cy="7.5" r="1.4" fill="#B88346" />
                      </svg>
                      <span className="mt-1">Sepia</span>
                    </button>

                    {/* Brightness Pixel Adjustment Control */}
                    <div
                      data-testid="ribbon-filter-brightness-control"
                      className="w-[110px] px-1.5 py-1 border border-[#DADBDC] bg-[#F8FAFC] flex flex-col justify-center gap-0.5"
                      title="Adjust brightness of current layer pixel data"
                    >
                      <div className="flex items-center justify-between gap-1 leading-none">
                        <button
                          type="button"
                          data-testid="ribbon-filter-brightness-btn"
                          onClick={() => {
                            const delta = brightnessDelta === 0 ? 25 : brightnessDelta;
                            if (brightnessDelta === 0) setBrightnessDelta(delta);
                            if (onApplyBrightness) {
                              onApplyBrightness(delta);
                            } else {
                              onApplyFilter?.('brightness', { brightnessDelta: delta });
                            }
                          }}
                          className="flex items-center gap-0.5 text-[10.5px] font-medium text-[#1E1E1E] hover:text-[#1979CA] cursor-pointer"
                          title="Apply selected brightness adjustment to current layer"
                        >
                          <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="3" fill="#F5B324" stroke="#B57B0A" strokeWidth="1" />
                            <path
                              d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.4 3.4L4.5 4.5M11.5 11.5L12.6 12.6M12.6 3.4L11.5 4.5M4.5 11.5L3.4 12.6"
                              stroke="#B57B0A"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                            />
                          </svg>
                          <span>Brightness</span>
                        </button>
                        <span
                          data-testid="ribbon-filter-brightness-value"
                          className="text-[10px] font-semibold tabular-nums text-[#1979CA]"
                        >
                          {brightnessDelta > 0 ? `+${brightnessDelta}%` : `${brightnessDelta}%`}
                        </span>
                      </div>
                      <input
                        data-testid="ribbon-filter-brightness-slider"
                        type="range"
                        min={-100}
                        max={100}
                        step={5}
                        value={brightnessDelta}
                        onChange={(e) => setBrightnessDelta(Number(e.target.value))}
                        aria-label="Brightness adjustment"
                        className="w-full h-3 accent-[#1979CA] cursor-pointer"
                      />
                      <div className="flex items-center justify-between text-[9px] text-[#555555] leading-none">
                        <button
                          type="button"
                          data-testid="ribbon-filter-darker-btn"
                          onClick={() => {
                            setBrightnessDelta(-20);
                            if (onApplyBrightness) {
                              onApplyBrightness(-20);
                            } else {
                              onApplyFilter?.('brightness', { brightnessDelta: -20 });
                            }
                          }}
                          className="hover:text-[#1979CA] cursor-pointer px-0.5"
                          title="Darken current layer by 20%"
                        >
                          -20%
                        </button>
                        <button
                          type="button"
                          data-testid="ribbon-filter-brightness-apply-btn"
                          onClick={() => {
                            const delta = brightnessDelta === 0 ? 25 : brightnessDelta;
                            if (brightnessDelta === 0) setBrightnessDelta(delta);
                            if (onApplyBrightness) {
                              onApplyBrightness(delta);
                            } else {
                              onApplyFilter?.('brightness', { brightnessDelta: delta });
                            }
                          }}
                          className="font-semibold text-[#1979CA] hover:underline cursor-pointer px-1"
                          title="Apply slider brightness adjustment"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          data-testid="ribbon-filter-brighter-btn"
                          onClick={() => {
                            setBrightnessDelta(20);
                            if (onApplyBrightness) {
                              onApplyBrightness(20);
                            } else {
                              onApplyFilter?.('brightness', { brightnessDelta: 20 });
                            }
                          }}
                          className="hover:text-[#1979CA] cursor-pointer px-0.5"
                          title="Brighten current layer by 20%"
                        >
                          +20%
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      data-testid="ribbon-filter-invert-btn"
                      onClick={() => onApplyFilter?.('invert')}
                      className="flex flex-col items-center px-1 py-1 border border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8] text-[11px] cursor-pointer"
                      title="Invert colors of current drawing layer (Ctrl+I)"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="7" fill="#FFFFFF" stroke="#1E1E1E" strokeWidth="1.2" />
                        <path d="M10 3 A7 7 0 0 0 10 17 Z" fill="#1E1E1E" />
                        <circle cx="10" cy="10" r="2.2" fill="#1979CA" />
                      </svg>
                      <span className="mt-1">Invert</span>
                    </button>
                  </div>
                  <span className="text-[11px] text-[#666666] text-center leading-none">Filters</span>
                </div>
              )}
            </div>
          ) : (
            /* HOME RIBBON TOOLBAR — Exact Screenshot Group Order */
            <div className="flex items-stretch h-full">
              {/* GROUP 1: CLIPBOARD */}
              <div className="flex flex-col justify-between h-full px-0.5 border-r border-[#E0E1E2] shrink-0">
                <div className="flex items-start gap-0.5 pt-0.5">
                  <button
                    type="button"
                    data-testid="ribbon-paste-btn"
                    onClick={onPaste}
                    disabled={!canPaste}
                    className={`flex flex-col items-center px-1 py-0.5 border border-transparent cursor-pointer ${
                      canPaste
                        ? 'hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                        : 'opacity-45 cursor-default'
                    }`}
                    title="Paste selection (Ctrl+V)"
                  >
                    {/* Classic Clipboard SVG */}
                    <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
                      <rect x="4" y="4" width="14" height="19" rx="1.5" fill="#D5B278" stroke="#8C6D3B" strokeWidth="1.2" />
                      <rect x="8" y="2" width="6" height="3.5" rx="1" fill="#A0A5AD" stroke="#5E636B" strokeWidth="1" />
                      <rect x="11" y="9" width="12" height="15" fill="#FFFFFF" stroke="#6E7885" strokeWidth="1" />
                      <line x1="13" y1="13" x2="21" y2="13" stroke="#9AA4B2" strokeWidth="1" />
                      <line x1="13" y1="16" x2="21" y2="16" stroke="#9AA4B2" strokeWidth="1" />
                      <line x1="13" y1="19" x2="19" y2="19" stroke="#9AA4B2" strokeWidth="1" />
                    </svg>
                    <span className="text-[11px] leading-tight mt-0.5 flex items-center gap-0.5">
                      Paste <span className="text-[8px]">▾</span>
                    </span>
                  </button>

                  <div className="flex flex-col gap-0.5 pt-0.5">
                    <button
                      type="button"
                      data-testid="ribbon-cut-btn"
                      onClick={onCut}
                      disabled={!hasSelection}
                      className={`flex items-center gap-1 px-1 py-0.5 text-[11px] border border-transparent cursor-pointer ${
                        hasSelection
                          ? 'hover:bg-[#E5F1FB] hover:border-[#A0C5E8] text-[#1E1E1E]'
                          : 'opacity-45 text-[#666] cursor-default'
                      }`}
                      title="Cut selection (Ctrl+X)"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                        <circle cx="4.5" cy="11.5" r="2" stroke="#2D5A9E" strokeWidth="1.2" />
                        <circle cx="11.5" cy="11.5" r="2" stroke="#2D5A9E" strokeWidth="1.2" />
                        <path d="M5.5 9.8L12 2.5M10.5 9.8L4 2.5" stroke="#555" strokeWidth="1.2" />
                      </svg>
                      <span>Cut</span>
                    </button>
                    <button
                      type="button"
                      data-testid="ribbon-copy-btn"
                      onClick={onCopy}
                      className="flex items-center gap-1 px-1 py-0.5 text-[11px] border border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8] text-[#1E1E1E] cursor-pointer"
                      title="Copy selection or canvas (Ctrl+C)"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                        <rect x="3" y="2" width="7.5" height="9.5" fill="#FFF" stroke="#666" strokeWidth="1" />
                        <rect x="5.5" y="4.5" width="7.5" height="9.5" fill="#FFF" stroke="#2D5A9E" strokeWidth="1" />
                      </svg>
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
                <span className="text-[11px] text-[#666666] text-center leading-none pb-0.5">
                  Clipboard
                </span>
              </div>

              {/* GROUP 2: IMAGE */}
              <div className="flex flex-col justify-between h-full px-0.5 border-r border-[#E0E1E2] shrink-0 relative">
                <div className="flex items-start gap-0.5 pt-0.5">
                  <div className="relative">
                    <button
                      type="button"
                      data-testid="tool-select-btn"
                      onClick={() => {
                        onToolSelect('select');
                        setActiveDropdown(activeDropdown === 'select' ? null : 'select');
                      }}
                      className={`flex flex-col items-center px-1.5 py-0.5 border cursor-pointer ${
                        currentTool === 'select'
                          ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                          : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                      }`}
                      title="Select rectangular region on canvas (S)"
                    >
                      <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
                        <rect
                          x="4"
                          y="5"
                          width="20"
                          height="18"
                          fill="#FFFFFF"
                          stroke="#1979CA"
                          strokeWidth="1.4"
                          strokeDasharray="3 2"
                        />
                      </svg>
                      <span className="text-[11px] leading-tight mt-0.5 flex items-center gap-0.5">
                        Select <span className="text-[8px]">▾</span>
                      </span>
                    </button>

                    {activeDropdown === 'select' && (
                      <div className="fixed mt-0.5 z-50 w-52 bg-white border border-[#A0A0A0] shadow-md py-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            onToolSelect('select');
                            setActiveDropdown(null);
                          }}
                          className="w-full px-3 py-1.5 hover:bg-[#E5F1FB] text-left cursor-pointer flex items-center justify-between"
                        >
                          <span>Rectangular selection</span>
                          {currentTool === 'select' && <Check className="w-3 h-3 text-[#1979CA]" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectAll();
                            setActiveDropdown(null);
                          }}
                          className="w-full px-3 py-1.5 hover:bg-[#E5F1FB] text-left cursor-pointer flex items-center justify-between"
                        >
                          <span>Select all</span>
                          <span className="text-[10px] text-[#666666] font-mono">Ctrl+A</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onClearSelection();
                            setActiveDropdown(null);
                          }}
                          className="w-full px-3 py-1.5 hover:bg-[#E5F1FB] text-left cursor-pointer flex items-center justify-between"
                        >
                          <span>Clear selection</span>
                          <span className="text-[10px] text-[#666666] font-mono">Esc</span>
                        </button>
                        <button
                          type="button"
                          disabled={!hasSelection}
                          onClick={() => {
                            onDeleteSelection();
                            setActiveDropdown(null);
                          }}
                          className="w-full px-3 py-1.5 hover:bg-[#E5F1FB] text-left cursor-pointer disabled:opacity-40 flex items-center justify-between"
                        >
                          <span>Delete selected</span>
                          <span className="text-[10px] text-[#666666] font-mono">Del</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-0.5 pt-0.5">
                    <button
                      type="button"
                      data-testid="ribbon-crop-btn"
                      onClick={onCropToSelection}
                      disabled={!hasSelection}
                      className={`flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] border border-transparent cursor-pointer ${
                        hasSelection
                          ? 'hover:bg-[#E5F1FB] hover:border-[#A0C5E8] text-[#1E1E1E]'
                          : 'opacity-45 text-[#666] cursor-default'
                      }`}
                      title="Crop canvas to current selection (Ctrl+Shift+X)"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                        <path d="M4 1V12H15M1 4H12V15" stroke="#1979CA" strokeWidth="1.3" />
                      </svg>
                      <span>Crop</span>
                    </button>
                    <button
                      type="button"
                      data-testid="ribbon-resize-btn"
                      onClick={onOpenResize}
                      className="flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] border border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8] text-[#1E1E1E] cursor-pointer"
                      title="Resize canvas dimensions (Ctrl+E)"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                        <rect x="2" y="2" width="12" height="12" fill="#FFF" stroke="#666" strokeWidth="1" />
                        <rect x="2" y="6" width="8" height="8" fill="#BBD8F6" stroke="#1979CA" strokeWidth="1" />
                      </svg>
                      <span>Resize</span>
                    </button>


                  </div>
                </div>
                <span className="text-[11px] text-[#666666] text-center leading-none pb-0.5">
                  Image
                </span>
              </div>

              {/* GROUP 3: TOOLS (Pencil, Fill, Text, Ruler / Eraser, Color picker, Magnifier + Fill Tolerance) */}
              <div className="flex flex-col justify-between h-full px-1 border-r border-[#E0E1E2] shrink-0">
                <div className="flex items-start gap-1 pt-0.5">
                  <div className="grid grid-cols-4 gap-0.5 pt-0.5">
                    {/* Pencil */}
                    <button
                      type="button"
                      data-testid="tool-pencil-btn"
                      onClick={() => onToolSelect('pencil')}
                      className={`w-[24px] h-[24px] flex items-center justify-center border cursor-pointer ${
                        currentTool === 'pencil'
                          ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                          : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                      }`}
                      title="Pencil (P)"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                        <path d="M11.5 2L14 4.5L5.5 13L2 14L3 10.5L11.5 2Z" fill="#F7C948" stroke="#8C6214" strokeWidth="1" />
                        <path d="M10.5 3L13 5.5" stroke="#D9534F" strokeWidth="1.5" />
                        <path d="M2 14L3.8 13.5L2.5 12.2Z" fill="#333" />
                      </svg>
                    </button>

                    {/* Fill with color */}
                    <button
                      type="button"
                      data-testid="tool-bucket-btn"
                      onClick={() => onToolSelect('bucket')}
                      className={`w-[24px] h-[24px] flex items-center justify-center border cursor-pointer ${
                        currentTool === 'bucket'
                          ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                          : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                      }`}
                      title={`Fill with color (K) — Tolerance: ${bucketTolerance} (${getBucketToleranceLabel(bucketTolerance)})`}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                        <path d="M3 7.5L8 2.5L13 7.5L8 12.5L3 7.5Z" fill="#D5DCE4" stroke="#5A6675" strokeWidth="1" />
                        <path d="M13 8C13 8 15 10.2 15 11.8C15 12.9 14.1 13.8 13 13.8C11.9 13.8 11 12.9 11 11.8C11 10.2 13 8 13 8Z" fill="#1979CA" />
                      </svg>
                    </button>

                    {/* Text (A) */}
                    <button
                      type="button"
                      data-testid="tool-text-btn"
                      onClick={() => onToolSelect('text')}
                      className={`w-[24px] h-[24px] flex items-center justify-center border cursor-pointer ${
                        currentTool === 'text'
                          ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                          : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                      }`}
                      title="Text (T)"
                    >
                      <span className="font-serif font-bold text-[15px] text-[#1E1E1E] leading-none">
                        A
                      </span>
                    </button>

                    {/* Ruler (Interactive Pixel Rulers) */}
                    <button
                      type="button"
                      data-testid="tool-ruler-btn"
                      aria-pressed={showRulers}
                      onClick={onToggleRulers}
                      className={`w-[24px] h-[24px] flex items-center justify-center border cursor-pointer ${
                        showRulers
                          ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                          : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                      }`}
                      title="Ruler (Alt+R)"
                      aria-label="Ruler"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                        <rect x="2" y="5" width="12" height="6" fill="#F6D57E" stroke="#8C6D1F" strokeWidth="1" />
                        <line x1="4.5" y1="5" x2="4.5" y2="7.5" stroke="#5A4614" strokeWidth="1" />
                        <line x1="7" y1="5" x2="7" y2="8.5" stroke="#5A4614" strokeWidth="1" />
                        <line x1="9.5" y1="5" x2="9.5" y2="7.5" stroke="#5A4614" strokeWidth="1" />
                        <line x1="12" y1="5" x2="12" y2="8.5" stroke="#5A4614" strokeWidth="1" />
                      </svg>
                    </button>

                    {/* Eraser */}
                    <button
                      type="button"
                      data-testid="tool-eraser-btn"
                      onClick={() => onToolSelect('eraser')}
                      className={`w-[24px] h-[24px] flex items-center justify-center border cursor-pointer ${
                        currentTool === 'eraser'
                          ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                          : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                      }`}
                      title="Eraser (E)"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                        <polygon points="3,10 8.5,4.5 13.5,9.5 8,14 3,14" fill="#F4A3B4" stroke="#9B4E5F" strokeWidth="1" />
                      </svg>
                    </button>

                    {/* Color picker */}
                    <button
                      type="button"
                      data-testid="tool-picker-btn"
                      onClick={() => onToolSelect('picker')}
                      className={`w-[24px] h-[24px] flex items-center justify-center border cursor-pointer ${
                        currentTool === 'picker'
                          ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                          : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                      }`}
                      title="Color picker (I)"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                        <path d="M10.5 2.5L13.5 5.5L11.5 7.5L8.5 4.5L10.5 2.5Z" fill="#5A6675" />
                        <path d="M8.5 4.5L3 10L2.5 13.5L6 13L11.5 7.5" fill="#DDE9F9" stroke="#45505E" strokeWidth="1" />
                      </svg>
                    </button>

                    {/* Magnifier */}
                    <button
                      type="button"
                      data-testid="tool-magnifier-btn"
                      onClick={() => onToolSelect('magnifier')}
                      className={`w-[24px] h-[24px] flex items-center justify-center border cursor-pointer ${
                        currentTool === 'magnifier'
                          ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                          : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                      }`}
                      title="Magnifier (M) — Click to zoom in, Alt/Right-click to zoom out"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                        <circle cx="6.5" cy="6.5" r="4" fill="#E3F0FC" stroke="#4C6178" strokeWidth="1.2" />
                        <line x1="9.5" y1="9.5" x2="14" y2="14" stroke="#4C6178" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>

                  {/* Paint Bucket Fill Tolerance Slider Control */}
                  <div
                    data-testid="ribbon-bucket-tolerance-control"
                    className={`w-[70px] px-1 py-1 border flex flex-col justify-center gap-0.5 ${
                      currentTool === 'bucket'
                        ? 'bg-[#EAF3FD] border-[#7DA2CE]'
                        : 'bg-[#F8FAFC] border-[#DADBDC]'
                    }`}
                    title={`Paint Bucket Fill Tolerance (${bucketTolerance} — ${getBucketToleranceLabel(bucketTolerance)}): controls how far fill color spreads across textured or shaded regions`}
                  >
                    <div className="flex items-center justify-between gap-0.5 leading-none">
                      <label
                        htmlFor="ribbon-bucket-tolerance-slider"
                        className="text-[10px] font-medium text-[#1E1E1E] select-none"
                      >
                        Tolerance
                      </label>
                      <span
                        data-testid="ribbon-bucket-tolerance-value"
                        className="text-[10px] font-semibold tabular-nums text-[#1979CA]"
                      >
                        {bucketTolerance}
                      </span>
                    </div>
                    <input
                      id="ribbon-bucket-tolerance-slider"
                      data-testid="ribbon-bucket-tolerance-slider"
                      type="range"
                      min={0}
                      max={255}
                      step={1}
                      value={bucketTolerance}
                      onChange={(e) => onBucketToleranceChange?.(Number(e.target.value))}
                      aria-label="Paint bucket color tolerance"
                      className="w-full h-3 accent-[#1979CA] cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[9px] text-[#666666] leading-none">
                      <button
                        type="button"
                        data-testid="bucket-tolerance-preset-0"
                        onClick={() => onBucketToleranceChange?.(0)}
                        className={`hover:text-[#1979CA] cursor-pointer ${
                          bucketTolerance === 0 ? 'font-semibold text-[#1979CA]' : ''
                        }`}
                        title="Exact match only (0)"
                      >
                        Exact
                      </button>
                      <button
                        type="button"
                        data-testid="bucket-tolerance-preset-38"
                        onClick={() => onBucketToleranceChange?.(38)}
                        className={`hover:text-[#1979CA] cursor-pointer ${
                          bucketTolerance === 38 ? 'font-semibold text-[#1979CA]' : ''
                        }`}
                        title="Balanced default tolerance (38)"
                      >
                        38
                      </button>
                      <button
                        type="button"
                        data-testid="bucket-tolerance-preset-120"
                        onClick={() => onBucketToleranceChange?.(120)}
                        className={`hover:text-[#1979CA] cursor-pointer ${
                          bucketTolerance === 120 ? 'font-semibold text-[#1979CA]' : ''
                        }`}
                        title="Wide texture spread (120)"
                      >
                        Wide
                      </button>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-[#666666] text-center leading-none pb-0.5">
                  Tools
                </span>
              </div>

              {/* GROUP 4: BRUSHES & STABILIZATION */}
              <div className="flex flex-col justify-between h-full px-0.5 border-r border-[#E0E1E2] shrink-0 relative">
                <div className="pt-0.5 flex items-center gap-0.5">
                  <button
                    type="button"
                    data-testid="ribbon-brushes-btn"
                    onClick={() => {
                      if (!isBrushTool) onToolSelect('brush');
                      setActiveDropdown(activeDropdown === 'brushes' ? null : 'brushes');
                    }}
                    className={`flex flex-col items-center px-1 py-0.5 border cursor-pointer min-w-[42px] ${
                      isBrushTool
                        ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                        : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                    }`}
                    title={currentTool === 'blur' ? 'Brushes (Blur active)' : 'Brushes'}
                  >
                    <div className="w-8 h-8 flex items-center justify-center">
                      <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
                        <path
                          d="M6 20 C8 16, 13 15, 16 16 C18 16.5, 22 14, 24 10"
                          stroke="#E86E2C"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                        />
                        <path
                          d="M17.5 4.5 L21 8 L13.5 16.5 L10 13 Z"
                          fill="#D9DFE6"
                          stroke="#5E6A78"
                          strokeWidth="1"
                        />
                        <path d="M10 13 C8.5 14, 7.5 16.5, 6 19 C9 18.5, 11.5 17.5, 13.5 16.5 Z" fill="#C94A2A" />
                      </svg>
                    </div>
                    <span className="text-[11px] leading-tight mt-0.5 flex items-center gap-0.5">
                      Brushes <span className="text-[8px]">▾</span>
                    </span>
                  </button>

                  {/* Gradient Brush Mode Toggle (Primary -> Secondary multi-color stroke) */}
                  <button
                    type="button"
                    data-testid="gradient-brush-btn"
                    aria-pressed={isGradientBrush}
                    onClick={handleToggleGradientBrush}
                    className={`flex flex-col items-center justify-between px-0.5 py-0.5 border cursor-pointer min-w-[40px] h-[54px] ${
                      isGradientBrush
                        ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                        : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                    }`}
                    title={`Gradient Brush mode (${currentColor.toUpperCase()} → ${secondaryColor.toUpperCase()} in one stroke)`}
                  >
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <svg className="w-6 h-5" viewBox="0 0 24 20" fill="none">
                        <defs>
                          <linearGradient id="ribbon_grad_brush_stroke" x1="2" y1="16" x2="22" y2="4" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor={gradientStops[0]} />
                            <stop offset="50%" stopColor={gradientStops[1]} />
                            <stop offset="100%" stopColor={gradientStops[2]} />
                          </linearGradient>
                        </defs>
                        <path
                          d="M3 15 C7 7, 15 13, 21 5"
                          stroke="url(#ribbon_grad_brush_stroke)"
                          strokeWidth="4.2"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span
                        data-testid="gradient-brush-preview-bar"
                        className="w-8 h-1.5 border border-[#7A8494] block"
                        style={{ backgroundImage: gradientCss }}
                      />
                    </div>
                    <span className="text-[10px] leading-[1.05] text-center">
                      Gradient{' '}
                      <br />
                      Brush
                    </span>
                  </button>

                  {/* Pointer Pressure Sensitivity Toggle (variable stroke width from stylus/device pressure) */}
                  <button
                    type="button"
                    data-testid="ribbon-pressure-toggle-btn"
                    aria-pressed={pressureSensitive}
                    onClick={() => onPressureSensitiveChange?.(!pressureSensitive)}
                    className={`flex flex-col items-center justify-between px-0.5 py-0.5 border cursor-pointer min-w-[38px] h-[54px] ${
                      pressureSensitive
                        ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                        : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                    }`}
                    title={
                      pressureSensitive
                        ? 'Pressure Sensitivity ON: brush width varies with stylus/pointer pressure (click to lock uniform width)'
                        : 'Pressure Sensitivity OFF: uniform stroke width (click to enable device pressure response)'
                    }
                  >
                    <div className="flex items-center justify-center pt-0.5">
                      <svg className="w-6 h-5" viewBox="0 0 24 20" fill="none">
                        {/* Tapered variable-width pressure stroke */}
                        <path
                          d="M3 15.5 C7 14.5, 11 10.5, 19.5 6.5 C15 12, 10.5 16.5, 3 16.5 Z"
                          fill={pressureSensitive ? '#1979CA' : '#8A94A6'}
                        />
                        {/* Stylus nib */}
                        <path
                          d="M17.5 3.5 L20.5 6.5 L15.5 11.5 L12.5 8.5 Z"
                          fill="#E6ECF5"
                          stroke="#4A5568"
                          strokeWidth="1"
                        />
                        <path d="M12.5 8.5 L10.5 13 L15 11.5 Z" fill="#1E304B" />
                      </svg>
                    </div>
                    <span className="text-[10px] leading-[1.05] text-center">
                      Pressure
                    </span>
                  </button>

                  {/* Stamp Brush Tool & Shape Picker (Star, Heart, Circle) */}
                  <div
                    data-testid="ribbon-stamp-group"
                    className={`h-[54px] px-1 py-0.5 border flex flex-col justify-between items-center ${
                      currentTool === 'stamp'
                        ? 'bg-[#EAF3FD] border-[#7DA2CE]'
                        : 'border-[#DADBDC] bg-[#F8FAFC]'
                    }`}
                  >
                    <button
                      type="button"
                      data-testid="ribbon-stamp-brush-btn"
                      aria-label="Stamp Brush"
                      aria-pressed={currentTool === 'stamp'}
                      onClick={() => onToolSelect('stamp')}
                      className={`w-full px-1 py-0.5 flex items-center justify-center gap-1 border text-[10px] font-medium cursor-pointer ${
                        currentTool === 'stamp'
                          ? 'bg-[#D8E8FA] border-[#7DA2CE] text-[#0F2C4C]'
                          : 'border-transparent hover:bg-[#E5F1FB] text-[#1E1E1E]'
                      }`}
                      title="Stamp Brush — click or drag to stamp shapes onto canvas"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16">
                        {renderStampMiniIcon(
                          stampShape,
                          currentColor === '#FFFFFF' ? '#1979CA' : currentColor,
                          '#1E304B'
                        )}
                      </svg>
                      <span>Stamp</span>
                    </button>

                    <div className="flex items-center gap-0.5" role="group" aria-label="Stamp shape selection">
                      {STAMP_SHAPES.map((st) => {
                        const isSelectedShape = stampShape === st.id;
                        const activeBtn = currentTool === 'stamp' && isSelectedShape;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            data-testid={`stamp-shape-${st.id}-btn`}
                            aria-label={`${st.label} stamp`}
                            aria-pressed={activeBtn}
                            onClick={() => {
                              onStampShapeChange?.(st.id);
                              onToolSelect('stamp');
                            }}
                            className={`w-[20px] h-[21px] flex items-center justify-center border cursor-pointer ${
                              activeBtn
                                ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                                : isSelectedShape
                                ? 'bg-white border-[#A0C5E8]'
                                : 'bg-white/70 border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                            }`}
                            title={`Stamp ${st.label}`}
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16">
                              {renderStampMiniIcon(
                                st.id,
                                st.id === 'star'
                                  ? '#F59E0B'
                                  : st.id === 'heart'
                                  ? '#EF4444'
                                  : '#1979CA',
                                '#1E304B'
                              )}
                            </svg>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Brush Stroke Stabilization Intensity Slider */}
                  <div
                    data-testid="ribbon-stabilization-control"
                    className="w-[68px] px-1 py-1 border border-[#DADBDC] bg-[#F8FAFC] flex flex-col justify-center gap-0.5"
                    title="Brush Stroke Stabilization: averages cursor positions for smoother lines"
                  >
                    <div className="flex items-center justify-between gap-0.5 leading-none">
                      <label
                        htmlFor="ribbon-stabilization-slider"
                        className="text-[10px] font-medium text-[#1E1E1E] select-none"
                      >
                        Stabilize
                      </label>
                      <span
                        data-testid="ribbon-stabilization-value"
                        className="text-[10px] font-semibold tabular-nums text-[#1979CA]"
                      >
                        {stabilization}%
                      </span>
                    </div>
                    <input
                      id="ribbon-stabilization-slider"
                      data-testid="ribbon-stabilization-slider"
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={stabilization}
                      onChange={(e) => onStabilizationChange?.(Number(e.target.value))}
                      aria-label="Stabilization intensity"
                      className="w-full h-3 accent-[#1979CA] cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[9px] text-[#666666] leading-none">
                      <button
                        type="button"
                        onClick={() => onStabilizationChange?.(0)}
                        className="hover:text-[#1979CA] cursor-pointer"
                        title="Raw unsmoothed cursor (0%)"
                      >
                        Off
                      </button>
                      <button
                        type="button"
                        onClick={() => onStabilizationChange?.(50)}
                        className="hover:text-[#1979CA] cursor-pointer"
                        title="Balanced stabilization (50%)"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => onStabilizationChange?.(100)}
                        className="hover:text-[#1979CA] cursor-pointer"
                        title="Maximum cursor averaging (100%)"
                      >
                        Max
                      </button>
                    </div>
                  </div>

                  {activeDropdown === 'brushes' && (
                    <div
                      data-testid="brushes-dropdown"
                      className="fixed mt-0.5 z-50 w-64 bg-white border border-[#A0A0A0] shadow-md text-[11px]"
                    >
                      {/* Recent Group: Last 5 Used Brush Settings */}
                      <div data-testid="brushes-recent-group">
                        <div className="bg-[#F5F6F7] border-b border-[#E0E1E2] px-2 py-1 text-[10px] font-semibold text-[#555555] flex items-center justify-between">
                          <span>Recent</span>
                          <span className="text-[9px] text-[#777777] font-normal">
                            Last {recentBrushes.length}/5
                          </span>
                        </div>
                        <div className="p-1 flex flex-col gap-0.5">
                          {recentBrushes.length === 0 ? (
                            <div className="px-2 py-1 text-[10px] text-[#777777]">
                              No recent brushes yet
                            </div>
                          ) : (
                            recentBrushes.map((item, idx) => {
                              const isActivePreset =
                                currentTool === item.tool &&
                                Math.round(currentSize) === item.size &&
                                currentColor.trim().toUpperCase() === item.color;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  data-testid={`recent-brush-item-${idx}`}
                                  onClick={() => {
                                    onToolSelect(item.tool);
                                    onSizeChange(item.size);
                                    onColorChange(item.color);
                                    setActiveDropdown(null);
                                  }}
                                  aria-label={`Recent ${item.label}, ${item.size}px, color ${item.color}`}
                                  title={`${item.label} • ${item.size}px • ${item.color}`}
                                  className={`w-full px-2 py-1 flex items-center justify-between gap-2 text-left border cursor-pointer ${
                                    isActivePreset
                                      ? 'bg-[#D8E8FA] border-[#7DA2CE] font-semibold'
                                      : 'border-transparent hover:bg-[#E5F1FB]'
                                  }`}
                                >
                                  <span className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="w-3 h-3 border border-[#808080] shrink-0"
                                      style={{ backgroundColor: item.color }}
                                    />
                                    <span className="truncate text-[#1E1E1E]">{item.label}</span>
                                  </span>
                                  <span className="text-[10px] text-[#555555] font-mono shrink-0">
                                    {item.size}px
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* All Brushes Group */}
                      <div className="bg-[#F5F6F7] border-y border-[#E0E1E2] px-2 py-1 text-[10px] font-semibold text-[#555555]">
                        Brushes
                      </div>
                      <div className="p-1.5 grid grid-cols-2 gap-1">
                        {BRUSH_OPTIONS.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            data-testid={`brush-option-${b.id}`}
                            onClick={() => {
                              onToolSelect(b.id);
                              setActiveDropdown(null);
                            }}
                            className={`px-2 py-1.5 text-left border cursor-pointer flex items-center gap-1.5 ${
                              currentTool === b.id
                                ? 'bg-[#D8E8FA] border-[#7DA2CE] font-semibold'
                                : 'border-transparent hover:bg-[#E5F1FB]'
                            }`}
                            title={b.desc}
                          >
                            {b.id === 'blur' && (
                              <span
                                aria-hidden="true"
                                className="w-3 h-3 rounded-full bg-gradient-to-br from-[#60A5FA] to-[#1979CA] blur-[1px] shrink-0 inline-block"
                              />
                            )}
                            <span>{b.label}</span>
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-[#E0E1E2] p-1.5 bg-[#F8FAFC] flex flex-col gap-1">
                        <button
                          type="button"
                          data-testid="dropdown-gradient-brush-btn"
                          aria-pressed={isGradientBrush}
                          onClick={() => {
                            handleToggleGradientBrush();
                            setActiveDropdown(null);
                          }}
                          className={`w-full px-2 py-1.5 border flex items-center justify-between gap-2 text-left cursor-pointer ${
                            isGradientBrush
                              ? 'bg-[#D8E8FA] border-[#7DA2CE] font-semibold'
                              : 'border-[#DADBDC] bg-white hover:bg-[#E5F1FB]'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-5 h-3 border border-[#7A8494] shrink-0"
                              style={{ backgroundImage: gradientCss }}
                            />
                            <span className="text-[#1E1E1E]">Gradient Brush Mode</span>
                          </span>
                          <span className="text-[10px] font-semibold text-[#1979CA]">
                            {isGradientBrush ? 'ON' : 'OFF'}
                          </span>
                        </button>
                        <button
                          type="button"
                          data-testid="dropdown-pressure-toggle-btn"
                          aria-pressed={pressureSensitive}
                          onClick={() => {
                            onPressureSensitiveChange?.(!pressureSensitive);
                            setActiveDropdown(null);
                          }}
                          className={`w-full px-2 py-1.5 border flex items-center justify-between gap-2 text-left cursor-pointer ${
                            pressureSensitive
                              ? 'bg-[#D8E8FA] border-[#7DA2CE] font-semibold'
                              : 'border-[#DADBDC] bg-white hover:bg-[#E5F1FB]'
                          }`}
                        >
                          <span className="text-[#1E1E1E]">Pointer Pressure Sensitivity</span>
                          <span className="text-[10px] font-semibold text-[#1979CA]">
                            {pressureSensitive ? 'ON' : 'OFF'}
                          </span>
                        </button>
                        <div className="pt-1 border-t border-[#E0E1E2] flex items-center justify-between gap-1">
                          <span className="text-[10px] font-semibold text-[#555555] px-0.5">
                            Stamp Shape:
                          </span>
                          <div className="flex items-center gap-1">
                            {STAMP_SHAPES.map((st) => (
                              <button
                                key={st.id}
                                type="button"
                                data-testid={`dropdown-stamp-shape-${st.id}-btn`}
                                onClick={() => {
                                  onStampShapeChange?.(st.id);
                                  onToolSelect('stamp');
                                  setActiveDropdown(null);
                                }}
                                className={`px-1.5 py-0.5 border flex items-center gap-1 cursor-pointer ${
                                  currentTool === 'stamp' && stampShape === st.id
                                    ? 'bg-[#D8E8FA] border-[#7DA2CE] font-semibold'
                                    : 'border-[#DADBDC] bg-white hover:bg-[#E5F1FB]'
                                }`}
                              >
                                <svg className="w-3 h-3" viewBox="0 0 16 16">
                                  {renderStampMiniIcon(st.id)}
                                </svg>
                                <span>{st.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-[#666666] text-center leading-none pb-0.5">
                  Brushes
                </span>
              </div>

              {/* GROUP 5: SHAPES + OUTLINE & FILL */}
              <div className="flex flex-col justify-between h-full px-0.5 border-r border-[#E0E1E2] shrink-0">
                <div className="flex items-start gap-1 pt-0.5">
                  {/* Framed 7x2 Shapes Gallery Box with Scroll Arrows */}
                  <div className="flex items-stretch border border-[#C6C7C8] bg-white h-[54px]">
                    <div className="grid grid-cols-7 gap-0.5 p-0.5 content-start">
                      {visibleShapes.map((sh) => (
                        <button
                          key={sh.id}
                          type="button"
                          data-testid={`shape-${sh.id}-btn`}
                          onClick={() => {
                            onShapeSelect(sh.id);
                            onToolSelect('shape');
                          }}
                          className={`w-[18px] h-[18px] flex items-center justify-center border cursor-pointer ${
                            currentTool === 'shape' && currentShape === sh.id
                              ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                              : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                          }`}
                          title={sh.label}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16">
                            {renderShapeMiniIcon(sh.id)}
                          </svg>
                        </button>
                      ))}
                    </div>

                    {/* Right Micro Scrollbar inside Shapes Box matching Windows Paint */}
                    <div className="w-[13px] border-l border-[#DADBDC] bg-[#F5F6F7] flex flex-col justify-between">
                      <button
                        type="button"
                        onClick={() => setShapeRowOffset((r) => Math.max(0, r - 1))}
                        disabled={shapeRowOffset === 0}
                        className="h-[17px] flex items-center justify-center hover:bg-[#E5F1FB] disabled:opacity-35 text-[8px] cursor-pointer"
                        title="Previous shapes row"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => setShapeRowOffset((r) => Math.min(maxShapeRowOffset, r + 1))}
                        disabled={shapeRowOffset >= maxShapeRowOffset}
                        className="h-[17px] flex items-center justify-center hover:bg-[#E5F1FB] disabled:opacity-35 text-[8px] cursor-pointer border-y border-[#DADBDC]"
                        title="Next shapes row"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === 'shapes' ? null : 'shapes')}
                        className="h-[18px] flex items-center justify-center hover:bg-[#E5F1FB] text-[8px] cursor-pointer"
                        title="Show all shapes"
                      >
                        ▾
                      </button>
                    </div>
                  </div>

                  {activeDropdown === 'shapes' && (
                    <div className="fixed mt-[56px] z-50 w-56 bg-white border border-[#A0A0A0] shadow-md p-1.5 grid grid-cols-7 gap-1">
                      {PAINT_SHAPES.map((sh) => (
                        <button
                          key={sh.id}
                          type="button"
                          onClick={() => {
                            onShapeSelect(sh.id);
                            onToolSelect('shape');
                            setActiveDropdown(null);
                          }}
                          className={`w-6 h-6 flex items-center justify-center border cursor-pointer ${
                            currentTool === 'shape' && currentShape === sh.id
                              ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                              : 'border-transparent hover:bg-[#E5F1FB]'
                          }`}
                          title={sh.label}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 16 16">
                            {renderShapeMiniIcon(sh.id)}
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Outline & Fill Stacked Dropdowns */}
                  <div className="flex flex-col gap-1 pt-0.5">
                    <div className="relative">
                      <button
                        type="button"
                        data-testid="ribbon-outline-btn"
                        onClick={() => setActiveDropdown(activeDropdown === 'outline' ? null : 'outline')}
                        className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] border border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8] text-[#1E1E1E] cursor-pointer"
                        title="Shape outline style"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                          <path d="M3 12L11 4L13 6L5 14H3V12Z" fill="#FFF" stroke="#45505E" strokeWidth="1" />
                        </svg>
                        <span>
                          Outline <span className="text-[8px]">▾</span>
                        </span>
                      </button>

                      {activeDropdown === 'outline' && (
                        <div className="fixed mt-0.5 z-50 w-36 bg-white border border-[#A0A0A0] shadow-md py-1 text-[11px]">
                          {STYLE_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                onOutlineStyleChange(opt.id);
                                setActiveDropdown(null);
                              }}
                              className={`w-full px-2.5 py-1 text-left flex items-center justify-between hover:bg-[#E5F1FB] cursor-pointer ${
                                outlineStyle === opt.id ? 'font-semibold bg-[#E5F1FB]' : ''
                              }`}
                            >
                              <span>{opt.label}</span>
                              {outlineStyle === opt.id && <Check className="w-3 h-3 text-[#1979CA]" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        data-testid="ribbon-fill-btn"
                        onClick={() => setActiveDropdown(activeDropdown === 'fill' ? null : 'fill')}
                        className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] border border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8] text-[#1E1E1E] cursor-pointer"
                        title="Shape fill style (uses Color 2)"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                          <rect x="2.5" y="3.5" width="9" height="9" fill="#DDE9F9" stroke="#1979CA" strokeWidth="1" />
                        </svg>
                        <span>
                          Fill <span className="text-[8px]">▾</span>
                        </span>
                      </button>

                      {activeDropdown === 'fill' && (
                        <div className="fixed mt-0.5 z-50 w-36 bg-white border border-[#A0A0A0] shadow-md py-1 text-[11px]">
                          {STYLE_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                onFillStyleChange(opt.id as ShapeFillStyle);
                                setActiveDropdown(null);
                              }}
                              className={`w-full px-2.5 py-1 text-left flex items-center justify-between hover:bg-[#E5F1FB] cursor-pointer ${
                                fillStyle === opt.id ? 'font-semibold bg-[#E5F1FB]' : ''
                              }`}
                            >
                              <span>{opt.label === 'No outline' ? 'No fill' : opt.label}</span>
                              {fillStyle === opt.id && <Check className="w-3 h-3 text-[#1979CA]" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Shapes Popup Button */}
                  <div className="relative pl-0.5 border-l border-[#E0E1E2]">
                    <button
                      type="button"
                      data-testid="ribbon-quick-shapes-btn"
                      aria-expanded={activeDropdown === 'quickShapes'}
                      aria-haspopup="menu"
                      onClick={() =>
                        setActiveDropdown(activeDropdown === 'quickShapes' ? null : 'quickShapes')
                      }
                      className={`flex flex-col items-center px-1 py-0.5 border cursor-pointer min-w-[40px] ${
                        activeDropdown === 'quickShapes' || isQuickShapeSelected
                          ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                          : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                      }`}
                      title="Quick Shapes (Hearts, stars & speech bubbles)"
                    >
                      <svg className="w-6 h-6 mt-0.5" viewBox="0 0 24 24" fill="none">
                        {/* Heart */}
                        <path
                          d="M7.2 11.5 C7.2 11.5 2.8 8.5 2.8 5.7 C2.8 4.2 4 3.1 5.3 3.1 C6.2 3.1 6.9 3.7 7.2 4.4 C7.5 3.7 8.2 3.1 9.1 3.1 C10.4 3.1 11.6 4.2 11.6 5.7 C11.6 8.5 7.2 11.5 7.2 11.5 Z"
                          fill="#F9C6D1"
                          stroke="#B83354"
                          strokeWidth="1.1"
                        />
                        {/* 5-Point Star */}
                        <polygon
                          points="17.5,2.5 18.7,5.4 21.8,5.6 19.4,7.6 20.2,10.7 17.5,9 14.8,10.7 15.6,7.6 13.2,5.6 16.3,5.4"
                          fill="#FFE588"
                          stroke="#9E7312"
                          strokeWidth="1"
                        />
                        {/* Speech Bubble */}
                        <path
                          d="M7 14.5 A1.5 1.5 0 0 1 8.5 13 H18.5 A1.5 1.5 0 0 1 20 14.5 V19 A1.5 1.5 0 0 1 18.5 20.5 H12.5 L9.8 22.8 V20.5 H8.5 A1.5 1.5 0 0 1 7 19 Z"
                          fill="#DDE9F9"
                          stroke="#2D5A9E"
                          strokeWidth="1.1"
                        />
                      </svg>
                      <span className="text-[10.5px] leading-[1.05] mt-0.5 text-center">
                        Quick<br />Shapes <span className="text-[8px]">▾</span>
                      </span>
                    </button>

                    {activeDropdown === 'quickShapes' && (
                      <div
                        data-testid="quick-shapes-popup"
                        role="menu"
                        aria-label="Quick Shapes"
                        className="fixed mt-0.5 z-50 w-[264px] bg-white border border-[#A0A0A0] shadow-md p-1.5"
                      >
                        <div className="text-[11px] font-semibold text-[#333] px-1 pb-1 mb-1 border-b border-[#E0E1E2] flex items-center justify-between">
                          <span>Quick Shapes</span>
                          <span className="text-[10px] font-normal text-[#666]">Custom</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {QUICK_SHAPES.map((sh) => {
                            const selected = currentTool === 'shape' && currentShape === sh.id;
                            return (
                              <button
                                key={sh.id}
                                type="button"
                                role="menuitem"
                                data-testid={`quick-shape-${sh.id}-btn`}
                                onClick={() => {
                                  onShapeSelect(sh.id);
                                  onToolSelect('shape');
                                  setActiveDropdown(null);
                                }}
                                className={`flex flex-col items-center justify-center px-1 py-1.5 border cursor-pointer ${
                                  selected
                                    ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                                    : 'border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8]'
                                }`}
                                title={sh.label}
                              >
                                <svg className="w-5 h-5" viewBox="0 0 16 16">
                                  {renderShapeMiniIcon(sh.id)}
                                </svg>
                                <span className="text-[10px] leading-tight mt-0.5 text-[#1E1E1E] text-center truncate w-full">
                                  {sh.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-[#666666] text-center leading-none pb-0.5">
                  Shapes
                </span>
              </div>

              {/* GROUP 6: SIZE */}
              <div className="flex flex-col justify-between h-full px-0.5 border-r border-[#E0E1E2] shrink-0 relative">
                <div className="pt-0.5">
                  <button
                    type="button"
                    data-testid="ribbon-size-btn"
                    onClick={() => setActiveDropdown(activeDropdown === 'size' ? null : 'size')}
                    className="flex flex-col items-center px-0.5 py-0.5 border border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8] cursor-pointer"
                    title={`Stroke size: ${currentSize}px ([ / ])`}
                  >
                    <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
                      <line x1="3" y1="6" x2="25" y2="6" stroke="#1E304B" strokeWidth="1" />
                      <line x1="3" y1="11" x2="25" y2="11" stroke="#1E304B" strokeWidth="2" />
                      <line x1="3" y1="17" x2="25" y2="17" stroke="#1E304B" strokeWidth="3.2" />
                      <line x1="3" y1="23.5" x2="25" y2="23.5" stroke="#1E304B" strokeWidth="4.5" />
                    </svg>
                    <span className="text-[11px] leading-tight mt-0.5 flex items-center gap-0.5">
                      Size <span className="text-[8px]">▾</span>
                    </span>
                  </button>

                  {activeDropdown === 'size' && (
                    <div className="fixed mt-0.5 z-50 w-44 bg-white border border-[#A0A0A0] shadow-md p-1.5 flex flex-col gap-1 text-[11px]">
                      {[1, 3, 5, 8, 14, 24].map((px) => (
                        <button
                          key={px}
                          type="button"
                          onClick={() => {
                            onSizeChange(px);
                            setActiveDropdown(null);
                          }}
                          className={`px-2 py-1.5 flex items-center justify-between border cursor-pointer ${
                            currentSize === px
                              ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                              : 'border-transparent hover:bg-[#E5F1FB]'
                          }`}
                        >
                          <div className="flex-1 mr-2 flex items-center">
                            <span
                              className="w-full bg-[#1E1E1E] block"
                              style={{ height: `${Math.min(10, Math.max(1, px / 2))}px` }}
                            />
                          </div>
                          <span className="w-8 text-right tabular-nums">{px}px</span>
                        </button>
                      ))}
                      <div className="pt-1 border-t border-[#E0E1E2] flex items-center gap-2">
                        <input
                          type="range"
                          min="1"
                          max="50"
                          value={currentSize}
                          onChange={(e) => onSizeChange(parseInt(e.target.value, 10))}
                          className="flex-1 accent-[#1979CA] cursor-pointer"
                        />
                        <span className="tabular-nums font-medium">{currentSize}px</span>
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-[#666666] text-center leading-none pb-0.5">
                  Size
                </span>
              </div>

              {/* GROUP 7: COLORS (Color 1, Color 2, 10x3 Palette Grid, Edit colors) */}
              <div className="flex flex-col justify-between h-full px-0.5 border-r border-[#E0E1E2] shrink-0">
                <div className="flex items-start gap-0.5 pt-0.5">
                  {/* Color 1 box */}
                  <button
                    type="button"
                    data-testid="color1-slot-btn"
                    onClick={() => setActiveColorSlot(1)}
                    className={`flex flex-col items-center px-0.5 py-0.5 border cursor-pointer ${
                      activeColorSlot === 1
                        ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                        : 'border-transparent hover:bg-[#E5F1FB]'
                    }`}
                    title="Color 1 (Foreground color)"
                  >
                    <span className="p-[2px] bg-white border border-[#8E8E8E] block">
                      <span
                        className="w-[20px] h-[20px] block"
                        style={{ backgroundColor: currentColor }}
                      />
                    </span>
                    <span className="text-[10.5px] leading-[1.1] mt-0.5 text-center">
                      Color{' '}
                      <br />
                      1
                    </span>
                  </button>

                  {/* Color 2 box */}
                  <button
                    type="button"
                    data-testid="color2-slot-btn"
                    onClick={() => setActiveColorSlot(2)}
                    className={`flex flex-col items-center px-0.5 py-0.5 border cursor-pointer ${
                      activeColorSlot === 2
                        ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                        : 'border-transparent hover:bg-[#E5F1FB]'
                    }`}
                    title="Color 2 (Background / shape fill color)"
                  >
                    <span className="p-[2px] bg-white border border-[#8E8E8E] block mt-0.5">
                      <span
                        className="w-[15px] h-[15px] block border border-[#D4D4D4]"
                        style={{ backgroundColor: secondaryColor }}
                      />
                    </span>
                    <span className="text-[10.5px] leading-[1.1] mt-1 text-center">
                      Color<br />2
                    </span>
                  </button>

                  {/* 10x3 Swatch Grid matching screenshot */}
                  <div className="grid grid-cols-10 gap-[2px] pt-0.5">
                    {WINDOWS_PAINT_PALETTE.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => handlePaletteSwatchClick(hex)}
                        className="w-[14px] h-[14px] p-[1px] bg-white border border-[#A0A0A0] hover:border-[#1979CA] cursor-pointer"
                        title={hex}
                        aria-label={`Color ${hex}`}
                      >
                        <span className="w-full h-full block" style={{ backgroundColor: hex }} />
                      </button>
                    ))}
                    {customRow.map((hex, i) => (
                      <button
                        key={`custom_${i}`}
                        type="button"
                        data-testid={`custom-color-slot-${i}`}
                        onClick={() => hex && handlePaletteSwatchClick(hex)}
                        className={`w-[14px] h-[14px] p-[1px] bg-white border border-[#C6C7C8] ${
                          hex ? 'hover:border-[#1979CA] cursor-pointer' : 'cursor-default'
                        }`}
                        title={hex ? `Custom color ${hex}` : 'Empty custom color slot'}
                        aria-label={hex ? `Custom color ${hex}` : 'Empty custom color slot'}
                      >
                        <span
                          className="w-full h-full block"
                          style={{ backgroundColor: hex || '#FFFFFF' }}
                        />
                      </button>
                    ))}
                  </div>

                  {/* Edit colors rainbow icon */}
                  <button
                    type="button"
                    data-testid="edit-colors-btn"
                    onClick={onEditColors}
                    className="flex flex-col items-center px-0.5 py-0.5 border border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8] cursor-pointer"
                    title="Edit colors & Generate Custom Palette from Image"
                  >
                    <span
                      className="w-6 h-6 border border-[#777] block"
                      style={{
                        background:
                          'linear-gradient(90deg, #ED1C24, #FFF200, #22B14C, #00A2E8, #3F48CC, #A349A4)',
                      }}
                    />
                    <span className="text-[10.5px] leading-[1.1] mt-1 text-center">
                      Edit{' '}
                      <br />
                      colors
                    </span>
                  </button>
                </div>
                <span className="text-[11px] text-[#666666] text-center leading-none pb-0.5">
                  Colors
                </span>
              </div>

              {/* GROUP 8: PAINT BOOKS (Pixora Stencil Gallery slot in Paint 3D position) */}
              <div className="flex flex-col justify-between h-full px-0.5 shrink-0">
                <div className="pt-0.5 flex items-center justify-center">
                  <button
                    type="button"
                    data-testid="ribbon-paint-books-btn"
                    onClick={onOpenTemplates}
                    className="flex flex-col items-center px-1 py-0.5 border border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8] cursor-pointer"
                    title="Open Pixora Paint Book Gallery & Tracing Templates"
                  >
                    <BookOpen className="w-6 h-6 text-[#1979CA] mt-0.5" />
                    <span className="text-[10.5px] leading-[1.1] mt-1 text-center">
                      Paint{' '}
                      <br />
                      Books
                    </span>
                  </button>
                </div>
                <span className="text-[11px] text-[#666666] text-center leading-none pb-0.5">
                  Templates
                </span>
              </div>

              {/* GROUP 9: SHARE */}
              {onShare && (
                <div
                  data-testid="ribbon-share-group"
                  className="flex flex-col justify-between h-full px-1 border-l border-[#E0E1E2] shrink-0"
                >
                  <div className="pt-0.5 flex items-center justify-center">
                    <button
                      type="button"
                      data-testid="ribbon-toolbar-share-btn"
                      disabled={isSharing}
                      onClick={onShare}
                      className="flex flex-col items-center px-1.5 py-0.5 border border-transparent hover:bg-[#E5F1FB] hover:border-[#A0C5E8] cursor-pointer disabled:opacity-60"
                      title="Share canvas image or session link (Web Share API)"
                    >
                      <Share2 className="w-6 h-6 text-[#1979CA] mt-0.5" />
                      <span className="text-[10.5px] leading-[1.1] mt-1 text-center font-medium">
                        Share
                      </span>
                    </button>
                  </div>
                  <span className="text-[11px] text-[#666666] text-center leading-none pb-0.5">
                    Share
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
