import { ShapeSpec } from '../game/shapes';

export interface StoryLine {
  speaker: string;
  avatar: string;
  text: string;
}

export interface Theme {
  bgTop: string;
  bgBottom: string;
  surface: string;
  surfaceAlt: string;
  /** Tint cells get once the arrows on them have been cleared. */
  cleared: string;
  arrows: string[];
  emblem: [string, string];
  ui: string;
  particles: 'leaves' | 'bubbles' | 'neon' | 'sand' | 'stars';
}

export interface LevelSpec {
  id: string;
  chapter: number;
  index: number;
  shape: ShapeSpec;
  seed: number;
  minLen: number;
  maxLen: number;
  fill: number;
  straightness: number;
  /** Mistakes allowed before failing. */
  lives: number;
  /** If set the stage is timed: seconds granted per arrow on the shape. */
  secondsPerArrow?: number;
  boss?: boolean;
}

export interface Chapter {
  id: number;
  name: string;
  tagline: string;
  icon: string;
  theme: Theme;
  intro: StoryLine[];
  outro: StoryLine[];
  levels: LevelSpec[];
}

const PIP = { speaker: 'Pip', avatar: '🦊' };
const LUMA = { speaker: 'Luma', avatar: '✨' };
const WEAVER = { speaker: 'The Knot Weaver', avatar: '🕸️' };
const line = (who: { speaker: string; avatar: string }, text: string): StoryLine => ({ ...who, text });

type Stage = Omit<LevelSpec, 'id' | 'chapter' | 'index' | 'seed' | 'minLen' | 'maxLen' | 'fill' | 'straightness'> &
  Partial<Pick<LevelSpec, 'minLen' | 'maxLen' | 'fill' | 'straightness'>>;

function stages(chapter: number, list: Stage[]): LevelSpec[] {
  return list.map((s, i) => ({
    minLen: 2,
    maxLen: 6,
    fill: 0.9,
    straightness: 0.6,
    ...s,
    id: `${chapter}-${i + 1}`,
    chapter,
    index: i,
    seed: chapter * 1000 + i * 37 + 11,
  }));
}

const cube = (size: number): ShapeSpec => ({ kind: 'cube', size });
const block = (x: number, y: number, z: number): ShapeSpec => ({ kind: 'cuboid', size: [x, y, z] });
const pyramid = (base: number, tierHeight = 1): ShapeSpec => ({ kind: 'pyramid', base, tierHeight });
const cross = (size: number, arm: number): ShapeSpec => ({ kind: 'cross', size, arm });

