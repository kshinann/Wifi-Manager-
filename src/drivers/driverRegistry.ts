import { DeviceType } from '../types/device';
import { RemoteDriver } from '../types/driver';
import { mockIrDriver } from './mockIrDriver';
import { mockWifiDriver } from './mockWifiDriver';
import { makeWifiHttpDriver } from './wifiHttpDriver';
import { tasmotaAdapter } from '../wifi/protocols/tasmota';
import { shellyAdapter } from '../wifi/protocols/shelly';

export const tasmotaDriver = makeWifiHttpDriver(tasmotaAdapter);
export const shellyDriver = makeWifiHttpDriver(shellyAdapter);

// Register new transports here (a real IR blaster, Bluetooth, a hub API, ...)
// as they're built. Screens and context only ever go through this registry.
// `light` devices are added with an explicit driverId (chosen by scan result,
// manual entry, or the simulated/demo option) rather than resolved from type
// alone, since several drivers here support it.
const drivers: RemoteDriver[] = [mockIrDriver, tasmotaDriver, shellyDriver, mockWifiDriver];

const driversById = new Map(drivers.map((driver) => [driver.id, driver]));

export function getDriver(driverId: string): RemoteDriver {
  const driver = driversById.get(driverId);
  if (!driver) {
    throw new Error(`No driver registered with id "${driverId}"`);
  }
  return driver;
}

export function getDriverForType(type: DeviceType): RemoteDriver {
  const driver = drivers.find((d) => d.supports.includes(type));
  if (!driver) {
    throw new Error(`No driver supports device type "${type}"`);
  }
  return driver;
}

export function listDrivers(): RemoteDriver[] {
  return drivers;
}
