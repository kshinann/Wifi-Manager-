import { fetchJson } from '../httpProbe';
import { WifiProtocolAdapter } from './types';

// Shelly Gen1 devices (https://shelly-api-docs.shelly.cloud/gen1/) expose an
// unauthenticated local HTTP API by default: GET /shelly identifies the
// device, GET/POST /relay/0 reads and controls the first relay channel.
async function shellyRequest(host: string, path: string, timeoutMs = 800): Promise<any> {
  return fetchJson(`http://${host}${path}`, timeoutMs);
}

export const shellyAdapter: WifiProtocolAdapter = {
  id: 'shelly',
  label: 'Shelly',
  commands: ['power'],

  async probe(host) {
    try {
      const info = await shellyRequest(host, '/shelly', 900);
      if (!info?.mac || !info?.type) return null;

      let deviceName = `Shelly ${String(info.mac).slice(-6)}`;
      try {
        const settings = await shellyRequest(host, '/settings', 700);
        if (settings?.name) deviceName = settings.name;
      } catch {
        // /settings can require auth on some firmware; the device is still usable.
      }

      const relay = await shellyRequest(host, '/relay/0', 700).catch(() => null);
      return {
        protocolId: 'shelly',
        host,
        deviceName,
        state: { power: Boolean(relay?.ison) },
      };
    } catch {
      return null;
    }
  },

  async getState(host) {
    const relay = await shellyRequest(host, '/relay/0', 1500);
    return { power: Boolean(relay?.ison) };
  },

  async sendCommand(host, command) {
    if (command === 'power') {
      const relay = await shellyRequest(host, '/relay/0?turn=toggle', 1500);
      return { power: Boolean(relay?.ison) };
    }
    return shellyAdapter.getState(host);
  },
};
