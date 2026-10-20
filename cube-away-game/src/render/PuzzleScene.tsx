import React, { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { BuiltLevel } from '../game/level';
import { PuzzleState } from '../game/puzzle';
import { paintEmblems } from '../game/pictures';
import { Theme } from '../data/chapters';
import { Track, buildTrack, subPolyline } from './tracks';
import { Backdrop } from './Backdrop';

export interface SceneController {
  exit: (id: number) => void;
  bump: (id: number, blocker: number, distance: number) => void;
  hint: (id: number) => void;
  resetView: () => void;
}

interface Props {
  level: BuiltLevel;
  puzzle: PuzzleState;
  theme: Theme;
  zoom: number;
  onTapCell: (cell: number) => void;
  controller: React.Ref<SceneController>;
}

type Anim =
  | { kind: 'exit'; t: number; dist: number }
  | { kind: 'bump'; t: number; dist: number };

const RADIUS = 0.11;
const HEAD_LEN = 0.42;
const UP = new THREE.Vector3(0, 1, 0);
const RED = new THREE.Color('#ff2d55');
const GLOW = new THREE.Color('#ffd60a');
const INITIAL = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, -0.75, 0));

export function PuzzleScene({ level, puzzle, theme, zoom, onTapCell, controller }: Props) {
  const { surface, arrows, spec } = level;
  const dims = surface.voxels.dims;
  const maxDim = Math.max(...dims);
  const { camera } = useThree();

  const group = useRef<THREE.Group>(null!);
  const segMesh = useRef<THREE.InstancedMesh>(null!);
  const jointMesh = useRef<THREE.InstancedMesh>(null!);
  const headMesh = useRef<THREE.InstancedMesh>(null!);
  const anims = useRef(new Map<number, Anim>());
  const flashes = useRef(new Map<number, { color: THREE.Color; until: number }>());
  const spin = useRef({ vx: 0, vy: 0, intro: 0 });

  // ---------- static data ----------
  const tracks = useMemo<Track[]>(() => arrows.map((a) => buildTrack(surface, a, maxDim * 3)), [arrows, surface, maxDim]);
  const slots = useMemo(() => {
    let seg = 0;
    return tracks.map((t) => {
      const start = seg;
      seg += t.points.length + 1;
      return { start, cap: t.points.length + 1 };
    });
  }, [tracks]);
  const totalSlots = slots.length ? slots[slots.length - 1].start + slots[slots.length - 1].cap : 1;
  const arrowColors = useMemo(() => arrows.map((a) => new THREE.Color(theme.arrows[a.id % theme.arrows.length])), [arrows, theme]);

  const geoms = useMemo(() => {
    const head = new THREE.ConeGeometry(RADIUS * 2.3, HEAD_LEN, 12);
    head.translate(0, HEAD_LEN * 0.3, 0);
    return {
      seg: new THREE.CylinderGeometry(RADIUS, RADIUS, 1, 8),
      joint: new THREE.SphereGeometry(RADIUS, 10, 8),
      head,
    };
  }, []);

  // ---------- surface (one quad per cell, vertex coloured) ----------
  const emblem = useMemo(() => (spec.boss ? paintEmblems(surface) : null), [spec.boss, surface]);
  const revealed = useMemo(() => {
    // On boss stages the bare cells already show their part of the picture.
    const r = new Uint8Array(surface.cells.length).fill(emblem ? 1 : 0);
    for (const a of arrows) for (const c of a.cells) r[c] = 0;
    return r;
  }, [arrows, surface, emblem]);

  const surfaceGeom = useMemo(() => {
    const pos: number[] = [];
    const idx: number[] = [];
    for (const c of surface.cells) {
      const axis = c.n.findIndex((x) => x !== 0);
      const [ua, va] = [0, 1, 2].filter((i) => i !== axis);
      const base = [c.v[0] + 0.5, c.v[1] + 0.5, c.v[2] + 0.5];
      base[axis] += c.n[axis] * 0.5;
      const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
      for (const [du, dv] of corners) {
        const p = base.slice();
        p[ua] += du;
        p[va] += dv;
        pos.push(p[0], p[1], p[2]);
      }
      const o = c.id * 4;
      // Keep counter-clockwise winding when seen from outside.
      const flip = (c.n[axis] > 0) !== ((axis === 1) as boolean);
      if (flip) idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
      else idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(surface.cells.length * 12), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [surface]);

  const palette = useMemo(
    () => ({
      a: new THREE.Color(theme.surface),
      b: new THREE.Color(theme.surfaceAlt),
      cleared: new THREE.Color(theme.cleared),
      e1: new THREE.Color(theme.emblem[0]),
      e2: new THREE.Color(theme.emblem[1]),
    }),
    [theme],
  );

  const paintCell = (id: number) => {
    const c = surface.cells[id];
    const attr = surfaceGeom.getAttribute('color') as THREE.BufferAttribute;
    const base = ((c.v[0] + c.v[1] + c.v[2]) & 1 ? palette.a : palette.b).clone();
    const slot = emblem ? emblem[id] : 0;
    if (slot) {
      base.lerp(slot === 1 ? palette.e1 : palette.e2, revealed[id] ? 1 : 0.12);
    } else if (revealed[id]) {
      base.lerp(palette.cleared, 0.55);
    }
    for (let k = 0; k < 4; k++) attr.setXYZ(id * 4 + k, base.r, base.g, base.b);
    attr.needsUpdate = true;
  };

  useEffect(() => {
    for (const c of surface.cells) paintCell(c.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaceGeom, palette, revealed]);

  // ---------- instance writing ----------
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), d: new THREE.Vector3(), s: new THREE.Vector3(), zero: new THREE.Matrix4().makeScale(0, 0, 0), c: new THREE.Color() }),
    [],
  );

  const writeArrow = (id: number, s: number, hidden = false) => {
    const { start, cap } = slots[id];
    const pts = hidden ? [] : subPolyline(tracks[id], s);
    for (let k = 0; k < cap; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      if (a && b && a.distanceToSquared(b) > 1e-8) {
        tmp.d.subVectors(b, a);
        const l = tmp.d.length();
        tmp.q.setFromUnitVectors(UP, tmp.d.divideScalar(l));
        tmp.p.addVectors(a, b).multiplyScalar(0.5);
        tmp.m.compose(tmp.p, tmp.q, tmp.s.set(1, l, 1));
        segMesh.current.setMatrixAt(start + k, tmp.m);
      } else segMesh.current.setMatrixAt(start + k, tmp.zero);
      if (a && k < pts.length - 1) {
        tmp.m.makeTranslation(a.x, a.y, a.z);
        jointMesh.current.setMatrixAt(start + k, tmp.m);
      } else jointMesh.current.setMatrixAt(start + k, tmp.zero);
    }
    if (pts.length >= 2) {
      const end = pts[pts.length - 1];
      tmp.d.subVectors(end, pts[pts.length - 2]).normalize();
      tmp.q.setFromUnitVectors(UP, tmp.d);
      tmp.m.compose(end, tmp.q, tmp.s.set(1, 1, 1));
      headMesh.current.setMatrixAt(id, tmp.m);
    } else headMesh.current.setMatrixAt(id, tmp.zero);
  };

  const colorArrow = (id: number, color: THREE.Color) => {
    const { start, cap } = slots[id];
    for (let k = 0; k < cap; k++) {
      segMesh.current.setColorAt(start + k, color);
      jointMesh.current.setColorAt(start + k, color);
    }
    headMesh.current.setColorAt(id, color);
  };

  const flushInstances = () => {
    for (const m of [segMesh.current, jointMesh.current, headMesh.current]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  };

  useEffect(() => {
    for (const a of arrows) {
      writeArrow(a.id, 0, !puzzle.alive[a.id]);
      colorArrow(a.id, arrowColors[a.id]);
    }
    flushInstances();
    group.current.quaternion.copy(INITIAL);
    spin.current.intro = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrows, puzzle]);

  useImperativeHandle(controller, () => ({
    exit: (id) => {
      anims.current.set(id, { kind: 'exit', t: 0, dist: tracks[id].total - tracks[id].bodyLen });
      for (const c of arrows[id].cells) {
        revealed[c] = 1;
        paintCell(c);
      }
    },
    bump: (id, blocker, distance) => {
      anims.current.set(id, { kind: 'bump', t: 0, dist: distance + 0.3 });
      const until = performance.now() + 450;
      flashes.current.set(id, { color: RED, until });
      flashes.current.set(blocker, { color: RED, until });
    },
    hint: (id) => flashes.current.set(id, { color: GLOW, until: performance.now() + 2400 }),
    resetView: () => {
      group.current.quaternion.copy(INITIAL);
      spin.current.vx = spin.current.vy = 0;
    },
  }));

  // ---------- per-frame ----------
  const camDist = maxDim * 2.3 + 3;
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    let dirty = false;

    for (const [id, a] of anims.current) {
      if (a.kind === 'exit') {
        a.t += step / 0.75;
        const e = Math.min(1, a.t);
        writeArrow(id, e * e * a.dist, a.t >= 1);
        if (a.t >= 1) anims.current.delete(id);
      } else {
        a.t += step / 0.38;
        writeArrow(id, Math.sin(Math.PI * Math.min(1, a.t)) * a.dist);
        if (a.t >= 1) {
          writeArrow(id, 0);
          anims.current.delete(id);
        }
      }
      dirty = true;
    }

    const now = performance.now();
    for (const [id, f] of flashes.current) {
      if (now >= f.until) {
        colorArrow(id, arrowColors[id]);
        flashes.current.delete(id);
      } else {
        const pulse = 0.5 + 0.5 * Math.sin(now / 90);
        colorArrow(id, tmp.c.copy(arrowColors[id]).lerp(f.color, 0.35 + 0.65 * pulse));
      }
      dirty = true;
    }
    if (dirty) flushInstances();

    // Inertial rotation + intro spin-in.
    const sp = spin.current;
    if (sp.intro > 0) {
      sp.intro = Math.max(0, sp.intro - step * 1.4);
      const k = sp.intro * sp.intro;
      group.current.scale.setScalar(1 - 0.35 * k);
      group.current.rotation.y += k * step * 6;
    }
    if (Math.abs(sp.vx) + Math.abs(sp.vy) > 1e-4) {
      rotateBy(sp.vx * step, sp.vy * step);
      sp.vx *= Math.pow(0.04, step);
      sp.vy *= Math.pow(0.04, step);
    }

    const target = camDist / zoom;
    camera.position.z += (target - camera.position.z) * Math.min(1, step * 8);
  });

  // ---------- input: drag to rotate, tap to fire ----------
  const qa = useMemo(() => new THREE.Quaternion(), []);
  const rotateBy = (ax: number, ay: number) => {
    qa.setFromAxisAngle(UP, ax);
    group.current.quaternion.premultiply(qa);
    qa.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ay);
    group.current.quaternion.premultiply(qa);
  };

  const drag = useRef<{ x: number; y: number; moved: number; cell: number; t: number } | null>(null);
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const isSurface = e.object.userData.surface === true && e.faceIndex != null;
    drag.current = { x: e.pointer.x, y: e.pointer.y, moved: 0, cell: isSurface ? Math.floor(e.faceIndex! / 2) : -1, t: performance.now() };
    spin.current.vx = spin.current.vy = 0;
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const d = drag.current;
    if (!d) return;
    const dx = e.pointer.x - d.x;
    const dy = e.pointer.y - d.y;
    d.x = e.pointer.x;
    d.y = e.pointer.y;
    d.moved += Math.abs(dx) + Math.abs(dy);
    if (d.moved > 0.02) {
      rotateBy(dx * 2.6, dy * 2.6);
      spin.current.vx = dx * 60;
      spin.current.vy = dy * 60;
    }
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const d = drag.current;
    drag.current = null;
    if (d && d.moved <= 0.02 && d.cell >= 0 && performance.now() - d.t < 600) onTapCell(d.cell);
  };
  const handlers = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp };

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[6, 10, 12]} intensity={1.1} />
      <directionalLight position={[-8, -4, 6]} intensity={0.35} />
      <Backdrop theme={theme} radius={Math.max(90, maxDim * 6)} spread={maxDim} {...handlers} />
      <group ref={group}>
        <group position={[-dims[0] / 2, -dims[1] / 2, -dims[2] / 2]}>
          <mesh geometry={surfaceGeom} userData={{ surface: true }} {...handlers}>
            <meshLambertMaterial vertexColors />
          </mesh>
          <instancedMesh ref={segMesh} args={[geoms.seg, undefined, totalSlots]} frustumCulled={false}>
            <meshLambertMaterial />
          </instancedMesh>
          <instancedMesh ref={jointMesh} args={[geoms.joint, undefined, totalSlots]} frustumCulled={false}>
            <meshLambertMaterial />
          </instancedMesh>
          <instancedMesh ref={headMesh} args={[geoms.head, undefined, Math.max(1, arrows.length)]} frustumCulled={false}>
            <meshLambertMaterial />
          </instancedMesh>
        </group>
      </group>
    </>
  );
}
