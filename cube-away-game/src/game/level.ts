import { LevelSpec } from '../data/chapters';
import { buildSurface, Surface } from './surface';
import { Arrow, generatePuzzle } from './generator';

export interface BuiltLevel {
  spec: LevelSpec;
  surface: Surface;
  arrows: Arrow[];
  timeLimit?: number;
}

const cache = new Map<string, BuiltLevel>();

export function buildLevel(spec: LevelSpec): BuiltLevel {
  const hit = cache.get(spec.id);
  if (hit) return hit;
  const surface = buildSurface(spec.shape);
  const arrows = generatePuzzle(surface, spec);
  const timeLimit = spec.secondsPerArrow ? Math.ceil((arrows.length * spec.secondsPerArrow) / 5) * 5 : undefined;
  const built = { spec, surface, arrows, timeLimit };
  cache.set(spec.id, built);
  return built;
}

export function starsFor(mistakes: number, lives: number): number {
  if (mistakes === 0) return 3;
  return mistakes <= Math.max(1, Math.floor(lives / 2)) ? 2 : 1;
}
