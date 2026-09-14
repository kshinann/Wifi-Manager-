import { Device, DeviceState, DeviceType } from './device';

export type RemoteCommand =
  | 'power'
  | 'volumeUp'
  | 'volumeDown'
  | 'mute'
  | 'channelUp'
  | 'channelDown'
  | 'cycleInput'
  | 'tempUp'
  | 'tempDown'
  | 'cycleMode'
  | 'fanSpeedUp'
  | 'fanSpeedDown'
  | 'toggleOscillate'
  | 'brightnessUp'
  | 'brightnessDown'
  | 'cycleColor'
  | 'playPause';

// Every real integration (IR blaster, WiFi/UDP, Bluetooth, a cloud API, ...)
// implements this same interface so screens never depend on the transport.
export interface RemoteDriver {
  id: string;
  label: string;
  protocol: string;
  supports: DeviceType[];
  // Commands this driver actually implements, so screens can hide controls a
  // real device can't do (e.g. a bare relay only supports "power"). Omit to
  // mean "all commands for the device type" (used by the mock drivers).
  commands?: RemoteCommand[];
  createInitialState(type: DeviceType): DeviceState;
  connect(device: Device): Promise<void>;
  disconnect(device: Device): Promise<void>;
  // Reads the device's authoritative current state (used right after adding
  // a device, and for a manual refresh — a real device can change state
  // outside the app, e.g. a physical switch).
  getState(device: Device): Promise<DeviceState>;
  sendCommand(device: Device, command: RemoteCommand): Promise<DeviceState>;
}
