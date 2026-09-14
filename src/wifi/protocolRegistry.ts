import { WifiProtocolAdapter, WifiProtocolId } from './protocols/types';
import { tasmotaAdapter } from './protocols/tasmota';
import { shellyAdapter } from './protocols/shelly';

// Add new local-network protocol adapters here (e.g. ESPHome's native API,
// Sonos UPnP, ...) to support more real WiFi devices.
export const WIFI_PROTOCOLS: WifiProtocolAdapter[] = [tasmotaAdapter, shellyAdapter];

export function getWifiProtocol(id: WifiProtocolId | string): WifiProtocolAdapter {
  const adapter = WIFI_PROTOCOLS.find((p) => p.id === id);
  if (!adapter) {
    throw new Error(`Unknown WiFi protocol "${id}"`);
  }
  return adapter;
}
