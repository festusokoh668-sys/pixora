export type ToolType =
  | 'pencil'
  | 'brush'
  | 'bucket'
  | 'highlighter'
  | 'calligraphy'
  | 'airbrush'
  | 'oil'
  | 'crayon'
  | 'watercolor'
  | 'stamp'
  | 'blur'
  | 'eraser'
  | 'picker'
  | 'magnifier'
  | 'text'
  | 'select'
  | 'shape';

export type StampShape = 'star' | 'heart' | 'circle';

export type ShapeType =
  | 'line'
  | 'curve'
  | 'oval'
  | 'rectangle'
  | 'rounded-rectangle'
  | 'polygon'
  | 'triangle'
  | 'right-triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'arrow-right'
  | 'arrow-left'
  | 'arrow-up'
  | 'arrow-down'
  | 'star-4'
  | 'star-5'
  | 'star-6'
  | 'heart'
  | 'callout'
  | 'cloud'
  | 'lightning';

export type ShapeOutlineStyle =
  | 'solid'
  | 'none'
  | 'crayon'
  | 'marker'
  | 'oil'
  | 'pencil'
  | 'watercolor';

export type ShapeFillStyle =
  | 'none'
  | 'solid'
  | 'crayon'
  | 'marker'
  | 'oil'
  | 'pencil'
  | 'watercolor';

export type PaintFinish = 'oil' | 'acrylic' | 'ink' | 'graphite' | 'watercolor';

export type MirrorMode = 'none' | 'horizontal' | 'vertical' | 'quad';

export type LayerFilterType = 'grayscale' | 'sepia' | 'brightness' | 'invert';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
}

export interface Stroke {
  id: string;
  layerId?: string;
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  points: Point[];
  // Physical paint & gradient properties
  colorEnd?: string;
  paintFinish?: PaintFinish;
  // Stamp brush property (tool === 'stamp')
  stampShape?: StampShape;
  // Geometric shape properties (tool === 'shape')
  shapeType?: ShapeType;
  outlineStyle?: ShapeOutlineStyle;
  fillStyle?: ShapeFillStyle;
  fillColor?: string;
  flipH?: boolean;
  flipV?: boolean;
  // Text annotation properties (tool === 'text')
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  // Selection / clipboard / raster operations (undoable via HistoryManager)
  operation?: 'erase-rect' | 'paste-image' | 'replace-bitmap';
  rect?: RectBounds;
  rasterDataUrl?: string;
}

export type TemplateCategory =
  | 'animals'
  | 'nature'
  | 'characters'
  | 'shapes'
  | 'vehicles'
  | 'fruits'
  | 'patterns'
  | 'letters';

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard' | 'Pro' | 'Mastery' | 'Legend';

export interface DrawingTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  difficulty: DifficultyLevel;
  type: 'photo' | 'video' | 'vector';
  mediaUrl?: string;
  svgPath?: string;
  viewBox?: string;
  description: string;
  tags?: string[];
  collectionId?: string;
  collectionTitle?: string;
}

export interface DrawingCollection {
  id: string;
  title: string;
  category: TemplateCategory;
  description: string;
  tags?: string[];
  levels: {
    Easy: DrawingTemplate;
    Medium: DrawingTemplate;
    Hard: DrawingTemplate;
  };
}

export interface SavedArtwork {
  id: string;
  title: string;
  date: string;
  dataUrl: string;
  templateName?: string;
  strokesCount: number;
}

export interface ColorSuggestion {
  hex: string;
  name: string;
  description: string;
}
