export type DeviceType = 'tv' | 'ac' | 'fan' | 'light' | 'speaker';

export interface DeviceState {
  power: boolean;
  volume?: number;
  channel?: number;
  input?: string;
  temperature?: number;
  mode?: 'cool' | 'heat' | 'fan' | 'auto';
  fanSpeed?: number;
  oscillating?: boolean;
  brightness?: number;
  color?: string;
  playing?: boolean;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  driverId: string;
  state: DeviceState;
}
