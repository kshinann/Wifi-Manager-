export type V3 = [number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const eq = (a: V3, b: V3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const key = (a: V3) => `${a[0]},${a[1]},${a[2]}`;

/** The six axis-aligned unit directions. */
export const DIRS: V3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** Directions perpendicular to a face normal (the 4 ways to move along that face). */
export const tangents = (n: V3): V3[] => DIRS.filter((d) => dot(d, n) === 0);
