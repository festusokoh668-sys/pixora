/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  HardDrive,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';

export type ProjectSyncStatus =
  | 'Local Only'
  | 'Waiting to Sync'
  | 'Syncing'
  | 'Syncing...'
  | 'Saved to Cloud'
  | 'Save Failed'
  | 'Sync Failed'
  | 'local_only'
  | 'waiting_to_sync'
  | 'syncing'
  | 'saved_to_cloud'
  | 'synced'
  | 'sync_failed'
  | 'saved'
  | 'unsaved'
  | 'saving'
  | 'offline';

export type DisplaySyncStatus =
  | 'Local Only'
  | 'Waiting to Sync'
  | 'Syncing'
  | 'Saved to Cloud'
  | 'Save Failed';

interface PaintStatusBarProps {
  canvasDimensions: { width: number; height: number };
  cursorPosition?: { x: number; y: number } | null;
  selectionSize?: { width: number; height: number } | null;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (zoom: number) => void;
  onResetZoom?: () => void;
  syncStatus?: ProjectSyncStatus;
  cloudStatus?: ProjectSyncStatus; // backward compatibility
  onCloudClick?: () => void;
  onSyncClick?: () => void;
}

export function normalizeSyncStatus(raw?: ProjectSyncStatus): DisplaySyncStatus {
  if (!raw) return 'Local Only';
  switch (raw) {
    case 'saved_to_cloud':
    case 'synced':
    case 'Saved to Cloud':
    case 'saved':
      return 'Saved to Cloud';
    case 'syncing':
    case 'Syncing':
    case 'Syncing...':
    case 'saving':
      return 'Syncing';
    case 'sync_failed':
    case 'Save Failed':
    case 'Sync Failed':
      return 'Save Failed';
    case 'waiting_to_sync':
    case 'Waiting to Sync':
      return 'Waiting to Sync';
    case 'local_only':
    case 'Local Only':
    case 'unsaved':
    case 'offline':
    default:
      return 'Local Only';
  }
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
  syncStatus,
  cloudStatus,
  onCloudClick,
  onSyncClick,
}) => {
  const zoomPercent = Math.round(zoomLevel * 100);
  const currentSyncStatus = normalizeSyncStatus(syncStatus || cloudStatus);

  const getStatusConfig = (status: DisplaySyncStatus) => {
    switch (status) {
      case 'Saved to Cloud':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
          textClass: 'text-emerald-700 dark:text-emerald-300 font-semibold',
          badgeClass: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40',
          tooltip: 'Project is synchronized with Cloud Firestore. Click to save or view cloud status.',
        };
      case 'Syncing':
        return {
          icon: <Loader2 className="w-3.5 h-3.5 text-[#0078D7] dark:text-[#60A5FA] animate-spin shrink-0" />,
          textClass: 'text-[#0078D7] dark:text-[#60A5FA] font-medium',
          badgeClass: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40',
          tooltip: 'Synchronizing drawing data to Cloud Firestore...',
        };
      case 'Waiting to Sync':
        return {
          icon: <Clock className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />,
          textClass: 'text-violet-700 dark:text-violet-300 font-medium',
          badgeClass: 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/40',
          tooltip: 'Saved locally. Pending synchronization to Cloud Firestore.',
        };
      case 'Save Failed':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />,
          textClass: 'text-red-700 dark:text-red-300 font-semibold',
          badgeClass: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40',
          tooltip: 'Cloud save failed. Click to inspect error or retry.',
        };
      case 'Local Only':
      default:
        return {
          icon: <HardDrive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />,
          textClass: 'text-amber-700 dark:text-amber-300 font-medium',
          badgeClass: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40',
          tooltip: 'Stored locally in browser IndexedDB. Click to save.',
        };
    }
  };

  const statusConfig = getStatusConfig(currentSyncStatus);
  const handleAction = onSyncClick || onCloudClick;

  return (
    <footer
      data-testid="paint-status-bar"
      className="bg-[#F0F0F0] dark:bg-[#1E232D] border-t border-[#DADBDC] dark:border-[#2D333B] h-[24px] px-1.5 flex items-center justify-between text-[11px] text-[#1E1E1E] dark:text-[#E2E8F0] select-none shrink-0 font-sans"
    >
      {/* Left Segmented Telemetry Strip */}
      <div className="flex items-center h-full min-w-0">
        {/* Pointer Coordinates */}
        <div className="flex items-center gap-1.5 w-[96px] sm:w-[130px] h-[16px] pr-2 border-r border-[#D6D6D6] dark:border-[#374151] shrink-0">
          <svg className="w-3.5 h-3.5 text-[#555555] dark:text-[#94A3B8] shrink-0" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="8" cy="8" r="1.2" fill="currentColor" />
          </svg>
          <span data-testid="status-cursor-pos" className="truncate tabular-nums">
            {cursorPosition ? `${Math.round(cursorPosition.x)}, ${Math.round(cursorPosition.y)}px` : ''}
          </span>
        </div>

        {/* Selection / Shape Box Size */}
        <div className="hidden sm:flex items-center gap-1.5 w-[112px] sm:w-[130px] h-[16px] px-2 border-r border-[#D6D6D6] dark:border-[#374151] shrink-0">
          <svg className="w-3.5 h-3.5 text-[#555555] dark:text-[#94A3B8] shrink-0" viewBox="0 0 16 16" fill="none">
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
        <div className="flex items-center gap-1.5 h-[16px] px-2 border-r border-[#D6D6D6] dark:border-[#374151] shrink-0">
          <svg className="w-3.5 h-3.5 text-[#555555] dark:text-[#94A3B8] shrink-0" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="10" height="10" stroke="currentColor" strokeWidth="1.1" />
            <rect x="11" y="11" width="3" height="3" fill="#FFFFFF" stroke="#1E1E1E" strokeWidth="1" />
          </svg>
          <span data-testid="status-canvas-dims" className="truncate tabular-nums">
            {canvasDimensions.width} × {canvasDimensions.height}px
          </span>
        </div>

        {/* Visual Synchronization Status Indicator */}
        <button
          type="button"
          onClick={handleAction}
          data-testid="status-sync-indicator"
          data-sync-status={currentSyncStatus}
          className={`flex items-center gap-1.5 h-[18px] px-2 ml-1.5 rounded-xs border cursor-pointer transition-colors active:scale-98 shrink-0 ${statusConfig.badgeClass}`}
          title={statusConfig.tooltip}
          aria-label={`Project sync status: ${currentSyncStatus}. ${statusConfig.tooltip}`}
        >
          {statusConfig.icon}
          <span className={`text-[10.5px] tabular-nums whitespace-nowrap ${statusConfig.textClass}`}>
            {currentSyncStatus}
          </span>
        </button>
      </div>

      {/* Right Zoom Readout & Slider */}
      <div className="flex items-center gap-1.5 shrink-0 pl-2">
        <button
          type="button"
          onClick={onResetZoom}
          className="px-1 hover:bg-[#E5F1FB] dark:hover:bg-[#2D333B] text-[#1E1E1E] dark:text-[#E2E8F0] tabular-nums cursor-pointer"
          title="Reset to 100%"
        >
          <span data-testid="status-zoom-percent">{zoomPercent}%</span>
        </button>

        <button
          type="button"
          data-testid="status-zoom-out"
          onClick={onZoomOut}
          className="w-4 h-4 rounded-full border border-[#8E8E8E] dark:border-[#4B5563] bg-white dark:bg-[#252C37] hover:bg-[#E5F1FB] dark:hover:bg-[#374151] hover:border-[#0078D7] flex items-center justify-center text-[#1E1E1E] dark:text-[#E2E8F0] cursor-pointer leading-none text-[12px]"
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
            className="w-full h-[3px] accent-[#0078D7] cursor-pointer bg-[#B8B8B8] dark:bg-[#4B5563]"
            aria-label="Zoom level"
          />
        </div>

        <button
          type="button"
          data-testid="status-zoom-in"
          onClick={onZoomIn}
          className="w-4 h-4 rounded-full border border-[#8E8E8E] dark:border-[#4B5563] bg-white dark:bg-[#252C37] hover:bg-[#E5F1FB] dark:hover:bg-[#374151] hover:border-[#0078D7] flex items-center justify-center text-[#1E1E1E] dark:text-[#E2E8F0] cursor-pointer leading-none text-[12px]"
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </footer>
  );
};
