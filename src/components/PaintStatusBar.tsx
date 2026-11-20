import React from 'react';

interface PaintStatusBarProps {
  canvasDimensions: { width: number; height: number };
  cursorPosition?: { x: number; y: number } | null;
  selectionSize?: { width: number; height: number } | null;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (zoom: number) => void;
  onResetZoom?: () => void;
}

export const PaintStatusBar: React.FC<PaintStatusBarProps> = ({
  canvasDimensions,
  cursorPosition,
  selectionSize,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onZoomChange,
  onResetZoom,
}) => {
  const zoomPercent = Math.round(zoomLevel * 100);

  return (
    <footer
      data-testid="paint-status-bar"
      className="bg-[#F0F0F0] border-t border-[#DADBDC] h-[24px] px-1.5 flex items-center justify-between text-[11px] text-[#1E1E1E] select-none shrink-0 font-sans"
    >
      {/* Left Segmented Telemetry Strip matching Windows Paint */}
      <div className="flex items-center h-full min-w-0">
        {/* Pointer Coordinates */}
        <div className="flex items-center gap-1.5 w-[108px] sm:w-[136px] h-[16px] pr-2 border-r border-[#D6D6D6] shrink-0">
          <svg className="w-3.5 h-3.5 text-[#555555] shrink-0" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="8" cy="8" r="1.2" fill="currentColor" />
          </svg>
          <span data-testid="status-cursor-pos" className="truncate tabular-nums">
            {cursorPosition ? `${Math.round(cursorPosition.x)}, ${Math.round(cursorPosition.y)}px` : ''}
          </span>
        </div>

        {/* Selection / Shape Box Size */}
        <div className="hidden sm:flex items-center gap-1.5 w-[112px] sm:w-[136px] h-[16px] px-2 border-r border-[#D6D6D6] shrink-0">
          <svg className="w-3.5 h-3.5 text-[#555555] shrink-0" viewBox="0 0 16 16" fill="none">
            <rect
              x="2.5"
              y="2.5"
              width="9"
              height="9"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeDasharray="2 1.5"
            />
            <path d="M12.5 10v4M10.5 12h4" stroke="#1979CA" strokeWidth="1.2" />
          </svg>
          <span data-testid="status-selection-size" className="truncate tabular-nums">
            {selectionSize
              ? `${Math.round(selectionSize.width)} × ${Math.round(selectionSize.height)}px`
              : ''}
          </span>
        </div>

        {/* Canvas Dimensions */}
        <div className="flex items-center gap-1.5 h-[16px] px-2 sm:border-r border-[#D6D6D6] min-w-0">
          <svg className="w-3.5 h-3.5 text-[#555555] shrink-0" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="10" height="10" stroke="currentColor" strokeWidth="1.1" />
            <rect x="11" y="11" width="3" height="3" fill="#FFFFFF" stroke="#1E1E1E" strokeWidth="1" />
          </svg>
          <span data-testid="status-canvas-dims" className="truncate tabular-nums">
            {canvasDimensions.width} × {canvasDimensions.height}px
          </span>
        </div>
      </div>

      {/* Right Zoom Readout & Slider */}
      <div className="flex items-center gap-1.5 shrink-0 pl-2">
        <button
          type="button"
          onClick={onResetZoom}
          className="px-1 hover:bg-[#E5F1FB] text-[#1E1E1E] tabular-nums cursor-pointer"
          title="Reset to 100%"
        >
          <span data-testid="status-zoom-percent">{zoomPercent}%</span>
        </button>

        <button
          type="button"
          data-testid="status-zoom-out"
          onClick={onZoomOut}
          className="w-4 h-4 rounded-full border border-[#8E8E8E] bg-white hover:bg-[#E5F1FB] hover:border-[#0078D7] flex items-center justify-center text-[#1E1E1E] cursor-pointer leading-none text-[12px]"
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>

        <div className="relative flex items-center w-[76px] sm:w-[100px]">
          <input
            type="range"
            data-testid="status-zoom-slider"
            min="0.25"
            max="4.0"
            step="0.05"
            value={zoomLevel}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
            className="w-full h-[3px] accent-[#0078D7] cursor-pointer bg-[#B8B8B8]"
            aria-label="Zoom level"
          />
        </div>

        <button
          type="button"
          data-testid="status-zoom-in"
          onClick={onZoomIn}
          className="w-4 h-4 rounded-full border border-[#8E8E8E] bg-white hover:bg-[#E5F1FB] hover:border-[#0078D7] flex items-center justify-center text-[#1E1E1E] cursor-pointer leading-none text-[12px]"
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </footer>
  );
};
