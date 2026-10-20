import { Surface } from './surface';
import { V3, add, eq, neg, tangents } from './vec';
import { createRng } from './rng';

export interface Arrow {
  id: number;
  /** Cells covered by the arrow, ordered tail → head. */
  cells: number[];
  /** Direction the head points (and the arrow slides) along the head's face. */
  dir: V3;
  /** Cells the head sweeps through before leaving the shape. Must be empty to escape. */
  ray: number[];
}

export interface GenOptions {
  seed: number;
  minLen: number;
  maxLen: number;
  /** Fraction of surface cells to try to cover (0..1). */
  fill: number;
  /** Chance (0..1) the body keeps going straight instead of turning. */
  straightness: number;
}

/**
 * Cells the head would travel through when leaving in direction `d`, or null if the
 * shape itself (a wall or overhang) blocks the way forever.
 */
export function computeRay(surface: Surface, head: number, d: V3): number[] | null {
  const ray: number[] = [];
  let cur = head;
  for (;;) {
    const { v, n } = surface.cells[cur];
    const w = add(v, d);
    if (surface.isSolid(w)) {
      if (surface.isSolid(add(w, n))) return null;
      cur = surface.cellAt(w, n);
      ray.push(cur);
      continue;
    }
    // Leaving the surface into open air: nothing may be in the way on this plane.
    let p = w;
    while (surface.inBounds(p)) {
      if (surface.isSolid(p) || surface.isSolid(add(p, n))) return null;
      p = add(p, d);
    }
    return ray;
  }
}

/**
 * Builds a puzzle that is always solvable: every arrow's escape ray is clear of all arrows
 * placed before it, so removing arrows from last-placed to first always works. Because the
 * "blocks" relation only ever points from earlier to later arrows it can never form a cycle,
 * so the player can never reach a dead end either.
 */
export function generatePuzzle(surface: Surface, opts: GenOptions): Arrow[] {
  const rng = createRng(opts.seed);
  const total = surface.cells.length;
  const occ = new Int32Array(total).fill(-1);
  const arrows: Arrow[] = [];
  const target = Math.floor(total * opts.fill);
  let covered = 0;

  const tryPlace = (head: number): boolean => {
    for (const d of rng.shuffle(tangents(surface.cells[head].n))) {
      const ray = computeRay(surface, head, d);
      if (!ray || ray.some((c) => occ[c] !== -1)) continue;

      const forbidden = new Set<number>(ray);
      forbidden.add(head);
      const body = [head];
      const wantLen = rng.int(opts.minLen, opts.maxLen);
      // Walk backwards from the head; the first step must line up with the arrow direction.
      let cur = head;
      let back: V3 = neg(d);
      let first = true;
      while (body.length < wantLen) {
        const n = surface.cells[cur].n;
        const options: V3[] = [];
        if (first || rng.next() < opts.straightness) options.push(back);
        if (!first) {
          for (const t of rng.shuffle(tangents(n))) {
            if (!eq(t, back) && !eq(t, neg(back))) options.push(t);
          }
          if (!options.some((o) => eq(o, back))) options.push(back);
        }
        let moved = false;
        for (const o of options) {
          const s = surface.step(cur, o);
          if (s.kind === 'wall' || s.cell < 0) continue;
          if (occ[s.cell] !== -1 || forbidden.has(s.cell)) continue;
          body.push(s.cell);
          forbidden.add(s.cell);
          cur = s.cell;
          back = s.dir;
          moved = true;
          break;
        }
        first = false;
        if (!moved) break;
      }
      if (body.length < opts.minLen) continue;

      const id = arrows.length;
      const cells = body.reverse();
      for (const c of cells) occ[c] = id;
      covered += cells.length;
      arrows.push({ id, cells, dir: d, ray });
      return true;
    }
    return false;
  };

  for (let pass = 0; pass < 3 && covered < target; pass++) {
    for (const head of rng.shuffle([...Array(total).keys()])) {
      if (covered >= target) break;
      if (occ[head] === -1) tryPlace(head);
    }
  }
  return arrows;
}
