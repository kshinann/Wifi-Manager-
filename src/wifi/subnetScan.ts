import * as Network from 'expo-network';
import { WIFI_PROTOCOLS } from './protocolRegistry';
import { WifiProbeResult } from './protocols/types';

const CONCURRENCY = 32;
const LAST_OCTETS = Array.from({ length: 254 }, (_, i) => i + 1); // .1 - .254

export interface ScanHandle {
  cancel: () => void;
  done: Promise<void>;
}

// Assumes a standard /24 home WiFi subnet (255.255.255.0), which covers the
// vast majority of home routers. expo-network only exposes the device's own
// IP, not the subnet mask, so this is a reasonable default rather than
// something we can detect.
export async function getLocalSubnetBase(): Promise<string> {
  const ip = await Network.getIpAddressAsync();
  if (!ip || ip === '0.0.0.0') {
    throw new Error(
      "Could not read this device's WiFi IP address. Make sure WiFi is on and connected to your network."
    );
  }
  const parts = ip.split('.');
  if (parts.length !== 4) {
    throw new Error(`Unexpected IP address format: ${ip}`);
  }
  return parts.slice(0, 3).join('.');
}

export function scanLocalNetwork(
  subnetBase: string,
  onFound: (result: WifiProbeResult) => void
): ScanHandle {
  let cancelled = false;
  const hosts = LAST_OCTETS.map((n) => `${subnetBase}.${n}`);

  const done = (async () => {
    for (let i = 0; i < hosts.length && !cancelled; i += CONCURRENCY) {
      const batch = hosts.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (host) => {
          const probes = await Promise.all(WIFI_PROTOCOLS.map((protocol) => protocol.probe(host)));
          if (cancelled) return;
          const match = probes.find((result) => result !== null);
          if (match) onFound(match);
        })
      );
    }
  })();

  return {
    cancel: () => {
      cancelled = true;
    },
    done,
  };
}
