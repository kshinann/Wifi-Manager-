import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { ALL_LEVELS, CHAPTERS } from '../data/chapters';

export interface Progress {
  stars: Record<string, number>;
  seenIntro: Record<number, boolean>;
  seenOutro: Record<number, boolean>;
  hints: number;
  undos: number;
  sound: boolean;
  haptics: boolean;
}

const KEY = 'cubequest.progress.v1';
const DEFAULT: Progress = { stars: {}, seenIntro: {}, seenOutro: {}, hints: 3, undos: 3, sound: true, haptics: true };

export function isLevelUnlocked(p: Progress, levelId: string) {
  const i = ALL_LEVELS.findIndex((l) => l.id === levelId);
  return i === 0 || (p.stars[ALL_LEVELS[i - 1].id] ?? 0) > 0;
}

export function isChapterUnlocked(p: Progress, chapterId: number) {
  return isLevelUnlocked(p, CHAPTERS[chapterId - 1].levels[0].id);
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => setProgress(raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT))
      .catch(() => setProgress(DEFAULT));
  }, []);

  const update = useCallback((fn: (p: Progress) => Progress) => {
    setProgress((prev) => {
      const next = fn(prev ?? DEFAULT);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { progress, update };
}
