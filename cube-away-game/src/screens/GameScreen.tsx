import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Canvas } from '../render/Canvas';
import { PuzzleScene, SceneController } from '../render/PuzzleScene';
import { LevelSpec, chapterOf, nextLevel } from '../data/chapters';
import { buildLevel, starsFor } from '../game/level';
import { PuzzleState } from '../game/puzzle';
import { shapeLabel } from '../game/shapes';
import { Progress } from '../state/progress';
import { play } from '../services/audio';
import { haptic } from '../services/haptics';
import { maybeShowInterstitial, showRewardedAd } from '../services/monetization';
import { Button } from '../ui/Button';
import { shadow } from '../ui/theme';

interface Props {
  level: LevelSpec;
  progress: Progress;
  update: (fn: (p: Progress) => Progress) => void;
  onExit: () => void;
  onReplay: () => void;
  onNext: (next: LevelSpec | undefined) => void;
}

type Status = 'playing' | 'paused' | 'won' | 'lost';
const BONUS_SECONDS = 30;

let levelsCompleted = 0;

export function GameScreen({ level, progress, update, onExit, onReplay, onNext }: Props) {
  const chapter = chapterOf(level);
  const theme = chapter.theme;
  const built = useMemo(() => buildLevel(level), [level]);
  const puzzle = useMemo(() => new PuzzleState(built.surface, built.arrows), [built]);
  const scene = useRef<SceneController>(null);

  const [status, setStatus] = useState<Status>('playing');
  const [lostReason, setLostReason] = useState<'lives' | 'time'>('lives');
  const [mistakes, setMistakes] = useState(0);
  const [remaining, setRemaining] = useState(puzzle.remaining);
  const [timeLeft, setTimeLeft] = useState(built.timeLimit ?? 0);
  const [zoom, setZoom] = useState(1);
  const [stars, setStars] = useState(0);
  const [busy, setBusy] = useState(false);
  const livesLeft = level.lives - mistakes;
  const shake = useRef(new Animated.Value(0)).current;

  // ---------- timer ----------
  useEffect(() => {
    if (!built.timeLimit || status !== 'playing') return;
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [built.timeLimit, status]);

  useEffect(() => {
    if (built.timeLimit && timeLeft <= 0 && status === 'playing') lose('time');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const lose = (reason: 'lives' | 'time') => {
    setLostReason(reason);
    play('lose');
    haptic.error();
    setTimeout(() => setStatus('lost'), 500);
    setStatus('paused');
  };

  const win = () => {
    const s = starsFor(mistakes, level.lives);
    setStars(s);
    play('win');
    haptic.success();
    levelsCompleted++;
    update((p) => ({
      ...p,
      stars: { ...p.stars, [level.id]: Math.max(p.stars[level.id] ?? 0, s) },
      // Beating a boss for the first time awards a hint.
      hints: p.hints + (level.boss && !p.stars[level.id] ? 1 : 0),
    }));
    setTimeout(() => setStatus('won'), 900);
  };

  // ---------- taps ----------
  const onTapCell = useCallback(
    (cell: number) => {
      if (status !== 'playing') return;
      const id = puzzle.arrowNear(cell);
      if (id < 0) return;
      const res = puzzle.check(id);
      if (res.kind === 'exit') {
        puzzle.remove(id);
        scene.current?.exit(id);
        play('whoosh');
        haptic.light();
        setRemaining(puzzle.remaining);
        if (puzzle.remaining === 0) {
          setStatus('paused');
          win();
        }
      } else if (res.kind === 'blocked') {
        scene.current?.bump(id, res.blocker, res.distance);
        play('bump');
        haptic.error();
        Animated.sequence(
          [8, -8, 6, -6, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 45, useNativeDriver: true })),
        ).start();
        const m = mistakes + 1;
        setMistakes(m);
        if (level.lives - m <= 0) lose('lives');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, puzzle, mistakes],
  );

  // ---------- helpers ----------
  const onHint = async () => {
    if (status !== 'playing') return;
    if (progress.hints <= 0) {
      setBusy(true);
      const ok = await showRewardedAd('extra_hint');
      setBusy(false);
      if (ok) update((p) => ({ ...p, hints: p.hints + 2 }));
      return;
    }
    const free = puzzle.freeArrows();
    if (!free.length) return;
    scene.current?.hint(free[Math.floor(Math.random() * free.length)]);
    play('hint');
    update((p) => ({ ...p, hints: p.hints - 1 }));
  };

  /** Undo takes back the last mistake (arrows that escaped never need undoing: there are no dead ends). */
  const onUndo = async () => {
    if (mistakes === 0) return;
    if (progress.undos <= 0) {
      setBusy(true);
      const ok = await showRewardedAd('extra_undo');
      setBusy(false);
      if (ok) update((p) => ({ ...p, undos: p.undos + 1 }));
      return;
    }
    setMistakes((m) => m - 1);
    update((p) => ({ ...p, undos: p.undos - 1 }));
    if (status === 'lost') setStatus('playing');
  };

  const continueWithAd = async () => {
    setBusy(true);
    const ok = await showRewardedAd('continue');
    setBusy(false);
    if (!ok) return;
    if (lostReason === 'time') setTimeLeft((t) => Math.max(t, 0) + BONUS_SECONDS);
    else setMistakes((m) => m - 1);
    setStatus('playing');
  };

  const goNext = async () => {
    await maybeShowInterstitial(levelsCompleted);
    onNext(nextLevel(level));
  };

  // ---------- render ----------
  const total = built.arrows.length;
  const pct = total ? (total - remaining) / total : 1;
  const mm = Math.floor(Math.max(0, timeLeft) / 60);
  const ss = String(Math.max(0, timeLeft) % 60).padStart(2, '0');
  const lowTime = !!built.timeLimit && timeLeft <= 15;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bgBottom }}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: shake }] }}>
        <Canvas style={{ flex: 1 }} camera={{ position: [0, 0, 30], fov: 45, near: 0.1, far: 2000 }}>
          <PuzzleScene level={built} puzzle={puzzle} theme={theme} zoom={zoom} onTapCell={onTapCell} controller={scene} />
        </Canvas>
      </Animated.View>

      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Top HUD */}
        <View style={[styles.topBar, { backgroundColor: theme.ui }]}>
          <Pressable onPress={() => setStatus('paused')} hitSlop={10}>
            <Text style={styles.pause}>II</Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.levelTitle}>
              {level.boss ? '👑 BOSS · ' : ''}Level {level.id}
            </Text>
            <Text style={styles.levelSub}>{shapeLabel(level.shape)}</Text>
          </View>
          <Text style={styles.hearts}>{livesLeft > 5 ? `❤️×${livesLeft}` : '❤️'.repeat(Math.max(0, livesLeft)) + '🤍'.repeat(Math.max(0, Math.min(5, level.lives) - Math.max(0, livesLeft)))}</Text>
        </View>

        <View style={styles.subBar}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>⬆ {remaining}</Text>
          </View>
          {!!built.timeLimit && (
            <View style={[styles.chip, lowTime && { backgroundColor: '#ff2d55' }]}>
              <Text style={[styles.chipText, lowTime && { color: '#fff' }]}>⏱ {mm}:{ss}</Text>
            </View>
          )}
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: theme.emblem[1] }]} />
        </View>

        <View style={{ flex: 1 }} pointerEvents="box-none" />

        {/* Bottom tools */}
        <View style={styles.tools} pointerEvents="box-none">
          <Button small label="↩️ Undo" color="#0ea5e9" badge={progress.undos} disabled={mistakes === 0 || busy} onPress={onUndo} />
          <Button small label="💡 Hint" color="#f59e0b" badge={progress.hints || 'AD'} disabled={busy} onPress={onHint} />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button small label="－" color="#64748b" onPress={() => setZoom((z) => Math.max(0.6, z / 1.2))} />
            <Button small label="＋" color="#64748b" onPress={() => setZoom((z) => Math.min(2.5, z * 1.2))} />
            <Button small label="⟲" color="#64748b" onPress={() => { setZoom(1); scene.current?.resetView(); }} />
          </View>
        </View>
      </SafeAreaView>

      {/* Pause / win / lose overlays */}
      <Modal transparent animationType="fade" visible={status === 'paused' && remaining > 0 && livesLeft > 0 && (!built.timeLimit || timeLeft > 0)}>
        <Overlay title="Paused" color={theme.ui}>
          <Button label="Resume" color="#22c55e" onPress={() => setStatus('playing')} />
          <Button label="Restart" color="#f59e0b" onPress={onReplay} />
          <Button label="Map" color="#64748b" onPress={onExit} />
        </Overlay>
      </Modal>

      <Modal transparent animationType="slide" visible={status === 'won'}>
        <Overlay title={level.boss ? 'Boss defeated!' : 'Cube cleared!'} color={theme.ui}>
          <StarRow stars={stars} />
          <Text style={styles.resultText}>
            {mistakes === 0 ? 'Flawless!' : `${mistakes} mistake${mistakes > 1 ? 's' : ''}`}
            {built.timeLimit ? ` · ${mm}:${ss} left` : ''}
          </Text>
          <Button label={nextLevel(level) ? 'Next ▶' : 'Finish ▶'} color="#22c55e" onPress={goNext} />
          <Button label="Replay" small color="#f59e0b" onPress={onReplay} />
          <Button label="Map" small color="#64748b" onPress={onExit} />
        </Overlay>
      </Modal>

      <Modal transparent animationType="slide" visible={status === 'lost'}>
        <Overlay title={lostReason === 'time' ? "Time's up!" : 'Out of hearts!'} color="#ef4444">
          <Text style={styles.resultText}>{remaining} arrows left to untangle.</Text>
          {lostReason === 'lives' && progress.undos > 0 && (
            <Button label={`↩️ Undo last mistake (${progress.undos})`} color="#0ea5e9" onPress={onUndo} />
          )}
          <Button
            label={lostReason === 'time' ? `📺 +${BONUS_SECONDS}s (watch ad)` : '📺 +1 heart (watch ad)'}
            color="#8b5cf6"
            disabled={busy}
            onPress={continueWithAd}
          />
          <Button label="Retry" color="#f59e0b" onPress={onReplay} />
          <Button label="Map" small color="#64748b" onPress={onExit} />
        </Overlay>
      </Modal>
    </View>
  );
}

