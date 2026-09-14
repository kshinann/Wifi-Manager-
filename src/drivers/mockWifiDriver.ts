import { Device, DeviceState, DeviceType } from '../types/device';
import { RemoteCommand, RemoteDriver } from '../types/driver';
import { simulateLatency } from './mockLatency';

const COLORS = ['#F5C518', '#FF6B6B', '#4ECDC4', '#5B7CFA', '#FFFFFF'];

// Simulates a WiFi smart-home device reached over the local network. A real
// build would swap this for a driver speaking the device's actual local API
// (or a cloud API), without the rest of the app changing.
export const mockWifiDriver: RemoteDriver = {
  id: 'mock-wifi',
  label: 'Mock WiFi Device',
  protocol: 'WiFi (simulated)',
  supports: ['light', 'speaker'],

  createInitialState(type: DeviceType): DeviceState {
    switch (type) {
      case 'light':
        return { power: false, brightness: 80, color: COLORS[0] };
      case 'speaker':
        return { power: false, volume: 30, playing: false };
      default:
        return { power: false };
    }
  },

  async connect(): Promise<void> {
    await simulateLatency(200, 500);
  },

  async disconnect(): Promise<void> {
    await simulateLatency(50, 100);
  },

  async sendCommand(device: Device, command: RemoteCommand): Promise<DeviceState> {
    await simulateLatency(80, 220);
    const state: DeviceState = { ...device.state };

    switch (command) {
      case 'power':
        state.power = !state.power;
        if (!state.power) state.playing = false;
        return state;
      case 'brightnessUp':
        if (state.power) state.brightness = Math.min(100, (state.brightness ?? 0) + 10);
        return state;
      case 'brightnessDown':
        if (state.power) state.brightness = Math.max(0, (state.brightness ?? 0) - 10);
        return state;
      case 'cycleColor':
        if (state.power) {
          const idx = COLORS.indexOf(state.color ?? COLORS[0]);
          state.color = COLORS[(idx + 1) % COLORS.length];
        }
        return state;
      case 'volumeUp':
        if (state.power) state.volume = Math.min(100, (state.volume ?? 0) + 5);
        return state;
      case 'volumeDown':
        if (state.power) state.volume = Math.max(0, (state.volume ?? 0) - 5);
        return state;
      case 'playPause':
        if (state.power) state.playing = !state.playing;
        return state;
      default:
        return state;
    }
  },
};
