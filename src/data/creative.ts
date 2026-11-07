import { ColorSuggestion } from '../types';

export interface ColorItem {
  hex: string;
  name: string;
}

export const CLASSIC_PAINT_BOX: ColorItem[] = [
  { hex: '#000000', name: 'Black' },
  { hex: '#7F7F7F', name: 'Dark Gray' },
  { hex: '#880015', name: 'Dark Red' },
  { hex: '#ED1C24', name: 'Red' },
  { hex: '#FF7F27', name: 'Orange' },
  { hex: '#FFF200', name: 'Yellow' },
  { hex: '#22B14C', name: 'Green' },
  { hex: '#00A2E8', name: 'Turquoise' },
  { hex: '#3F48CC', name: 'Indigo' },
  { hex: '#A349A4', name: 'Purple' },
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#C3C3C3', name: 'Light Gray' },
  { hex: '#B5E61D', name: 'Lime Green' },
  { hex: '#99D9EA', name: 'Sky Blue' },
  { hex: '#7092BE', name: 'Steel Blue' },
  { hex: '#C8BFE7', name: 'Lavender' },
  { hex: '#FFAEC9', name: 'Pink' },
  { hex: '#FFC90E', name: 'Gold' },
];

export const SKIN_TONE_PALETTE: ColorItem[] = [
  { hex: '#FFDFC4', name: 'Porcelain' },
  { hex: '#F0D5BE', name: 'Fair Ivory' },
  { hex: '#EECEB1', name: 'Warm Peach' },
  { hex: '#E2AC89', name: 'Natural Sand' },
  { hex: '#C68642', name: 'Honey Amber' },
  { hex: '#8D5524', name: 'Mocha Tan' },
  { hex: '#603913', name: 'Rich Bronze' },
  { hex: '#3A1E05', name: 'Dark Ebony' },
];

export const PASTEL_PALETTE: ColorItem[] = [
  { hex: '#FFB3BA', name: 'Pastel Rose' },
  { hex: '#FFDFBA', name: 'Pastel Peach' },
  { hex: '#FFFFBA', name: 'Pastel Yellow' },
  { hex: '#BAFFC9', name: 'Pastel Mint' },
  { hex: '#BAE1FF', name: 'Pastel Sky' },
  { hex: '#E8AEFF', name: 'Pastel Lilac' },
  { hex: '#FFC6FF', name: 'Pastel Bubblegum' },
  { hex: '#E0FEFE', name: 'Pastel Ice' },
];

export const NEON_PALETTE: ColorItem[] = [
  { hex: '#FF0055', name: 'Neon Coral' },
  { hex: '#FF5E00', name: 'Neon Orange' },
  { hex: '#FFE600', name: 'Neon Yellow' },
  { hex: '#00FF66', name: 'Neon Lime' },
  { hex: '#00F0FF', name: 'Cyber Cyan' },
  { hex: '#B800FF', name: 'Electric Purple' },
  { hex: '#FF00B7', name: 'Hot Pink' },
  { hex: '#39FF14', name: 'Toxic Green' },
];

export const NATURE_PALETTE: ColorItem[] = [
  { hex: '#2D5A27', name: 'Forest Pines' },
  { hex: '#4F772D', name: 'Olive Leaf' },
  { hex: '#90A955', name: 'Sage Meadow' },
  { hex: '#C2A878', name: 'Desert Sand' },
  { hex: '#A85751', name: 'Terracotta' },
  { hex: '#1B4332', name: 'Deep Evergreen' },
  { hex: '#0077B6', name: 'Ocean Depth' },
  { hex: '#582C0E', name: 'Cedar Bark' },
];

export const JEWEL_METALLIC_PALETTE: ColorItem[] = [
  { hex: '#D6A928', name: 'Metallic Gold' },
  { hex: '#C0C0C0', name: 'Metallic Silver' },
  { hex: '#CD7F32', name: 'Metallic Bronze' },
  { hex: '#9B111E', name: 'Ruby Gem' },
  { hex: '#0F52BA', name: 'Sapphire Blue' },
  { hex: '#50C878', name: 'Emerald Gem' },
  { hex: '#9966CC', name: 'Amethyst Purple' },
  { hex: '#E0115F', name: 'Topaz Magenta' },
];

export const COLOR_SWATCHES: ColorItem[] = [
  { hex: '#000000', name: 'Black' },
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#164BCE', name: 'Royal Blue' },
  { hex: '#ED1C24', name: 'Red' },
  { hex: '#22B14C', name: 'Green' },
  { hex: '#FFF200', name: 'Yellow' },
  { hex: '#FF7F27', name: 'Orange' },
  { hex: '#A349A4', name: 'Purple' },
  { hex: '#00A2E8', name: 'Cyan' },
  { hex: '#FFAEC9', name: 'Pink' },
  { hex: '#880015', name: 'Maroon' },
  { hex: '#582C0E', name: 'Brown' },
  { hex: '#D6A928', name: 'Gold' },
  { hex: '#C0C0C0', name: 'Silver' },
  { hex: '#EECEB1', name: 'Peach' },
  { hex: '#BAFFC9', name: 'Mint' },
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
