import { Surface } from './surface';

/** Emblems painted on boss-stage faces and revealed as arrows clear. */
export type Emblem = 'heart' | 'star' | 'sun' | 'moon' | 'flower' | 'gem';
const EMBLEMS: Emblem[] = ['star', 'heart', 'sun', 'moon', 'flower', 'gem'];

function inside(emblem: Emblem, x: number, y: number): 0 | 1 | 2 {
  const r = Math.hypot(x, y);
  const a = Math.atan2(y, x);
  switch (emblem) {
    case 'heart': {
      const yy = -y * 1.1 + 0.25;
      const v = (x * x + yy * yy - 0.42) ** 3 - x * x * yy ** 3;
      return v < 0 ? 1 : 0;
    }
    case 'star': {
      const k = Math.cos(Math.PI / 5) / Math.cos(((a + Math.PI / 2) % ((2 * Math.PI) / 5)) - Math.PI / 5);
      return r < 0.82 * (0.5 + 0.5 * Math.abs(k) ** 6) ? 1 : 0;
    }
    case 'sun':
      if (r < 0.45) return 1;
      return r < 0.85 && Math.cos(a * 8) > 0.35 ? 2 : 0;
    case 'moon':
      return r < 0.75 && Math.hypot(x - 0.32, y - 0.2) > 0.58 ? 1 : 0;
    case 'flower':
      if (r < 0.25) return 2;
      return r < 0.55 + 0.3 * Math.cos(a * 5) ? 1 : 0;
    case 'gem':
      if (Math.abs(x) + Math.abs(y) * 1.2 > 0.85) return 0;
      return y > 0.15 ? 2 : 1;
  }
}

/**
 * For every cell returns a palette slot: 0 = background, 1 = emblem colour, 2 = emblem detail.
 * Each face direction gets its own emblem, scaled to that face's extent.
 */
export function paintEmblems(surface: Surface): Uint8Array {
  const { dims } = surface.voxels;
  const out = new Uint8Array(surface.cells.length);
  for (const c of surface.cells) {
    const axis = c.n.findIndex((x) => x !== 0);
    const faceIdx = axis * 2 + (c.n[axis] > 0 ? 0 : 1);
    const [ua, va] = [0, 1, 2].filter((i) => i !== axis);
    const x = ((c.v[ua] + 0.5) / dims[ua]) * 2 - 1;
    const y = ((c.v[va] + 0.5) / dims[va]) * 2 - 1;
    out[c.id] = inside(EMBLEMS[faceIdx], x, y);
  }
  return out;
}
