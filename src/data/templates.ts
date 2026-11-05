import { DrawingTemplate } from '../types';

export const REAL_MEDIA_TEMPLATES: DrawingTemplate[] = [
  {
    id: 'real-rose',
    name: 'Crimson Velvet Rose',
    category: 'nature',
    difficulty: 'Easy',
    type: 'photo',
    mediaUrl: '/src/assets/images/crimson_rose_1793728798951.jpg',
    description: 'Macro studio photograph of a blooming crimson velvet rose with clear outline petals',
    tags: ['rose', 'flower', 'blossom', 'petal', 'flora', 'bloom', 'botanical', 'plant', 'red flower'],
    viewBox: '0 0 200 200',
    svgPath: `
      M 100 75 C 90 65 90 50 100 45 C 110 50 110 65 100 75 Z
      M 100 45 C 80 40 70 60 80 75 C 90 85 100 85 110 80 C 120 70 115 50 100 45 Z
      M 80 75 C 65 70 55 90 70 110 C 85 125 115 125 130 110 C 145 90 135 70 120 75
      M 70 110 C 50 115 55 140 80 145 C 100 150 120 148 135 135 C 150 120 145 100 130 110
      M 100 148 L 100 188
      M 100 160 Q 120 155 135 162 C 125 175 110 170 100 160
      M 100 170 Q 80 168 65 175 C 75 185 90 180 100 170
    `,
  },
  {
    id: 'real-puppy',
    name: 'Golden Retriever Puppy',
    category: 'animals',
    difficulty: 'Easy',
    type: 'photo',
    mediaUrl: '/src/assets/images/golden_puppy_1793728826024.jpg',
    description: 'Studio portrait of an adorable fluffy golden retriever puppy with clear fur outlines',
    tags: ['dog', 'puppy', 'golden retriever', 'canine', 'pet', 'pup', 'hound', 'cute animal'],
    viewBox: '0 0 200 200',
    svgPath: `
      M 70 50 C 50 50 35 70 40 100 C 45 120 60 125 70 110
      M 130 50 C 150 50 165 70 160 100 C 155 120 140 125 130 110
      M 70 50 C 80 40 120 40 130 50 C 145 65 145 115 130 130 C 115 145 85 145 70 130 C 55 115 55 65 70 50 Z
      M 80 75 A 6 6 0 1 0 80 63 A 6 6 0 1 0 80 75 Z
      M 120 75 A 6 6 0 1 0 120 63 A 6 6 0 1 0 120 75 Z
      M 100 90 A 10 7 0 1 0 100 76 A 10 7 0 1 0 100 90 Z
      M 100 86 L 100 98 M 100 98 Q 90 106 82 100 M 100 98 Q 110 106 118 100
      M 70 130 L 65 175 L 85 175 L 90 140 M 130 130 L 135 175 L 115 175 L 110 140
    `,
  },
  {
    id: 'real-strawberries',
    name: 'Fresh Strawberries',
    category: 'fruits',
    difficulty: 'Easy',
    type: 'photo',
    mediaUrl: '/src/assets/images/fresh_strawberries_1793728839279.jpg',
    description: 'Macro photograph of fresh ripe red strawberries with dew drops and leaf contours',
    tags: ['strawberry', 'strawberries', 'fruit', 'berry', 'berries', 'food', 'sweet', 'ripe', 'fresh'],
    viewBox: '0 0 200 200',
    svgPath: `
      M 60 70 C 50 80 50 130 80 150 C 100 165 110 165 125 145 C 150 115 145 75 130 65 C 110 55 75 55 60 70 Z
      M 95 60 L 80 45 M 95 60 L 95 40 M 95 60 L 110 45
      M 60 70 L 75 68 M 80 62 L 95 65 M 110 62 L 125 68
      M 75 85 A 2 2 0 1 0 75 81 M 100 85 A 2 2 0 1 0 100 81 M 120 85 A 2 2 0 1 0 120 81
      M 85 105 A 2 2 0 1 0 85 101 M 110 105 A 2 2 0 1 0 110 101
      M 75 125 A 2 2 0 1 0 75 121 M 100 128 A 2 2 0 1 0 100 124 M 120 122 A 2 2 0 1 0 120 118
      M 90 145 A 2 2 0 1 0 90 141
    `,
  },
  {
    id: 'real-toucan',
    name: 'Tropical Toucan',
    category: 'animals',
    difficulty: 'Medium',
    type: 'photo',
    mediaUrl: '/src/assets/images/tropical_toucan_1793728785285.jpg',
    description: 'Vibrant tropical keel-billed toucan perched on an exotic branch',
    tags: ['toucan', 'bird', 'tropical', 'jungle', 'beak', 'rainforest', 'feather', 'parrot', 'avian'],
    viewBox: '0 0 200 200',
    svgPath: `
      M 90 40 C 130 30 175 45 180 75 C 182 88 150 90 115 85 M 90 40 C 70 45 60 65 65 90 C 70 120 65 150 80 175
      M 90 40 L 115 85
      M 80 55 A 5 5 0 1 0 80 45 A 5 5 0 1 0 80 55 Z
      M 65 90 C 80 95 100 95 110 85
      M 20 155 L 180 145 M 30 168 L 175 158
      M 75 145 L 70 162 M 85 145 L 82 160
      M 80 120 C 100 125 110 140 105 165
    `,
  },
  {
    id: 'real-lion',
    name: 'Majestic Lion Head',
    category: 'animals',
    difficulty: 'Hard',
    type: 'photo',
    mediaUrl: '/src/assets/images/lion_portrait_1793728770710.jpg',
    description: 'Crisp vector outline stencil of a majestic lion head with mane and facial features',
    tags: ['lion', 'big cat', 'wildlife', 'safari', 'predator', 'mane', 'feline', 'king of jungle'],
    viewBox: '0 0 200 200',
    svgPath: `
      M 100 25 C 80 15 55 25 45 45 C 35 60 30 85 40 105 C 45 120 50 135 60 150 C 70 165 85 180 100 188 C 115 180 130 165 140 150 C 150 135 155 120 160 105 C 170 85 165 60 155 45 C 145 25 120 15 100 25 Z
      M 50 40 C 42 35 38 48 45 55 M 150 40 C 158 35 162 48 155 55
      M 80 80 A 8 8 0 1 0 80 64 A 8 8 0 1 0 80 80 Z
      M 120 80 A 8 8 0 1 0 120 64 A 8 8 0 1 0 120 80 Z
      M 75 72 H 85 M 115 72 H 125
      M 100 90 L 90 105 H 110 Z
      M 100 105 L 100 115 M 100 115 Q 90 126 80 120 M 100 115 Q 110 126 120 120
      M 80 110 L 45 108 M 80 115 L 42 118 M 80 120 L 46 128
      M 120 110 L 155 108 M 120 115 L 158 118 M 120 120 L 154 128
      M 100 126 L 90 142 L 100 150 L 110 142 Z
      M 60 50 Q 75 60 85 40 M 140 50 Q 125 60 115 40
      M 40 75 Q 60 85 70 95 M 160 75 Q 140 85 130 95
      M 45 110 Q 65 125 75 140 M 155 110 Q 135 125 125 140
      M 55 145 Q 75 155 85 170 M 145 145 Q 125 155 115 170
    `,
  },
  {
    id: 'real-mountain',
    name: 'Alpine Mountain Vista',
    category: 'nature',
    difficulty: 'Hard',
    type: 'photo',
    mediaUrl: '/src/assets/images/mountain_landscape_1793728853371.jpg',
    description: 'Snow-capped granite mountain peaks reflecting in an alpine glacial lake',
    tags: ['mountain', 'landscape', 'alps', 'snow', 'lake', 'sunrise', 'scenery', 'peak', 'vista'],
    viewBox: '0 0 200 200',
    svgPath: `
      M 10 140 L 50 70 L 80 110 L 120 45 L 160 100 L 190 140 Z
      M 50 70 L 60 95 L 40 110 M 120 45 L 135 80 L 105 100
      M 30 120 C 60 115 80 125 100 120 M 110 130 C 140 125 160 135 180 130
      M 10 140 C 50 145 100 140 190 140
      M 20 160 C 60 155 120 165 180 160
      M 40 175 C 80 170 140 180 170 175
      M 160 30 A 15 15 0 1 0 160 60 A 15 15 0 1 0 160 30 Z
    `,
  },
  {
    id: 'real-supercar',
    name: 'Midnight Supercar',
    category: 'vehicles',
    difficulty: 'Pro',
    type: 'photo',
    mediaUrl: '/src/assets/images/modern_supercar_1793728811642.jpg',
    description: 'Sleek aerodynamic sports supercar with sharp precision body contours',
    tags: ['car', 'supercar', 'sports car', 'automobile', 'auto', 'vehicle', 'racecar', 'racing', 'speed'],
    viewBox: '0 0 200 200',
    svgPath: `
      M 20 125 C 30 115 50 110 80 100 C 100 80 125 70 150 75 C 170 80 185 100 188 120 L 188 135 C 175 140 160 140 140 140 C 130 140 80 140 30 140 C 20 138 15 132 20 125 Z
      M 75 102 C 95 85 120 78 145 82 C 148 95 140 105 130 108 L 75 102 Z
      M 45 140 A 16 16 0 1 0 45 108 A 16 16 0 1 0 45 140 Z
      M 155 140 A 16 16 0 1 0 155 108 A 16 16 0 1 0 155 140 Z
      M 45 132 A 8 8 0 1 0 45 116 A 8 8 0 1 0 45 132 Z
      M 155 132 A 8 8 0 1 0 155 116 A 8 8 0 1 0 155 132 Z
      M 165 112 L 182 114 M 25 120 L 40 122
    `,
  },
  {
    id: 'real-astronaut',
    name: 'Spacewalk Astronaut',
    category: 'characters',
    difficulty: 'Mastery',
    type: 'photo',
    mediaUrl: '/src/assets/images/astronaut_space_1793728866354.jpg',
    description: 'Spacewalking astronaut in high-tech suit orbiting Earth with intricate helmet contours',
    tags: ['astronaut', 'space', 'spaceman', 'cosmos', 'orbit', 'nasa', 'galaxy', 'stars', 'character'],
    viewBox: '0 0 200 200',
    svgPath: `
      M 70 45 C 70 30 130 30 130 45 C 145 45 145 95 130 95 C 130 110 70 110 70 95 C 55 95 55 45 70 45 Z
      M 80 55 C 80 50 120 50 120 55 C 128 55 128 85 120 85 C 120 90 80 90 80 85 C 72 85 72 55 80 55 Z
      M 85 62 Q 95 60 100 68
      M 78 105 L 68 140 C 68 150 82 150 82 140 L 88 120 L 96 120 L 96 160 L 82 162 L 82 172 L 100 172 L 102 120 L 104 120 L 106 172 L 124 172 L 124 162 L 110 160 L 110 120 L 118 120 L 124 140 C 124 150 138 150 138 140 L 128 105
      M 88 125 H 118 V 145 H 88 Z
      M 30 30 L 32 36 L 38 38 L 32 40 L 30 46 L 28 40 L 22 38 L 28 36 Z
      M 165 30 L 167 36 L 173 38 L 167 40 L 165 46 L 163 40 L 157 38 L 163 36 Z
    `,
  },
];

