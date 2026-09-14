import { DeviceType } from '../types/device';
import { RemoteDriver } from '../types/driver';
import { mockIrDriver } from './mockIrDriver';
import { mockWifiDriver } from './mockWifiDriver';

// Register new transports here (real IR blaster, Bluetooth, a hub API, ...)
// as they're built. Screens and context only ever go through this registry.
const drivers: RemoteDriver[] = [mockIrDriver, mockWifiDriver];

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
