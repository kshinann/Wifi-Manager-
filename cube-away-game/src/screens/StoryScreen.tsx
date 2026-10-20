import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chapter } from '../data/chapters';

interface Props {
  chapter: Chapter;
  part: 'intro' | 'outro';
  onDone: () => void;
}

export function StoryScreen({ chapter, part, onDone }: Props) {
  const lines = part === 'intro' ? chapter.intro : chapter.outro;
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    Animated.spring(fade, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
  }, [i, fade]);

  const line = lines[i];
  const next = () => (i + 1 < lines.length ? setI(i + 1) : onDone());

  return (
    <LinearGradient colors={[chapter.theme.bgTop, chapter.theme.bgBottom]} style={{ flex: 1 }}>
      <Pressable style={{ flex: 1 }} onPress={next}>
        <SafeAreaView style={styles.root}>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.chapterIcon}>{chapter.icon}</Text>
            <Text style={styles.chapterLabel}>Chapter {chapter.id}</Text>
            <Text style={styles.chapterName}>{chapter.name}</Text>
          </View>

          <Animated.View
            style={[
              styles.bubbleWrap,
              { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] },
            ]}
          >
            <Text style={styles.avatar}>{line.avatar}</Text>
            <View style={styles.bubble}>
              <Text style={[styles.speaker, { color: chapter.theme.ui }]}>{line.speaker}</Text>
              <Text style={styles.text}>{line.text}</Text>
            </View>
          </Animated.View>

          <View style={styles.footer}>
            <Text style={styles.tap}>Tap to continue ({i + 1}/{lines.length})</Text>
            <Pressable onPress={onDone} hitSlop={12}>
              <Text style={styles.skip}>Skip ⏭</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', padding: 20 },
  chapterIcon: { fontSize: 72, marginTop: 30 },
  chapterLabel: { color: 'rgba(255,255,255,0.9)', fontWeight: '800', fontSize: 16, textTransform: 'uppercase', letterSpacing: 3 },
  chapterName: { color: '#fff', fontWeight: '900', fontSize: 34, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 },
  bubbleWrap: { alignItems: 'center' },
  avatar: { fontSize: 80, marginBottom: -10, zIndex: 1 },
  bubble: { backgroundColor: '#fff', borderRadius: 26, padding: 22, width: '100%', borderBottomWidth: 6, borderBottomColor: 'rgba(0,0,0,0.12)' },
  speaker: { fontWeight: '900', fontSize: 18, marginBottom: 6 },
  text: { fontSize: 19, lineHeight: 27, color: '#1e293b', fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tap: { color: '#fff', fontWeight: '700' },
  skip: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
