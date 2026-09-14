import { DeviceState } from '../../types/device';
import { RemoteCommand } from '../../types/driver';

export type WifiProtocolId = 'tasmota' | 'shelly';

export interface WifiProbeResult {
  protocolId: WifiProtocolId;
  host: string;
  deviceName: string;
  state: DeviceState;
}

// A protocol adapter knows how to talk to one real local-network smart-device
// firmware over plain HTTP. No cloud account, no vendor SDK.
export interface WifiProtocolAdapter {
  id: WifiProtocolId;
  label: string;
  // Supported remote commands for a bare relay/plug device.
  commands: RemoteCommand[];
  // Returns null when `host` doesn't speak this protocol (used during scanning).
  probe(host: string): Promise<WifiProbeResult | null>;
  getState(host: string): Promise<DeviceState>;
  sendCommand(host: string, command: RemoteCommand): Promise<DeviceState>;
}
