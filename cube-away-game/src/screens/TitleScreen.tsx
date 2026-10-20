import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';
import { Progress } from '../state/progress';
import { ALL_LEVELS } from '../data/chapters';
import { PRODUCTS, purchase } from '../services/monetization';

interface Props {
  progress: Progress;
  update: (fn: (p: Progress) => Progress) => void;
  onPlay: () => void;
}

export function TitleScreen({ progress, update, onPlay }: Props) {
  const bob = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const [panel, setPanel] = useState<'settings' | 'shop' | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true })).start();
  }, [bob, spin]);

  const totalStars = Object.values(progress.stars).reduce((a, b) => a + b, 0);

  return (
    <LinearGradient colors={['#1b1464', '#6d5dfc', '#ff7eb3']} style={{ flex: 1 }}>
      <SafeAreaView style={styles.root}>
        <View style={styles.logoWrap}>
          <Animated.Text
            style={[
              styles.cube,
              { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
            ]}
          >
            🧊
          </Animated.Text>
          <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }] }}>
            <Text style={styles.title}>Cube Quest</Text>
            <Text style={styles.subtitle}>— 3D Arrow Puzzle —</Text>
          </Animated.View>
        </View>

        <View style={styles.stats}>
          <Text style={styles.stat}>⭐ {totalStars} / {ALL_LEVELS.length * 3}</Text>
          <Text style={styles.stat}>💡 {progress.hints}</Text>
          <Text style={styles.stat}>↩️ {progress.undos}</Text>
        </View>

        <View style={{ gap: 14, width: '80%' }}>
          <Button label="▶  PLAY" color="#22c55e" onPress={onPlay} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button label="⚙️ Settings" small color="#4f46e5" style={{ flex: 1 }} onPress={() => setPanel('settings')} />
            <Button label="🛒 Shop" small color="#f59e0b" style={{ flex: 1 }} onPress={() => setPanel('shop')} />
          </View>
        </View>

        <Text style={styles.footer}>Untangle every Light Cube and free the realm.</Text>
      </SafeAreaView>

      <Modal transparent visible={panel !== null} animationType="fade" onRequestClose={() => setPanel(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPanel(null)}>
          <Pressable style={styles.panel} onPress={() => {}}>
            {panel === 'settings' ? (
              <>
                <Text style={styles.panelTitle}>Settings</Text>
                <Row label="🔊 Sound" value={progress.sound} onChange={(v) => update((p) => ({ ...p, sound: v }))} />
                <Row label="📳 Vibration" value={progress.haptics} onChange={(v) => update((p) => ({ ...p, haptics: v }))} />
              </>
            ) : (
              <>
                <Text style={styles.panelTitle}>Shop</Text>
                {PRODUCTS.map((prod) => (
                  <Button
                    key={prod.id}
                    small
                    color="#6d5dfc"
                    label={`${prod.title} · ${prod.price}`}
                    onPress={async () => setNotice((await purchase(prod.id)) ? 'Thanks!' : 'Store coming soon')}
                  />
                ))}
                {!!notice && <Text style={styles.notice}>{notice}</Text>}
              </>
            )}
            <Button label="Close" small color="#64748b" onPress={() => { setPanel(null); setNotice(''); }} />
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'space-evenly' },
  logoWrap: { alignItems: 'center' },
  cube: { fontSize: 96, marginBottom: 8 },
  title: {
    fontSize: 52,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: '#1b1464',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 0,
  },
  subtitle: { color: '#ffe066', fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  stats: { flexDirection: 'row', gap: 18, backgroundColor: 'rgba(255,255,255,0.18)', padding: 12, borderRadius: 20 },
  stat: { color: '#fff', fontSize: 18, fontWeight: '800' },
  footer: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  panel: { width: '85%', backgroundColor: '#fff', borderRadius: 24, padding: 22, gap: 14 },
  panelTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center', color: '#1b1464' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  notice: { textAlign: 'center', color: '#64748b', fontWeight: '700' },
});
