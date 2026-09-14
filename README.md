# Universal Remote

A mobile universal remote control app built with Expo (React Native + TypeScript).

Add devices (TV, AC, fan, smart plug/light, smart speaker) and control them
from your phone with per-device-type layouts (volume/channel, temperature/mode,
brightness/color, etc).

## WiFi devices are real, not simulated

Smart plug/light devices (`light` type) talk to **real local-network hardware**
over plain HTTP — no cloud account, no vendor app:

- **Tasmota** (`src/wifi/protocols/tasmota.ts`) — `GET /cm?cmnd=...`
- **Shelly Gen1** (`src/wifi/protocols/shelly.ts`) — `GET /relay/0`, `/shelly`

From the Add Device screen, "Smart Plug / Light" offers three ways to add one:

1. **Scan network** — reads your phone's own WiFi IP (`expo-network`), assumes
   a standard /24 subnet, and probes every host (`src/wifi/subnetScan.ts`) for
   a Tasmota or Shelly device, in parallel batches with a short timeout per host.
2. **Enter IP** — already know the device's IP? Add it directly.
3. **Try demo** — a simulated device, for trying the app without hardware.

Requirements to actually control a real device: your phone must be on the
same WiFi network as the device, and the device must already be set up
(joined to your WiFi, e.g. via the Tasmota/Shelly captured-portal first-run
flow) — this app only discovers and controls it afterwards, it doesn't do
initial device WiFi provisioning. If you later build a standalone app (not
Expo Go) with EAS, add `"android": { "usesCleartextTraffic": true }` to
`app.json` — these devices are local plain HTTP, not HTTPS.

TV/AC/fan remain **mock** drivers (simulated IR) — see below.

## Device driver architecture

The app is built around a `RemoteDriver` interface (`src/types/driver.ts`) so
any integration — real or simulated — is interchangeable and screens never
depend on the transport:

- `src/types/driver.ts` — the `RemoteDriver` contract every integration implements.
- `src/drivers/mockIrDriver.ts` — simulates a traditional IR remote (TV, AC, fan). No IR hardware wired up yet.
- `src/drivers/mockWifiDriver.ts` — simulated WiFi device, used for the speaker type and the "Try demo" light option.
- `src/drivers/wifiHttpDriver.ts` — wraps a real `WifiProtocolAdapter` (Tasmota/Shelly) as a driver.
- `src/wifi/` — the real network layer: HTTP probing, protocol adapters, subnet scanning.
- `src/drivers/driverRegistry.ts` — registers every driver; `light` devices pick one explicitly (scan result, manual entry, or demo) rather than a fixed type→driver mapping, since several drivers support it.

To add a new real integration (an IR blaster via `ConsumerIrManager`,
Bluetooth, ESPHome's API, Sonos, ...), implement `RemoteDriver` (or a
`WifiProtocolAdapter` for another local-HTTP device) and register it — the
rest of the app is unaffected.

## Project structure

```
App.tsx                        # navigation + providers
src/
  types/                       # Device, DeviceState, RemoteDriver, navigation types
  drivers/                     # driver interface implementations + registry
  wifi/                        # real local-network layer: HTTP probing, protocol adapters, subnet scan
  context/DevicesContext.tsx   # device list state, persistence, command dispatch
  storage/deviceStorage.ts     # AsyncStorage persistence
  screens/                     # Home, AddDevice, WifiDeviceSetup, DeviceControl
  components/                  # DeviceCard, RemoteButton
```

Devices are persisted locally on-device with `AsyncStorage`.

## Running the app

```
npm install
npm start        # then press i / a / w, or scan the QR code with Expo Go
```

To test real WiFi device control, run this on a phone with Expo Go, on the
same WiFi network as a Tasmota or Shelly device.
