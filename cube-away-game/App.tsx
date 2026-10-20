import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CHAPTERS, LevelSpec, chapterOf, findLevel } from './src/data/chapters';
import { useProgress } from './src/state/progress';
import { initAudio, setSoundEnabled } from './src/services/audio';
import { setHapticsEnabled } from './src/services/haptics';
import { TitleScreen } from './src/screens/TitleScreen';
import { WorldMapScreen } from './src/screens/WorldMapScreen';
import { StoryScreen } from './src/screens/StoryScreen';
import { GameScreen } from './src/screens/GameScreen';

type Route =
  | { name: 'title' }
  | { name: 'map'; chapter: number }
  | { name: 'story'; chapter: number; part: 'intro' | 'outro'; then: Route }
  | { name: 'game'; levelId: string; attempt: number };

export default function App() {
  const { progress, update } = useProgress();
  const [route, setRoute] = useState<Route>({ name: 'title' });

  useEffect(() => {
    initAudio();
  }, []);
  useEffect(() => {
    if (!progress) return;
    setSoundEnabled(progress.sound);
    setHapticsEnabled(progress.haptics);
  }, [progress?.sound, progress?.haptics]);

  if (!progress) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1b3d' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  const openLevel = (level: LevelSpec) => {
    const ch = level.chapter;
    if (!progress.seenIntro[ch]) {
      update((p) => ({ ...p, seenIntro: { ...p.seenIntro, [ch]: true } }));
      setRoute({ name: 'story', chapter: ch, part: 'intro', then: { name: 'game', levelId: level.id, attempt: Date.now() } });
    } else setRoute({ name: 'game', levelId: level.id, attempt: Date.now() });
  };

  let screen: React.ReactNode;
  switch (route.name) {
    case 'title':
      screen = (
        <TitleScreen
          progress={progress}
          update={update}
          onPlay={() => {
            const last = [...CHAPTERS].reverse().find((c) => (progress.stars[c.levels[0].id] ?? 0) > 0 || c.id === 1)!;
            setRoute({ name: 'map', chapter: last.id });
          }}
        />
      );
      break;
    case 'map':
      screen = (
        <WorldMapScreen
          progress={progress}
          chapter={route.chapter}
          onChapter={(chapter) => setRoute({ name: 'map', chapter })}
          onLevel={openLevel}
          onStory={(chapter) => setRoute({ name: 'story', chapter, part: 'intro', then: { name: 'map', chapter } })}
          onBack={() => setRoute({ name: 'title' })}
        />
      );
      break;
    case 'story':
      screen = <StoryScreen chapter={CHAPTERS[route.chapter - 1]} part={route.part} onDone={() => setRoute(route.then)} />;
      break;
    case 'game': {
      const level = findLevel(route.levelId);
      screen = (
        <GameScreen
          key={`${level.id}:${route.attempt}`}
          level={level}
          progress={progress}
          update={update}
          onExit={() => setRoute({ name: 'map', chapter: level.chapter })}
          onReplay={() => setRoute({ name: 'game', levelId: level.id, attempt: Date.now() })}
          onNext={(next) => {
            const ch = chapterOf(level);
            const toMap: Route = { name: 'map', chapter: next?.chapter ?? ch.id };
            if (level.boss && !progress.seenOutro[ch.id]) {
              update((p) => ({ ...p, seenOutro: { ...p.seenOutro, [ch.id]: true } }));
              setRoute({ name: 'story', chapter: ch.id, part: 'outro', then: toMap });
            } else if (next) openLevel(next);
            else setRoute(toMap);
          }}
        />
      );
      break;
    }
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen}
    </SafeAreaProvider>
  );
}
