import { Ionicons } from '@expo/vector-icons';
import { DeviceType } from '../types/device';
import { getDriverForType } from './driverRegistry';

export interface DeviceTemplate {
  type: DeviceType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const DEVICE_CATALOG: DeviceTemplate[] = [
  { type: 'tv', label: 'TV', icon: 'tv-outline' },
  { type: 'ac', label: 'Air Conditioner', icon: 'snow-outline' },
  { type: 'fan', label: 'Fan', icon: 'aperture-outline' },
  { type: 'light', label: 'Smart Plug / Light', icon: 'bulb-outline' },
  { type: 'speaker', label: 'Smart Speaker', icon: 'volume-high-outline' },
];

export function protocolLabelFor(type: DeviceType): string {
  // 'light' has several drivers (scan/manual real WiFi, or the demo driver),
  // resolved at add-time rather than fixed per type, so it can't be looked
  // up from a single default driver like the other types.
  if (type === 'light') return 'WiFi · Tasmota / Shelly (local HTTP)';
  return getDriverForType(type).protocol;
}
