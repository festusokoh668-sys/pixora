import { ColorSuggestion } from '../types';

export const COLOR_SWATCHES = [
  { hex: '#080B12', name: 'Deep Velvet' },
  { hex: '#164BCE', name: 'Royal Blue' },
  { hex: '#D6A928', name: 'Metallic Gold' },
  { hex: '#FFFFFF', name: 'Pure White' },
  { hex: '#38BDF8', name: 'Sky Cyan' },
  { hex: '#6366F1', name: 'Electric Indigo' },
  { hex: '#EC4899', name: 'Rose Petal' },
  { hex: '#10B981', name: 'Emerald Gem' },
  { hex: '#F97316', name: 'Sunburst Tangerine' },
  { hex: '#8B5CF6', name: 'Cosmic Violet' },
  { hex: '#EAB308', name: 'Bright Canary' },
  { hex: '#EF4444', name: 'Crimson Flame' },
  { hex: '#14B8A6', name: 'Teal Lagoon' },
  { hex: '#94A3B8', name: 'Graphite Mist' },
];

export const COLOR_SUGGESTIONS: ColorSuggestion[] = [
  { hex: '#164BCE', name: 'Cobalt Royale', description: 'Deep royal blue with master gallery depth' },
  { hex: '#D6A928', name: 'Imperial Gold', description: 'Classic luminous metallic pigment' },
  { hex: '#0EA5E9', name: 'Electric Azure', description: 'Vibrant highlight color for dynamic outlines' },
  { hex: '#F59E0B', name: 'Amber Sunset', description: 'Warm energetic hue perfect for floral accents' },
  { hex: '#10B981', name: 'Emerald Jade', description: 'Lush natural shade for botanical tracing' },
  { hex: '#EC4899', name: 'Neon Fuchsia', description: 'Bold pop for character studies' },
  { hex: '#8B5CF6', name: 'Stardust Orchid', description: 'Refined purple with creative serenity' },
  { hex: '#F43F5E', name: 'Ruby Radiance', description: 'Intense jewel tone that commands focus' },
  { hex: '#06B6D4', name: 'Caribbean Wave', description: 'Cool refreshing cyan for geometric shapes' },
  { hex: '#F97316', name: 'Tuscan Ochre', description: 'Earthy golden orange with rich warmth' },
];

export const CREATIVE_SPARKS = [
  'Tip: Trace the light outline first with a fine pencil, then switch to a bold brush to fill with vibrant colors!',
  'Inspiration: Combine crisp White and Royal Blue strokes for an ultra-clean architectural look.',
  'Tip: Use the Highlighter tool to layer translucent washes behind your solid strokes.',
  'Inspiration: Try drawing your favorite pet with expressive gestural strokes!',
  'Tip: Lower the template opacity to 25% when you feel confident to test your freehand precision.',
  'Inspiration: Create your own personalized monogram using the Calligraphy nib style.',
  'Tip: You can download your artwork with or without the background template guide anytime!',
  'Inspiration: Blend overlapping strokes using the Paintbrush tool at 50% opacity.',
];

export function getRandomColor(): ColorSuggestion {
  const index = Math.floor(Math.random() * COLOR_SUGGESTIONS.length);
  return COLOR_SUGGESTIONS[index];
}

export function getRandomSpark(): string {
  const index = Math.floor(Math.random() * CREATIVE_SPARKS.length);
  return CREATIVE_SPARKS[index];
}
