import { Surface } from './surface';
import { Arrow } from './generator';

export type TapResult =
  | { kind: 'exit' }
  | { kind: 'blocked'; blocker: number; /** distance (in cells) the head can travel before bumping */ distance: number }
  | { kind: 'none' };

/** Mutable runtime state of one puzzle: which arrows are still on the shape. */
export class PuzzleState {
  readonly occ: Int32Array;
  readonly alive: boolean[];
  remaining: number;

  constructor(readonly surface: Surface, readonly arrows: Arrow[]) {
    this.occ = new Int32Array(surface.cells.length).fill(-1);
    this.alive = arrows.map(() => true);
    this.remaining = arrows.length;
    for (const a of arrows) for (const c of a.cells) this.occ[c] = a.id;
  }

  check(id: number): TapResult {
    if (!this.alive[id]) return { kind: 'none' };
    const ray = this.arrows[id].ray;
    for (let i = 0; i < ray.length; i++) {
      const o = this.occ[ray[i]];
      if (o !== -1 && o !== id) return { kind: 'blocked', blocker: o, distance: i };
    }
    return { kind: 'exit' };
  }

  remove(id: number) {
    if (!this.alive[id]) return;
    this.alive[id] = false;
    this.remaining--;
    for (const c of this.arrows[id].cells) this.occ[c] = -1;
  }

  /** All arrows that could escape right now (used for hints). */
  freeArrows(): number[] {
    return this.arrows.filter((a) => this.alive[a.id] && this.check(a.id).kind === 'exit').map((a) => a.id);
  }

  /** Arrow under a tapped cell, falling back to an adjacent cell for fat-finger taps. */
  arrowNear(cell: number): number {
    if (this.occ[cell] !== -1) return this.occ[cell];
    const { n } = this.surface.cells[cell];
    for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
      if (d[0] * n[0] + d[1] * n[1] + d[2] * n[2] !== 0) continue;
      const s = this.surface.step(cell, [d[0], d[1], d[2]]);
      if (s.kind !== 'wall' && s.cell >= 0 && this.occ[s.cell] !== -1) return this.occ[s.cell];
    }
    return -1;
  }
}
