import { Device, DeviceState } from '../types/device';
import { RemoteDriver } from '../types/driver';
import { WifiProtocolAdapter } from '../wifi/protocols/types';

// Wraps a WifiProtocolAdapter (real HTTP calls to a Tasmota/Shelly device on
// the local network) as a RemoteDriver, so screens/context treat it exactly
// like the mock drivers.
function makeWifiHttpDriver(protocol: WifiProtocolAdapter): RemoteDriver {
  function requireHost(device: Device): string {
    if (!device.host) {
      throw new Error(`${device.name} has no IP address on file`);
    }
    return device.host;
  }

  return {
    id: protocol.id,
    label: protocol.label,
    protocol: `${protocol.label} · local WiFi (HTTP)`,
    supports: ['light'],
    commands: protocol.commands,

    createInitialState(): DeviceState {
      return { power: false };
    },

    async connect(device: Device): Promise<void> {
      await protocol.getState(requireHost(device));
    },

    async disconnect(): Promise<void> {
      // Stateless local HTTP device — nothing to tear down.
    },

    async getState(device: Device): Promise<DeviceState> {
      return protocol.getState(requireHost(device));
    },

    async sendCommand(device: Device, command): Promise<DeviceState> {
      return protocol.sendCommand(requireHost(device), command);
    },
  };
}

export { makeWifiHttpDriver };
