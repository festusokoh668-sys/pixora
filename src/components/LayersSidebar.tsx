import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Layers,
  PanelRightClose,
  Plus,
  Trash2,
} from 'lucide-react';
import { CanvasLayer, Stroke } from '../types';
import {
  canMoveLayerDown,
  canMoveLayerUp,
  getLayersDisplayOrder,
  groupStrokesByLayer,
} from '../utils/layers';
import { renderStrokeToContext } from '../utils/drawing';
import { applyLayerFilterToContext } from '../utils/filters';

interface LayerThumbnailProps {
  strokes: Stroke[];
  canvasDimensions: { width: number; height: number };
  visible: boolean;
}

const LayerThumbnail: React.FC<LayerThumbnailProps> = ({
  strokes,
  canvasDimensions,
  visible,
}) => {
  const thumbRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const el = thumbRef.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    const tw = el.width;
    const th = el.height;
    ctx.clearRect(0, 0, tw, th);

    if (strokes.length === 0) return;

    const cw = Math.max(1, canvasDimensions.width);
    const ch = Math.max(1, canvasDimensions.height);
    const scale = Math.min(tw / cw, th / ch);
    const ox = (tw - cw * scale) / 2;
    const oy = (th - ch * scale) / 2;

    const hasEnabledFilter = strokes.some(
      (s) => s.operation === 'layer-filter' && s.filterEnabled !== false && Boolean(s.filterType)
    );

    if (!hasEnabledFilter) {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);
      for (const s of strokes) {
        if (s.operation === 'layer-filter') continue;
        renderStrokeToContext(ctx, s, 'canvas');
      }
      ctx.restore();
      return;
    }

    const work = document.createElement('canvas');
    work.width = tw;
    work.height = th;
    const wctx = work.getContext('2d', { willReadFrequently: true });
    if (!wctx) return;

    const scratch = document.createElement('canvas');
    scratch.width = tw;
    scratch.height = th;
    const sctx = scratch.getContext('2d', { willReadFrequently: true });

    for (const s of strokes) {
      if (s.operation === 'layer-filter') {
        if (s.filterEnabled !== false && s.filterType && sctx) {
          sctx.clearRect(0, 0, tw, th);
          sctx.drawImage(work, 0, 0);
          applyLayerFilterToContext(wctx, scratch, tw, th, s.filterType, {
            brightnessDelta: s.filterBrightnessDelta,
            opaquePaperBackground: s.filterOpaquePaperBackground,
          });
        }
        continue;
      }
      wctx.save();
      wctx.translate(ox, oy);
      wctx.scale(scale, scale);
      renderStrokeToContext(wctx, s, 'canvas');
      wctx.restore();
    }

    ctx.drawImage(work, 0, 0);
  }, [strokes, canvasDimensions.width, canvasDimensions.height]);

  return (
    <div
      className={`w-10 h-7 shrink-0 border border-[#B8BDC4] overflow-hidden relative ${
        visible ? 'opacity-100' : 'opacity-45'
      }`}
      style={{
        backgroundImage:
          'linear-gradient(45deg, #E2E6EC 25%, transparent 25%), linear-gradient(-45deg, #E2E6EC 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #E2E6EC 75%), linear-gradient(-45deg, transparent 75%, #E2E6EC 75%)',
        backgroundSize: '8px 8px',
        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
        backgroundColor: '#FFFFFF',
      }}
    >
      <canvas ref={thumbRef} width={40} height={28} className="w-full h-full block" />
    </div>
  );
};

interface LayersSidebarProps {
  layers: CanvasLayer[];
  activeLayerId: string;
  strokes: Stroke[];
  canvasDimensions: { width: number; height: number };
  onSelectLayer: (layerId: string) => void;
  onAddLayer: () => void;
  onToggleVisibility: (layerId: string) => void;
  onMoveLayer: (layerId: string, direction: 'up' | 'down') => void;
  onReorderLayer: (draggedLayerId: string, targetLayerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, nextName: string) => void;
  onLayerOpacityChange: (layerId: string, opacity: number) => void;
  onCloseSidebar: () => void;
}

