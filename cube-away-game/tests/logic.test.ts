import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_LEVELS } from '../src/data/chapters';
import { buildSurface } from '../src/game/surface';
import { generatePuzzle } from '../src/game/generator';
import { PuzzleState } from '../src/game/puzzle';
import { buildLevel } from '../src/game/level';
import { paintEmblems } from '../src/game/pictures';

test('cube surface has 6·n² cells', () => {
  for (const n of [3, 5, 8]) assert.equal(buildSurface({ kind: 'cube', size: n }).cells.length, 6 * n * n);
});

test('surface steps are symmetric (walking forward then back returns home)', () => {
  for (const shape of ALL_LEVELS.slice(0, 40).map((l) => l.shape)) {
    const s = buildSurface(shape);
    for (const c of s.cells) {
      for (const d of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]] as [number,number,number][]) {
        if (d[0]*c.n[0]+d[1]*c.n[1]+d[2]*c.n[2] !== 0) continue;
        const st = s.step(c.id, d);
        if (st.kind === 'wall') continue;
        assert.ok(st.cell >= 0, 'step lands on a real cell');
        const back = s.step(st.cell, [-st.dir[0], -st.dir[1], -st.dir[2]]);
        assert.ok(back.kind !== 'wall' && back.cell === c.id);
      }
    }
  }
});

test('generation is deterministic', () => {
  const spec = ALL_LEVELS[10];
  const a = generatePuzzle(buildSurface(spec.shape), spec);
  const b = generatePuzzle(buildSurface(spec.shape), spec);
  assert.deepEqual(a, b);
});

for (const spec of ALL_LEVELS) {
  test(`level ${spec.id} is solvable with greedy play and well filled`, () => {
    const lvl = buildLevel(spec);
    const p = new PuzzleState(lvl.surface, lvl.arrows);
    // Bodies are contiguous and never overlap.
    const seen = new Set<number>();
    for (const a of lvl.arrows) {
      assert.ok(a.cells.length >= spec.minLen && a.cells.length <= spec.maxLen);
      for (const c of a.cells) { assert.ok(!seen.has(c)); seen.add(c); }
      for (const r of a.ray) assert.ok(!a.cells.includes(r), 'ray never crosses own body');
    }
    const coverage = seen.size / lvl.surface.cells.length;
    assert.ok(coverage > 0.6, `coverage ${coverage.toFixed(2)}`);
    // Any order of free moves must clear the shape (no dead ends): pick pseudo-randomly.
    let k = 7;
    while (p.remaining > 0) {
      const free = p.freeArrows();
      assert.ok(free.length > 0, 'never stuck');
      p.remove(free[(k = (k * 31 + 17) % 9973) % free.length]);
    }
    if (spec.boss) assert.ok(paintEmblems(lvl.surface).some((x) => x > 0));
  });
}

test('print level stats', () => {
  for (const spec of ALL_LEVELS) {
    const l = buildLevel(spec);
    const p = new PuzzleState(l.surface, l.arrows);
    const cov = l.arrows.reduce((s, a) => s + a.cells.length, 0) / l.surface.cells.length;
    console.log(`${spec.id.padEnd(4)} cells=${String(l.surface.cells.length).padStart(5)} arrows=${String(l.arrows.length).padStart(4)} cover=${cov.toFixed(2)} freeAtStart=${p.freeArrows().length} time=${l.timeLimit ?? '-'}`);
  }
});
