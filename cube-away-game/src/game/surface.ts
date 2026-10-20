import { DIRS, V3, add, key, neg } from './vec';
import { ShapeSpec, Voxels, buildVoxels } from './shapes';

/** One square face of one voxel that is exposed to the air: the playable grid cell. */
export interface Cell {
  id: number;
  v: V3;
  n: V3;
}

export type Step =
  | { kind: 'flat' | 'convex'; cell: number; dir: V3 }
  | { kind: 'wall' };

export interface Surface {
  voxels: Voxels;
  cells: Cell[];
  isSolid: (p: V3) => boolean;
  cellAt: (v: V3, n: V3) => number;
  /** Move from a cell one unit in tangent direction `d`, following the surface over convex edges. */
  step: (cell: number, d: V3) => Step;
  inBounds: (p: V3, margin?: number) => boolean;
}

const cellKey = (v: V3, n: V3) => `${key(v)}|${key(n)}`;

export function buildSurface(spec: ShapeSpec): Surface {
  const voxels = buildVoxels(spec);
  const { solid, dims } = voxels;
  const isSolid = (p: V3) => solid.has(key(p));
  const cells: Cell[] = [];
  const index = new Map<string, number>();

  // Iterate in a fixed order so ids are deterministic.
  for (let x = 0; x < dims[0]; x++)
    for (let y = 0; y < dims[1]; y++)
      for (let z = 0; z < dims[2]; z++) {
        const v: V3 = [x, y, z];
        if (!isSolid(v)) continue;
        for (const n of DIRS) {
          if (isSolid(add(v, n))) continue;
          const id = cells.length;
          cells.push({ id, v, n });
          index.set(cellKey(v, n), id);
        }
      }

  const cellAt = (v: V3, n: V3) => index.get(cellKey(v, n)) ?? -1;

  const step = (id: number, d: V3): Step => {
    const { v, n } = cells[id];
    const w = add(v, d);
    if (isSolid(w)) {
      // A solid voxel directly above the neighbour means a wall rises here (concave edge).
      if (isSolid(add(w, n))) return { kind: 'wall' };
      return { kind: 'flat', cell: cellAt(w, n), dir: d };
    }
    // Nothing next to us: the surface wraps down over a convex edge onto our own side face.
    return { kind: 'convex', cell: cellAt(v, d), dir: neg(n) };
  };

  const inBounds = (p: V3, margin = 1) =>
    p.every((c, i) => c >= -margin && c < dims[i] + margin);

  return { voxels, cells, isSolid, cellAt, step, inBounds };
}
