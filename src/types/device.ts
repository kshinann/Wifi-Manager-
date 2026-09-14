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
  // IP address on the local network, for drivers that talk to a real device
  // over HTTP (e.g. Tasmota, Shelly). Unused by mock/simulated drivers.
  host?: string;
  state: DeviceState;
}
