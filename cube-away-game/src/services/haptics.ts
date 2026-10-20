import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let enabled = true;
export const setHapticsEnabled = (on: boolean) => (enabled = on);

const run = (fn: () => Promise<void>) => {
  if (!enabled || Platform.OS === 'web') return;
  fn().catch(() => {});
};

export const haptic = {
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
