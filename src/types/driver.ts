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
  createInitialState(type: DeviceType): DeviceState;
  connect(device: Device): Promise<void>;
  disconnect(device: Device): Promise<void>;
  sendCommand(device: Device, command: RemoteCommand): Promise<DeviceState>;
}
