import { fetchJson } from '../httpProbe';
import { WifiProtocolAdapter } from './types';

// Tasmota (https://tasmota.github.io) exposes an unauthenticated local HTTP
// command API by default: GET /cm?cmnd=<command>. Firmware runs on cheap
// ESP8266/ESP32 smart plugs and switches.
async function tasmotaRequest(host: string, cmnd: string, timeoutMs = 800): Promise<any> {
  const url = `http://${host}/cm?cmnd=${encodeURIComponent(cmnd)}`;
  return fetchJson(url, timeoutMs);
}

export const tasmotaAdapter: WifiProtocolAdapter = {
  id: 'tasmota',
  label: 'Tasmota',
  commands: ['power'],

  async probe(host) {
    try {
      const data = await tasmotaRequest(host, 'Status 0', 900);
      const status = data?.Status;
      const sts = data?.StatusSTS;
      if (!status || !sts) return null;
      const friendlyName = Array.isArray(status.FriendlyName) ? status.FriendlyName[0] : undefined;
      return {
        protocolId: 'tasmota',
        host,
        deviceName: friendlyName || `Tasmota device (${host})`,
        state: { power: sts.POWER === 'ON' },
      };
    } catch {
      return null;
    }
  },

  async getState(host) {
    const data = await tasmotaRequest(host, 'Power', 1500);
    return { power: data?.POWER === 'ON' };
  },

  async sendCommand(host, command) {
    if (command === 'power') {
      const data = await tasmotaRequest(host, 'Power TOGGLE', 1500);
      return { power: data?.POWER === 'ON' };
    }
    return tasmotaAdapter.getState(host);
  },
};
