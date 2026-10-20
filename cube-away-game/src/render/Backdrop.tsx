import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { Theme } from '../data/chapters';

interface Props {
  theme: Theme;
  radius: number;
  /** Size of the puzzle, so particles float around it rather than inside it. */
  spread: number;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
}

const PARTICLES = 46;

/** Gradient sky dome (doubles as the drag-catcher for rotating) plus themed floating particles. */
export function Backdrop({ theme, radius, spread, ...handlers }: Props) {
  const dome = useMemo(() => {
    const g = new THREE.SphereGeometry(radius, 32, 24);
    const top = new THREE.Color(theme.bgTop);
    const bottom = new THREE.Color(theme.bgBottom);
    const pos = g.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.smoothstep(pos.getY(i) / radius, -0.6, 0.6);
      c.copy(bottom).lerp(top, t);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [theme, radius]);

  const kind = theme.particles;
  const particleGeom = useMemo(() => {
    switch (kind) {
      case 'bubbles':
        return new THREE.SphereGeometry(0.18, 10, 8);
      case 'leaves':
        return new THREE.CircleGeometry(0.22, 3).scale(1, 1.8, 1);
      case 'neon':
        return new THREE.BoxGeometry(0.08, 0.6, 0.08);
      case 'sand':
        return new THREE.TetrahedronGeometry(0.12);
      case 'stars':
        return new THREE.OctahedronGeometry(0.16);
    }
  }, [kind]);
  const particleColor = kind === 'stars' ? '#ffffff' : kind === 'neon' ? '#7df9ff' : theme.arrows[1];

  const seeds = useMemo(
    () =>
      Array.from({ length: PARTICLES }, (_, i) => {
        const a = (i / PARTICLES) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.6;
        const r = spread * (1.0 + ((i * 7919) % 97) / 60);
        return { a, r, y: (((i * 104729) % 200) / 100 - 1) * spread * 1.6, speed: 0.3 + ((i * 31) % 10) / 12, phase: i };
      }),
    [spread],
  );

  const mesh = useRef<THREE.InstancedMesh>(null!);
  const tmp = useMemo(() => ({ o: new THREE.Object3D() }), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const H = spread * 1.6;
    seeds.forEach((s, i) => {
      const o = tmp.o;
      const dir = kind === 'bubbles' || kind === 'neon' ? 1 : kind === 'stars' ? 0 : -1;
      let y = s.y + dir * t * s.speed;
      y = ((((y + H) % (2 * H)) + 2 * H) % (2 * H)) - H;
      o.position.set(Math.cos(s.a + t * 0.03) * s.r, y, Math.sin(s.a + t * 0.03) * s.r - spread * 0.8);
      o.rotation.set(t * s.speed + s.phase, t * 0.7 + s.phase, 0);
      const twinkle = kind === 'stars' ? 0.6 + 0.6 * Math.abs(Math.sin(t * 1.5 + s.phase)) : 1;
      o.scale.setScalar(twinkle * (0.7 + (i % 5) * 0.15) * Math.max(1, spread / 6));
      o.updateMatrix();
      mesh.current.setMatrixAt(i, o.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <mesh geometry={dome} {...handlers}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <instancedMesh ref={mesh} args={[particleGeom, undefined, PARTICLES]} frustumCulled={false}>
        <meshBasicMaterial color={particleColor} transparent opacity={kind === 'stars' ? 0.9 : 0.45} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}
