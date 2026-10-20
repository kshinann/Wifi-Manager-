import * as THREE from 'three';
import { Arrow } from '../game/generator';
import { Surface } from '../game/surface';
import { V3 } from '../game/vec';

/** How far arrows float above the face so they never z-fight with it. */
const LIFT = 0.06;

/** Polyline an arrow travels along: its body (tail → head) then straight off into space. */
export interface Track {
  points: THREE.Vector3[];
  cum: number[];
  bodyLen: number;
  total: number;
}

export function cellCenter(surface: Surface, id: number, lift = 0): THREE.Vector3 {
  const { v, n } = surface.cells[id];
  return new THREE.Vector3(
    v[0] + 0.5 + n[0] * (0.5 + lift),
    v[1] + 0.5 + n[1] * (0.5 + lift),
    v[2] + 0.5 + n[2] * (0.5 + lift),
  );
}

export function buildTrack(surface: Surface, arrow: Arrow, far: number): Track {
  const pts: THREE.Vector3[] = [];
  arrow.cells.forEach((id, i) => {
    if (i > 0) {
      const a = surface.cells[arrow.cells[i - 1]];
      const b = surface.cells[id];
      if (a.n.join() !== b.n.join()) {
        // Wrapping over a convex edge: bend exactly on the edge line.
        const n: V3 = [a.n[0] + b.n[0], a.n[1] + b.n[1], a.n[2] + b.n[2]];
        pts.push(
          new THREE.Vector3(
            a.v[0] + 0.5 + n[0] * (0.5 + LIFT),
            a.v[1] + 0.5 + n[1] * (0.5 + LIFT),
            a.v[2] + 0.5 + n[2] * (0.5 + LIFT),
          ),
        );
      }
    }
    pts.push(cellCenter(surface, id, LIFT));
  });
  const head = pts[pts.length - 1];
  const d = new THREE.Vector3(...arrow.dir);
  pts.push(head.clone().addScaledVector(d, far));

  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  return { points: pts, cum, bodyLen: cum[cum.length - 2], total: cum[cum.length - 1] };
}

function sample(t: Track, s: number, out: THREE.Vector3) {
  const { points, cum } = t;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  return out.copy(points[i - 1]).lerp(points[i], (s - cum[i - 1]) / seg);
}

/** The visible part of the arrow once it has slid `s` units along its track. */
export function subPolyline(t: Track, s: number): THREE.Vector3[] {
  const s1 = s + t.bodyLen;
  const out = [sample(t, s, new THREE.Vector3())];
  for (let i = 0; i < t.points.length; i++) if (t.cum[i] > s + 1e-6 && t.cum[i] < s1 - 1e-6) out.push(t.points[i]);
  out.push(sample(t, s1, new THREE.Vector3()));
  return out;
}