export const LayersSidebar: React.FC<LayersSidebarProps> = ({
  layers,
  activeLayerId,
  strokes,
  canvasDimensions,
  onSelectLayer,
  onAddLayer,
  onToggleVisibility,
  onMoveLayer,
  onReorderLayer,
  onDeleteLayer,
  onRenameLayer,
  onLayerOpacityChange,
  onCloseSidebar,
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  const displayLayers = useMemo(() => getLayersDisplayOrder(layers), [layers]);
  const strokesByLayer = useMemo(
    () => groupStrokesByLayer(strokes, layers),
    [strokes, layers]
  );
  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeLayerId) ?? layers[layers.length - 1],
    [layers, activeLayerId]
  );

  const commitRename = () => {
    if (editingLayerId) {
      onRenameLayer(editingLayerId, editingName);
      setEditingLayerId(null);
      setEditingName('');
    }
  };

  return (
    <aside
      data-testid="layers-sidebar"
      aria-label="Layers panel"
      className="absolute inset-y-0 right-0 z-40 w-[min(276px,82vw)] shadow-xl md:static md:z-20 md:w-[244px] md:shadow-none shrink-0 h-full bg-[#F5F6F7] border-l border-[#C6C7C8] flex flex-col select-none text-[#1E1E1E]"
    >
      {/* Sidebar Header */}
      <div className="h-[36px] md:h-[34px] px-2.5 bg-[#ECEEF1] border-b border-[#DADBDC] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers className="w-4 h-4 text-[#1979CA] shrink-0" />
          <span className="text-[12px] font-semibold tracking-tight text-[#1E1E1E]">
            Layers
          </span>
          <span
            data-testid="layers-count-badge"
            className="px-1.5 py-0.5 text-[10px] font-medium bg-white border border-[#DADBDC] text-[#555555] leading-none tabular-nums"
          >
            {layers.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="add-layer-btn"
            onClick={onAddLayer}
            className="h-[26px] md:h-[24px] px-2 flex items-center gap-1 bg-white hover:bg-[#E5F1FB] border border-[#B8BDC4] hover:border-[#7DA2CE] text-[11px] font-medium text-[#1E1E1E] cursor-pointer"
            title="Add new transparent layer above active layer"
            aria-label="Add new transparent layer"
          >
            <Plus className="w-3.5 h-3.5 text-[#1979CA]" />
            <span>New</span>
          </button>
          <button
            type="button"
            data-testid="close-layers-sidebar-btn"
            onClick={onCloseSidebar}
            className="h-[26px] md:h-[24px] px-1.5 flex items-center gap-1 bg-white/80 hover:bg-[#E5F1FB] border border-[#C6C7C8] hover:border-[#7DA2CE] text-[11px] font-medium text-[#333333] cursor-pointer"
            title="Hide Layers panel"
            aria-label="Hide Layers panel"
          >
            <PanelRightClose className="w-3.5 h-3.5 text-[#555555]" />
            <span>Hide</span>
          </button>
        </div>
      </div>

      {/* Top-to-Bottom Z-Order Layer List */}
      <div
        data-testid="layers-list"
        className="flex-1 min-h-0 overflow-y-auto p-1.5 flex flex-col gap-1 bg-[#F9FAFB]"
      >
        {displayLayers.map((layer) => {
          const isActive = layer.id === activeLayerId;
          const layerStrokes = strokesByLayer.get(layer.id) || [];
          const canUp = canMoveLayerUp(layers, layer.id);
          const canDown = canMoveLayerDown(layers, layer.id);
          const isDragTarget = dragOverId === layer.id && draggingId !== layer.id;

          return (
            <div
              key={layer.id}
              data-testid={`layer-item-${layer.id}`}
              data-layer-id={layer.id}
              draggable={editingLayerId !== layer.id}
              onDragStart={(e) => {
                setDraggingId(layer.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', layer.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggingId && draggingId !== layer.id) {
                  setDragOverId(layer.id);
                }
              }}
              onDragLeave={() => {
                if (dragOverId === layer.id) setDragOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const sourceId = draggingId || e.dataTransfer.getData('text/plain');
                if (sourceId && sourceId !== layer.id) {
                  onReorderLayer(sourceId, layer.id);
                }
                setDraggingId(null);
                setDragOverId(null);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDragOverId(null);
              }}
              className={`group flex items-center gap-1.5 px-1.5 py-1.5 border transition-colors ${
                isDragTarget ? 'border-t-2 border-t-[#1979CA]' : ''
              } ${
                isActive
                  ? 'bg-[#D8E8FA] border-[#7DA2CE]'
                  : 'bg-white border-[#DADBDC] hover:bg-[#EEF5FC] hover:border-[#A0C5E8]'
              } ${draggingId === layer.id ? 'opacity-60' : ''}`}
            >
              {/* Visibility Toggle */}
              <button
                type="button"
                data-testid={`layer-visibility-btn-${layer.id}`}
                onClick={() => onToggleVisibility(layer.id)}
                aria-pressed={layer.visible}
                aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                title={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                className={`w-[28px] h-[28px] md:w-[24px] md:h-[24px] shrink-0 flex items-center justify-center border cursor-pointer ${
                  layer.visible
                    ? 'bg-white/80 border-[#C6C7C8] text-[#1979CA] hover:bg-white'
                    : 'bg-[#ECEEF1] border-[#DADBDC] text-[#8A929E] hover:text-[#333]'
                }`}
              >
                {layer.visible ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Layer Select / Rename Area */}
              {editingLayerId === layer.id ? (
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitRename();
                      } else if (e.key === 'Escape') {
                        setEditingLayerId(null);
                      }
                    }}
                    autoFocus
                    maxLength={32}
                    aria-label={`Rename ${layer.name}`}
                    className="w-full px-1 py-0.5 text-[11px] bg-white border border-[#1979CA] outline-none"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  data-testid={`layer-select-btn-${layer.id}`}
                  onClick={() => onSelectLayer(layer.id)}
                  onDoubleClick={() => {
                    setEditingLayerId(layer.id);
                    setEditingName(layer.name);
                  }}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={`Select ${layer.name}`}
                  title={`${layer.name} — Click to draw on this layer, double-click to rename`}
                  className="flex-1 min-w-0 flex items-center gap-1.5 text-left cursor-pointer"
                >
                  <LayerThumbnail
                    strokes={layerStrokes}
                    canvasDimensions={canvasDimensions}
                    visible={layer.visible}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-[11.5px] leading-tight truncate ${
                        isActive ? 'font-semibold text-[#0F2C4C]' : 'font-medium text-[#1E1E1E]'
                      } ${!layer.visible ? 'line-through text-[#6E7681]' : ''}`}
                    >
                      {layer.name}
                    </div>
                    <div className="text-[10px] text-[#5F6874] leading-tight mt-0.5 tabular-nums truncate">
                      {(() => {
                        if (!layer.visible) return 'Hidden';
                        const drawableCount = layerStrokes.filter(
                          (s) => s.operation !== 'layer-filter'
                        ).length;
                        return `${drawableCount} ${drawableCount === 1 ? 'item' : 'items'}`;
                      })()}
                      {layer.opacity < 1 ? ` · ${Math.round(layer.opacity * 100)}%` : ''}
                    </div>
                  </div>
                </button>
              )}

              {/* Reorder & Delete Controls */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    data-testid={`layer-move-up-btn-${layer.id}`}
                    disabled={!canUp}
                    onClick={() => onMoveLayer(layer.id, 'up')}
                    aria-label={`Move ${layer.name} up`}
                    title="Move layer up (render closer to top)"
                    className={`w-[18px] h-[16px] flex items-center justify-center border ${
                      canUp
                        ? 'bg-white border-[#C6C7C8] hover:bg-[#E5F1FB] hover:border-[#7DA2CE] text-[#333] cursor-pointer'
                        : 'bg-transparent border-transparent text-[#BDBDBD] cursor-default'
                    }`}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    data-testid={`layer-move-down-btn-${layer.id}`}
                    disabled={!canDown}
                    onClick={() => onMoveLayer(layer.id, 'down')}
                    aria-label={`Move ${layer.name} down`}
                    title="Move layer down (render closer to bottom)"
                    className={`w-[18px] h-[16px] flex items-center justify-center border ${
                      canDown
                        ? 'bg-white border-[#C6C7C8] hover:bg-[#E5F1FB] hover:border-[#7DA2CE] text-[#333] cursor-pointer'
                        : 'bg-transparent border-transparent text-[#BDBDBD] cursor-default'
                    }`}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
                {layers.length > 1 && (
                  <button
                    type="button"
                    data-testid={`layer-delete-btn-${layer.id}`}
                    onClick={() => onDeleteLayer(layer.id)}
                    aria-label={`Delete ${layer.name}`}
                    title={`Delete ${layer.name}`}
                    className="w-[38px] h-[15px] flex items-center justify-center border border-[#DADBDC] bg-white/80 hover:bg-[#FCE8E8] hover:border-[#E5A0A0] text-[#666] hover:text-[#B91C1C] cursor-pointer"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Layer Opacity Footer */}
      {activeLayer && (
        <div className="px-2.5 py-2 bg-[#ECEEF1] border-t border-[#DADBDC] flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-[#333333] truncate pr-2">
              {activeLayer.name} Opacity
            </span>
            <span className="font-mono text-[10.5px] text-[#1979CA] font-semibold tabular-nums">
              {Math.round(activeLayer.opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            data-testid="active-layer-opacity-slider"
            min="10"
            max="100"
            step="5"
            value={Math.round(activeLayer.opacity * 100)}
            onChange={(e) =>
              onLayerOpacityChange(activeLayer.id, parseInt(e.target.value, 10) / 100)
            }
            aria-label="Active layer opacity"
            className="w-full accent-[#1979CA] h-1.5 cursor-pointer"
          />
          <p className="text-[10px] text-[#666666] leading-tight">
            Drag layers or use arrows to reorder stack
          </p>
        </div>
      )}
    </aside>
  );
};