export const VECTOR_TEMPLATES: DrawingTemplate[] = [
  {
    id: 'animal-cat',
    name: 'Playful Kitten',
    category: 'animals',
    difficulty: 'Easy',
    type: 'vector',
    viewBox: '0 0 200 200',
    description: 'Cute smiling cat with perked ears and whiskers',
    tags: ['cat', 'kitten', 'kitty', 'feline', 'pet', 'meow', 'whiskers', 'cute animal'],
    svgPath: `
      M 70 70 L 60 30 L 90 50 C 97 48 103 48 110 50 L 140 30 L 130 70
      C 155 90 155 130 135 150 C 120 165 80 165 65 150 C 45 130 45 90 70 70 Z
      M 80 95 A 6 6 0 1 0 80 83 A 6 6 0 1 0 80 95 Z
      M 120 95 A 6 6 0 1 0 120 83 A 6 6 0 1 0 120 95 Z
      M 100 108 L 94 115 L 106 115 Z
      M 100 115 Q 92 126 84 120 M 100 115 Q 108 126 116 120
      M 70 108 L 35 102 M 70 115 L 30 117 M 70 122 L 35 130
      M 130 108 L 165 102 M 130 115 L 170 117 M 130 122 L 165 130
      M 130 148 Q 165 155 170 130 Q 173 110 160 120
    `,
  },
  {
    id: 'nature-sunflower',
    name: 'Golden Sunflower',
    category: 'nature',
    difficulty: 'Medium',
    type: 'vector',
    viewBox: '0 0 200 200',
    description: 'Warm radiating sunflower with bold petals',
    tags: ['sunflower', 'flower', 'sun', 'blossom', 'summer', 'plant', 'yellow flower', 'flora'],
    svgPath: `
      M 100 70 A 30 30 0 1 0 100 130 A 30 30 0 1 0 100 70 Z
      M 100 70 Q 95 45 100 35 Q 105 45 100 70
      M 100 130 Q 95 155 100 165 Q 105 155 100 130
      M 70 100 Q 45 95 35 100 Q 45 105 70 100
      M 130 100 Q 155 95 165 100 Q 155 105 130 100
      M 79 79 Q 58 58 52 52 Q 72 72 79 79
      M 121 121 Q 142 142 148 148 Q 128 128 121 121
      M 121 79 Q 142 58 148 52 Q 128 72 121 79
      M 79 121 Q 58 142 52 148 Q 72 128 79 121
      M 90 95 L 110 95 M 95 90 L 95 110 M 105 90 L 105 110 M 90 105 L 110 105
    `,
  },
  {
    id: 'character-astronaut',
    name: 'Astro Explorer',
    category: 'characters',
    difficulty: 'Pro',
    type: 'vector',
    viewBox: '0 0 200 200',
    description: 'Adventurous chibi astronaut floating in space',
    tags: ['astronaut', 'cosmonaut', 'space', 'chibi', 'explorer', 'rocket man', 'stars'],
    svgPath: `
      M 70 45 C 70 30 130 30 130 45 C 145 45 145 95 130 95 C 130 110 70 110 70 95 C 55 95 55 45 70 45 Z
      M 80 55 C 80 50 120 50 120 55 C 128 55 128 85 120 85 C 120 90 80 90 80 85 C 72 85 72 55 80 55 Z
      M 85 62 Q 95 60 100 68
      M 78 105 L 68 140 C 68 150 82 150 82 140 L 88 120 L 96 120 L 96 160 L 82 162 L 82 172 L 100 172 L 102 120 L 104 120 L 106 172 L 124 172 L 124 162 L 110 160 L 110 120 L 118 120 L 124 140 C 124 150 138 150 138 140 L 128 105
      M 88 125 H 118 V 145 H 88 Z
    `,
  },
  {
    id: 'shape-mandala',
    name: 'Golden Mandala',
    category: 'shapes',
    difficulty: 'Mastery',
    type: 'vector',
    viewBox: '0 0 200 200',
    description: 'Harmonious radial sacred geometry pattern with complex intricate symmetry',
    tags: ['mandala', 'geometry', 'pattern', 'shape', 'symmetry', 'radial', 'circle', 'zen'],
    svgPath: `
      M 100 20 L 100 180 M 20 100 L 180 100
      M 43 43 L 157 157 M 43 157 L 157 43
      M 100 60 A 40 40 0 1 0 100 140 A 40 40 0 1 0 100 60 Z
      M 100 75 A 25 25 0 1 0 100 125 A 25 25 0 1 0 100 75 Z
      M 100 35 L 115 60 L 100 75 L 85 60 Z
      M 100 165 L 115 140 L 100 125 L 85 140 Z
      M 35 100 L 60 85 L 75 100 L 60 115 Z
      M 165 100 L 140 85 L 125 100 L 140 115 Z
    `,
  },
  {
    id: 'pattern-wave',
    name: 'Oceanic Spiral Wave',
    category: 'patterns',
    difficulty: 'Legend',
    type: 'vector',
    viewBox: '0 0 200 200',
    description: 'Stylized Legendary Great Wave curl with detailed ocean foam contours',
    tags: ['wave', 'ocean', 'sea', 'water', 'tsunami', 'surf', 'beach', 'japanese art'],
    svgPath: `
      M 20 150 C 40 150 60 140 70 120 C 85 90 90 50 130 45 C 160 40 175 70 165 95 C 155 115 130 120 120 105 C 112 92 125 80 135 88
      M 130 45 C 120 50 115 65 110 75
      M 145 52 C 140 65 135 75 130 85
      M 20 165 C 50 165 80 155 100 145 C 130 130 160 135 180 150
      M 30 180 C 70 180 110 170 140 165 C 165 160 180 170 190 175
    `,
  },
];

export const TEMPLATES: DrawingTemplate[] = [...REAL_MEDIA_TEMPLATES, ...VECTOR_TEMPLATES];
