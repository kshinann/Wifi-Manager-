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
  { type: 'light', label: 'Smart Light', icon: 'bulb-outline' },
  { type: 'speaker', label: 'Smart Speaker', icon: 'volume-high-outline' },
];

export function protocolLabelFor(type: DeviceType): string {
  return getDriverForType(type).protocol;
}
