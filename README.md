# Universal Remote

A mobile universal remote control app built with Expo (React Native + TypeScript).

Add virtual devices (TV, AC, fan, smart light, smart speaker) and control them
from your phone with per-device-type layouts (volume/channel, temperature/mode,
brightness/color, etc).

## Device driver architecture

There's no real IR blaster or smart-home hardware wired up yet, so every
device is currently backed by a **mock driver** that simulates network/IR
latency and realistic state changes. The app is built around a
`RemoteDriver` interface (`src/types/driver.ts`) so a real integration can be
dropped in later without touching any screen:

- `src/types/driver.ts` — the `RemoteDriver` contract every integration implements.
- `src/drivers/mockIrDriver.ts` — simulates a traditional IR remote (TV, AC, fan).
- `src/drivers/mockWifiDriver.ts` — simulates a WiFi smart-home device (light, speaker).
- `src/drivers/driverRegistry.ts` — maps device types to the driver that handles them.

To wire up real hardware later, implement `RemoteDriver` (e.g. an IR-blaster
driver using `ConsumerIrManager` on Android, or a driver that speaks a real
device's local/WiFi API) and register it in `driverRegistry.ts` — the rest of
the app is unaffected.

## Project structure

```
App.tsx                        # navigation + providers
src/
  types/                       # Device, DeviceState, RemoteDriver, navigation types
  drivers/                     # driver interface implementations + registry
  context/DevicesContext.tsx   # device list state, persistence, command dispatch
  storage/deviceStorage.ts     # AsyncStorage persistence
  screens/                     # Home, AddDevice, DeviceControl
  components/                  # DeviceCard, RemoteButton
```

Devices are persisted locally on-device with `AsyncStorage`.

## Running the app

```
npm install
npm start        # then press i / a / w, or scan the QR code with Expo Go
```