export const CHAPTERS: Chapter[] = [
  {
    id: 1,
    name: 'Whispering Forest',
    tagline: 'Learn to untangle the knots',
    icon: '🌲',
    theme: {
      bgTop: '#d9f5d0',
      bgBottom: '#7cc59a',
      surface: '#fffaf0',
      surfaceAlt: '#f4efe2',
      cleared: '#cfeec0',
      arrows: ['#1f5130', '#2e7d4f', '#3c6e2a', '#5a4632'],
      emblem: ['#ff8fa3', '#ffd166'],
      ui: '#2e7d4f',
      particles: 'leaves',
    },
    intro: [
      line(LUMA, 'Pip! The Knot Weaver has tied up every Light Cube in the realm!'),
      line(PIP, 'Then I will untie them, one arrow at a time.'),
      line(LUMA, 'Tap an arrow and it slides away in the way it points, but only if nothing is in front of it. Drag to turn the cube.'),
    ],
    outro: [
      line(LUMA, 'The forest is glowing again! A shard of light floats toward the sea…'),
      line(PIP, 'To the Coral Ocean, then!'),
    ],
    levels: stages(1, [
      { shape: cube(3), lives: 5, maxLen: 3 },
      { shape: cube(3), lives: 5, maxLen: 4 },
      { shape: cube(4), lives: 5, maxLen: 4 },
      { shape: cube(4), lives: 5 },
      { shape: block(5, 3, 3), lives: 5 },
      { shape: cube(5), lives: 5 },
      { shape: cube(5), lives: 4, straightness: 0.45 },
      { shape: cube(6), lives: 4, boss: true, secondsPerArrow: 6 },
    ]),
  },
  {
    id: 2,
    name: 'Coral Ocean',
    tagline: 'Longer arrows, fewer mistakes',
    icon: '🐚',
    theme: {
      bgTop: '#bfe9ff',
      bgBottom: '#2b7bd6',
      surface: '#f5fbff',
      surfaceAlt: '#e5f2fb',
      cleared: '#bfe6f5',
      arrows: ['#0b3c6f', '#0e7490', '#1d4ed8', '#ef6f6c'],
      emblem: ['#ff7f50', '#ffe066'],
      ui: '#1d6fd1',
      particles: 'bubbles',
    },
    intro: [
      line(PIP, 'The cubes down here are stretched out like whales!'),
      line(WEAVER, 'Every knot you loosen, I tie two more. Careful, little fox; mistakes cost more here.'),
    ],
    outro: [line(LUMA, 'The reef sparkles! The next shard drifts toward the city lights.')],
    levels: stages(2, [
      { shape: cube(5), lives: 4, maxLen: 7 },
      { shape: block(6, 4, 4), lives: 4, maxLen: 7 },
      { shape: cube(6), lives: 4, maxLen: 8 },
      { shape: block(7, 5, 4), lives: 3, maxLen: 8 },
      { shape: pyramid(6, 2), lives: 3 },
      { shape: block(8, 4, 6), lives: 3, maxLen: 9 },
      { shape: cube(7), lives: 3, maxLen: 9, straightness: 0.5 },
      { shape: cube(7), lives: 3, boss: true, secondsPerArrow: 5, maxLen: 9 },
    ]),
  },
  {
    id: 3,
    name: 'Neon City',
    tagline: 'Race the clock',
    icon: '🌃',
    theme: {
      bgTop: '#2a0c4e',
      bgBottom: '#ff4f9a',
      surface: '#fdf7ff',
      surfaceAlt: '#f1e6fb',
      cleared: '#f8c7ff',
      arrows: ['#5b21b6', '#db2777', '#0891b2', '#1e1b4b'],
      emblem: ['#22d3ee', '#facc15'],
      ui: '#c026d3',
      particles: 'neon',
    },
    intro: [
      line(LUMA, 'The city clocks are ticking backwards! These cubes will lock if we are too slow.'),
      line(PIP, 'Then I will be quick. Watch the timer!'),
    ],
    outro: [line(WEAVER, 'Fast paws… but the desert temple will test your patience.')],
    levels: stages(3, [
      { shape: cube(6), lives: 3, secondsPerArrow: 6 },
      { shape: pyramid(7), lives: 3, secondsPerArrow: 6 },
      { shape: block(9, 5, 5), lives: 3, secondsPerArrow: 5, maxLen: 9 },
      { shape: cube(7), lives: 3, secondsPerArrow: 5, maxLen: 9 },
      { shape: pyramid(8, 2), lives: 3, secondsPerArrow: 5 },
      { shape: cross(9, 3), lives: 3, secondsPerArrow: 5 },
      { shape: cube(8), lives: 3, secondsPerArrow: 4, maxLen: 10 },
      { shape: pyramid(10, 2), lives: 3, boss: true, secondsPerArrow: 4, maxLen: 10 },
    ]),
  },
  {
    id: 4,
    name: 'Desert Temple',
    tagline: 'One slip can cost everything',
    icon: '🏜️',
    theme: {
      bgTop: '#ffe8b8',
      bgBottom: '#e08a3c',
      surface: '#fff8ea',
      surfaceAlt: '#f7ead0',
      cleared: '#ffd9a0',
      arrows: ['#7c2d12', '#9a3412', '#3f2a14', '#0f766e'],
      emblem: ['#0ea5e9', '#f43f5e'],
      ui: '#c2410c',
      particles: 'sand',
    },
    intro: [
      line(PIP, 'Strange shapes… stairs and crosses, not just cubes.'),
      line(LUMA, 'The temple guards forgive very few mistakes. Use hints if you must.'),
    ],
    outro: [
      line(WEAVER, 'You reached my sky fortress? Then come, and face the greatest knot of all!'),
    ],
    levels: stages(4, [
      { shape: pyramid(8), lives: 2, maxLen: 9 },
      { shape: cross(9, 3), lives: 2, maxLen: 9 },
      { shape: cube(8), lives: 2, maxLen: 10 },
      { shape: pyramid(10), lives: 2, maxLen: 10, straightness: 0.5 },
      { shape: cross(11, 3), lives: 2, maxLen: 10 },
      { shape: cube(9), lives: 1, maxLen: 10 },
      { shape: block(10, 6, 8), lives: 1, maxLen: 11 },
      { shape: pyramid(12, 2), lives: 2, boss: true, secondsPerArrow: 4, maxLen: 11 },
    ]),
  },
  {
    id: 5,
    name: 'Starlight Fortress',
    tagline: 'Giant cubes among the stars',
    icon: '🌌',
    theme: {
      bgTop: '#070b2a',
      bgBottom: '#3b2a8c',
      surface: '#f6f7ff',
      surfaceAlt: '#e9ebfb',
      cleared: '#c9d3ff',
      arrows: ['#111827', '#4338ca', '#0f766e', '#be123c'],
      emblem: ['#fbbf24', '#a78bfa'],
      ui: '#6d5dfc',
      particles: 'stars',
    },
    intro: [
      line(LUMA, 'These are the biggest cubes yet, Pip. Turn them often, the free arrows hide on every side.'),
      line(PIP, 'Every knot comes undone eventually.'),
    ],
    outro: [
      line(WEAVER, 'My knots… all undone. Perhaps the realm is brighter this way.'),
      line(LUMA, 'You did it, Pip! Every Light Cube shines again. Thank you for playing!'),
    ],
    levels: stages(5, [
      { shape: cube(10), lives: 3, maxLen: 12 },
      { shape: cross(13, 5), lives: 3, maxLen: 12 },
      { shape: cube(11), lives: 2, secondsPerArrow: 4, maxLen: 12 },
      { shape: block(12, 8, 10), lives: 2, maxLen: 12, straightness: 0.5 },
      { shape: pyramid(14), lives: 2, maxLen: 12 },
      { shape: cube(12), lives: 1, maxLen: 12 },
      { shape: cross(15, 5), lives: 2, secondsPerArrow: 3.5, maxLen: 12 },
      { shape: cube(14), lives: 3, boss: true, secondsPerArrow: 3.5, maxLen: 14 },
    ]),
  },
];

export const ALL_LEVELS: LevelSpec[] = CHAPTERS.flatMap((c) => c.levels);
export const findLevel = (id: string) => ALL_LEVELS.find((l) => l.id === id)!;
export const chapterOf = (level: LevelSpec) => CHAPTERS[level.chapter - 1];
export const nextLevel = (level: LevelSpec): LevelSpec | undefined => ALL_LEVELS[ALL_LEVELS.indexOf(level) + 1];
