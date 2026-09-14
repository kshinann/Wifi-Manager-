import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RemoteButtonProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'default' | 'primary' | 'danger';
  size?: 'normal' | 'large';
}

export function RemoteButton({
  label,
  icon,
  onPress,
  disabled,
  busy,
  variant = 'default',
  size = 'normal',
}: RemoteButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        size === 'large' && styles.buttonLarge,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'danger' && styles.buttonDanger,
        (disabled || busy) && styles.buttonDisabled,
        pressed && !disabled && !busy && styles.buttonPressed,
      ]}
    >
      <View style={styles.content}>
        {busy ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? '#fff' : '#1f2937'}
          />
        ) : (
          <>
            {icon && (
              <Ionicons
                name={icon}
                size={size === 'large' ? 28 : 20}
                color={variant === 'primary' ? '#fff' : variant === 'danger' ? '#fff' : '#1f2937'}
              />
            )}
            <Text
              style={[
                styles.label,
                (variant === 'primary' || variant === 'danger') && styles.labelInverted,
              ]}
            >
              {label}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#eef1f6',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  buttonLarge: {
    paddingVertical: 20,
    minWidth: 120,
  },
  buttonPrimary: {
    backgroundColor: '#2563eb',
  },
  buttonDanger: {
    backgroundColor: '#dc2626',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  content: {
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  labelInverted: {
    color: '#fff',
  },
});
