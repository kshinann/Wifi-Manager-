import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { shadow } from './theme';

interface Props {
  label: string;
  onPress: () => void;
  color?: string;
  small?: boolean;
  disabled?: boolean;
  badge?: number | string;
  style?: ViewStyle;
}

export function Button({ label, onPress, color = '#6d5dfc', small, disabled, badge, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.small,
        { backgroundColor: color, opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
        style,
      ]}
    >
      <Text style={[styles.label, small && styles.smallLabel]}>{label}</Text>
      {badge !== undefined && (
        <Text style={styles.badge}>{badge}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.25)',
    ...shadow,
  },
  small: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16 },
  label: { color: '#fff', fontSize: 20, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 3 },
  smallLabel: { fontSize: 16 },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: '#ff3b5c',
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 22,
    overflow: 'hidden',
  },
});