function Overlay({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { color }]}>{title}</Text>
        <View style={{ gap: 12, alignSelf: 'stretch' }}>{children}</View>
      </View>
    </View>
  );
}

function StarRow({ stars }: { stars: number }) {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      220,
      anims.map((a) => Animated.spring(a, { toValue: 1, friction: 4, useNativeDriver: true })),
    ).start();
  }, [anims]);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
      {anims.map((a, i) => (
        <Animated.Text
          key={i}
          style={{
            fontSize: i === 1 ? 64 : 50,
            opacity: i < stars ? 1 : 0.25,
            transform: [{ scale: a }, { translateY: i === 1 ? -10 : 0 }],
          }}
        >
          ⭐
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    ...shadow,
  },
  pause: { color: '#fff', fontSize: 22, fontWeight: '900', width: 30 },
  levelTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  levelSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  hearts: { fontSize: 14, minWidth: 30, textAlign: 'right' },
  subBar: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8 },
  chip: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4, ...shadow },
  chipText: { fontWeight: '900', fontSize: 16, color: '#1e293b' },
  progressTrack: { height: 8, marginHorizontal: 40, marginTop: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  tools: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(10,10,30,0.55)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '84%', backgroundColor: '#fff', borderRadius: 28, padding: 24, alignItems: 'center', gap: 16, ...shadow },
  cardTitle: { fontSize: 30, fontWeight: '900' },
  resultText: { fontSize: 17, fontWeight: '700', color: '#475569', textAlign: 'center' },
});
