import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CHAPTERS, LevelSpec } from '../data/chapters';
import { Progress, isChapterUnlocked, isLevelUnlocked } from '../state/progress';
import { shapeLabel } from '../game/shapes';
import { shadow } from '../ui/theme';

interface Props {
  progress: Progress;
  chapter: number;
  onChapter: (id: number) => void;
  onLevel: (level: LevelSpec) => void;
  onStory: (chapter: number) => void;
  onBack: () => void;
}

const shapeIcon = (l: LevelSpec) =>
  ({ cube: '🧊', cuboid: '🧱', pyramid: '🛕', cross: '✳️' })[l.shape.kind];

export function WorldMapScreen({ progress, chapter, onChapter, onLevel, onStory, onBack }: Props) {
  const ch = CHAPTERS[chapter - 1];
  const { theme } = ch;
  const chStars = ch.levels.reduce((s, l) => s + (progress.stars[l.id] ?? 0), 0);

  return (
    <LinearGradient colors={[theme.bgTop, theme.bgBottom]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={styles.back}>‹ Home</Text>
          </Pressable>
          <Text style={styles.headerStars}>⭐ {chStars}/{ch.levels.length * 3}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {CHAPTERS.map((c) => {
            const open = isChapterUnlocked(progress, c.id);
            const active = c.id === chapter;
            return (
              <Pressable
                key={c.id}
                disabled={!open}
                onPress={() => onChapter(c.id)}
                style={[styles.tab, active && { backgroundColor: '#fff' }, !open && { opacity: 0.5 }]}
              >
                <Text style={styles.tabIcon}>{open ? c.icon : '🔒'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.titleBox}>
          <Text style={styles.chName}>
            {ch.icon} {ch.name}
          </Text>
          <Text style={styles.tagline}>{ch.tagline}</Text>
          <Pressable onPress={() => onStory(ch.id)}>
            <Text style={[styles.storyLink, { color: theme.ui }]}>📖 Replay story</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.path}>
          {ch.levels.map((l, i) => {
            const open = isLevelUnlocked(progress, l.id);
            const stars = progress.stars[l.id] ?? 0;
            const offset = Math.sin(i * 1.1) * 90;
            return (
              <View key={l.id} style={{ alignItems: 'center', transform: [{ translateX: offset }] }}>
                {i > 0 && <View style={[styles.connector, { backgroundColor: open ? '#fff' : 'rgba(255,255,255,0.35)' }]} />}
                <Pressable
                  disabled={!open}
                  onPress={() => onLevel(l)}
                  style={({ pressed }) => [
                    styles.node,
                    l.boss && styles.bossNode,
                    { backgroundColor: open ? theme.ui : '#94a3b8', transform: [{ scale: pressed ? 0.92 : 1 }] },
                  ]}
                >
                  <Text style={styles.nodeNum}>{open ? (l.boss ? '👑' : i + 1) : '🔒'}</Text>
                </Pressable>
                <Text style={styles.stars}>{[0, 1, 2].map((k) => (k < stars ? '★' : '☆')).join('')}</Text>
                <Text style={styles.nodeLabel}>
                  {shapeIcon(l)} {shapeLabel(l.shape)}
                  {l.secondsPerArrow ? '  ⏱' : ''}
                  {'  ' + '❤️'.repeat(Math.min(l.lives, 5))}
                </Text>
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8 },
  back: { color: '#fff', fontSize: 18, fontWeight: '900' },
  headerStars: { color: '#fff', fontSize: 18, fontWeight: '900' },
  tabs: { paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  tab: { width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 28 },
  titleBox: { alignItems: 'center', marginHorizontal: 18, padding: 14, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.9)', ...shadow },
  chName: { fontSize: 24, fontWeight: '900', color: '#1e293b' },
  tagline: { fontSize: 15, fontWeight: '600', color: '#475569', marginTop: 2 },
  storyLink: { marginTop: 6, fontWeight: '800' },
  path: { alignItems: 'center', paddingTop: 20 },
  connector: { width: 6, height: 26, borderRadius: 3, marginBottom: 4 },
  node: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: '#fff',
    ...shadow,
  },
  bossNode: { width: 92, height: 92, borderRadius: 46, borderColor: '#ffd60a' },
  nodeNum: { color: '#fff', fontSize: 28, fontWeight: '900' },
  stars: { color: '#ffd60a', fontSize: 20, fontWeight: '900', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 3 },
  nodeLabel: { color: '#fff', fontWeight: '800', fontSize: 12, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
});
