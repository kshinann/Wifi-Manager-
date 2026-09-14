import { Device, DeviceState, DeviceType } from '../types/device';
import { RemoteCommand, RemoteDriver } from '../types/driver';
import { simulateLatency } from './mockLatency';

const MODES: NonNullable<DeviceState['mode']>[] = ['cool', 'heat', 'fan', 'auto'];
const INPUTS = ['HDMI 1', 'HDMI 2', 'HDMI 3', 'AV', 'TV Tuner'];

// Simulates a traditional infrared remote (TV / AC / fan). A real build would
// swap this for a driver that talks to an IR blaster or ConsumerIrManager,
// without the rest of the app changing.
export const mockIrDriver: RemoteDriver = {
  id: 'mock-ir',
  label: 'Mock IR Remote',
  protocol: 'IR (simulated)',
  supports: ['tv', 'ac', 'fan'],

  createInitialState(type: DeviceType): DeviceState {
    switch (type) {
      case 'tv':
        return { power: false, volume: 20, channel: 1, input: INPUTS[0] };
      case 'ac':
        return { power: false, temperature: 24, mode: 'cool', fanSpeed: 2 };
      case 'fan':
        return { power: false, fanSpeed: 1, oscillating: false };
      default:
        return { power: false };
    }
  },

  async connect(): Promise<void> {
    await simulateLatency();
  },

  async disconnect(): Promise<void> {
    await simulateLatency(50, 100);
  },

  async getState(device: Device): Promise<DeviceState> {
    return device.state;
  },

  async sendCommand(device: Device, command: RemoteCommand): Promise<DeviceState> {
    await simulateLatency();
    const state: DeviceState = { ...device.state };

    switch (command) {
      case 'power':
        state.power = !state.power;
        return state;
      // Every command below only takes effect while the device is powered on,
      // mirroring how a real IR remote is ignored while the appliance is off.
      case 'volumeUp':
        if (state.power) state.volume = Math.min(100, (state.volume ?? 0) + 5);
        return state;
      case 'volumeDown':
        if (state.power) state.volume = Math.max(0, (state.volume ?? 0) - 5);
        return state;
      case 'mute':
        if (state.power) state.volume = (state.volume ?? 0) > 0 ? 0 : 20;
        return state;
      case 'channelUp':
        if (state.power) state.channel = (state.channel ?? 1) + 1;
        return state;
      case 'channelDown':
        if (state.power) state.channel = Math.max(1, (state.channel ?? 1) - 1);
        return state;
      case 'cycleInput':
        if (state.power) {
          const idx = INPUTS.indexOf(state.input ?? INPUTS[0]);
          state.input = INPUTS[(idx + 1) % INPUTS.length];
        }
        return state;
      case 'tempUp':
        if (state.power) state.temperature = Math.min(30, (state.temperature ?? 24) + 1);
        return state;
      case 'tempDown':
        if (state.power) state.temperature = Math.max(16, (state.temperature ?? 24) - 1);
        return state;
      case 'cycleMode':
        if (state.power) {
          const idx = MODES.indexOf(state.mode ?? 'cool');
          state.mode = MODES[(idx + 1) % MODES.length];
        }
        return state;
      case 'fanSpeedUp':
        if (state.power) state.fanSpeed = Math.min(5, (state.fanSpeed ?? 1) + 1);
        return state;
      case 'fanSpeedDown':
        if (state.power) state.fanSpeed = Math.max(1, (state.fanSpeed ?? 1) - 1);
        return state;
      case 'toggleOscillate':
        if (state.power) state.oscillating = !state.oscillating;
        return state;
      default:
        return state;
    }
  },
};
