export type ToolType = 'pencil' | 'brush' | 'bucket' | 'highlighter' | 'calligraphy' | 'eraser';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface Stroke {
  id: string;
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  points: Point[];
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
