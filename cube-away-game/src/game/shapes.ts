import { V3, key } from './vec';

export type ShapeSpec =
  | { kind: 'cube'; size: number }
  | { kind: 'cuboid'; size: V3 }
  /** Stepped "ziggurat" pyramid: square tiers that shrink by 1 on every side. */
  | { kind: 'pyramid'; base: number; tierHeight: number }
  /** 3D plus sign: three orthogonal bars of length `size` and thickness `arm`. */
  | { kind: 'cross'; size: number; arm: number };

export interface Voxels {
  solid: Set<string>;
  dims: V3;
}

export function shapeLabel(spec: ShapeSpec): string {
  switch (spec.kind) {
    case 'cube':
      return `Cube ${spec.size}×${spec.size}`;
    case 'cuboid':
      return `Block ${spec.size.join('×')}`;
    case 'pyramid':
      return `Pyramid ${spec.base}`;
    case 'cross':
      return `Star Cross ${spec.size}`;
  }
}

export function buildVoxels(spec: ShapeSpec): Voxels {
  const solid = new Set<string>();
  const put = (x: number, y: number, z: number) => solid.add(key([x, y, z]));
  let dims: V3;

  switch (spec.kind) {
    case 'cube':
    case 'cuboid': {
      dims = spec.kind === 'cube' ? [spec.size, spec.size, spec.size] : spec.size;
      for (let x = 0; x < dims[0]; x++)
        for (let y = 0; y < dims[1]; y++) for (let z = 0; z < dims[2]; z++) put(x, y, z);
      break;
    }
    case 'pyramid': {
      const { base, tierHeight } = spec;
      const tiers = Math.ceil(base / 2);
      dims = [base, tiers * tierHeight, base];
      for (let t = 0; t < tiers; t++) {
        const lo = t;
        const hi = base - 1 - t;
        if (hi < lo) break;
        for (let y = t * tierHeight; y < (t + 1) * tierHeight; y++)
          for (let x = lo; x <= hi; x++) for (let z = lo; z <= hi; z++) put(x, y, z);
      }
      break;
    }
    case 'cross': {
      const { size, arm } = spec;
      dims = [size, size, size];
      const lo = Math.floor((size - arm) / 2);
      const hi = lo + arm - 1;
      const inArm = (v: number) => v >= lo && v <= hi;
      for (let x = 0; x < size; x++)
        for (let y = 0; y < size; y++)
          for (let z = 0; z < size; z++) {
            const n = (inArm(x) ? 1 : 0) + (inArm(y) ? 1 : 0) + (inArm(z) ? 1 : 0);
            if (n >= 2) put(x, y, z);
          }
      break;
    }
  }
  return { solid, dims };
}
