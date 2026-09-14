import AsyncStorage from '@react-native-async-storage/async-storage';
import { Device } from '../types/device';

const STORAGE_KEY = '@universal-remote/devices';

export async function loadDevices(): Promise<Device[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Device[];
  } catch {
    return [];
  }
}

export async function saveDevices(devices: Device[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
}
