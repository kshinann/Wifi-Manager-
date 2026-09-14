import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Device, DeviceState, DeviceType } from '../types/device';
import { RemoteCommand } from '../types/driver';
import { getDriver, getDriverForType } from '../drivers/driverRegistry';
import { loadDevices, saveDevices } from '../storage/deviceStorage';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface AddDeviceParams {
  type: DeviceType;
  name: string;
  // Explicit driver + host for devices resolved outside the type->driver
  // default (WiFi devices found by scan, or entered manually by IP).
  driverId?: string;
  host?: string;
}

interface DevicesContextValue {
  devices: Device[];
  loading: boolean;
  addDevice: (params: AddDeviceParams) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  sendCommand: (deviceId: string, command: RemoteCommand) => Promise<void>;
  refreshDevice: (deviceId: string) => Promise<void>;
  pendingDeviceIds: string[];
}

const DevicesContext = createContext<DevicesContextValue | undefined>(undefined);

export function DevicesProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDeviceIds, setPendingDeviceIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const loaded = await loadDevices();
      setDevices(loaded);
      setLoading(false);

      // Real devices can change state while the app is closed (a physical
      // switch, another app). Re-sync them from the network on cold start,
      // rather than trusting whatever was last persisted.
      const realDevices = loaded.filter((d) => d.host);
      if (realDevices.length === 0) return;
      const realDeviceIds = realDevices.map((d) => d.id);
      setPendingDeviceIds((prev) => [...prev, ...realDeviceIds]);
      const results = await Promise.allSettled(
        realDevices.map(async (d) => ({ id: d.id, state: await getDriver(d.driverId).getState(d) }))
      );
      const freshStateById = new Map<string, DeviceState>();
      for (const result of results) {
        if (result.status === 'fulfilled') freshStateById.set(result.value.id, result.value.state);
      }
      setDevices((prev) =>
        prev.map((d) => {
          const state = freshStateById.get(d.id);
          return state ? { ...d, state } : d;
        })
      );
      setPendingDeviceIds((prev) => prev.filter((id) => !realDeviceIds.includes(id)));
    })();
  }, []);

  useEffect(() => {
    if (!loading) {
      saveDevices(devices);
    }
  }, [devices, loading]);

  const addDevice = useCallback(async ({ type, name, driverId, host }: AddDeviceParams) => {
    const driver = driverId ? getDriver(driverId) : getDriverForType(type);
    const device: Device = {
      id: generateId(),
      name,
      type,
      driverId: driver.id,
      host,
      state: driver.createInitialState(type),
    };
    await driver.connect(device);
    // A real device's actual current state (it may already be on, e.g. from
    // a physical switch) takes priority over the placeholder initial state.
    const state = await driver.getState(device);
    setDevices((prev) => [...prev, { ...device, state }]);
  }, []);

  const removeDevice = useCallback(async (deviceId: string) => {
    const device = devices.find((d) => d.id === deviceId);
    if (device) {
      // Fire-and-forget: a device that's already gone shouldn't block removal.
      getDriver(device.driverId).disconnect(device).catch(() => {});
    }
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
  }, [devices]);

  const sendCommand = useCallback(async (deviceId: string, command: RemoteCommand) => {
    setPendingDeviceIds((prev) => [...prev, deviceId]);
    try {
      const device = devices.find((d) => d.id === deviceId);
      if (!device) return;
      const driver = getDriver(device.driverId);
      const nextState = await driver.sendCommand(device, command);
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, state: nextState } : d))
      );
    } finally {
      setPendingDeviceIds((prev) => prev.filter((id) => id !== deviceId));
    }
  }, [devices]);

  const refreshDevice = useCallback(async (deviceId: string) => {
    setPendingDeviceIds((prev) => [...prev, deviceId]);
    try {
      const device = devices.find((d) => d.id === deviceId);
      if (!device) return;
      const driver = getDriver(device.driverId);
      const state = await driver.getState(device);
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? { ...d, state } : d)));
    } finally {
      setPendingDeviceIds((prev) => prev.filter((id) => id !== deviceId));
    }
  }, [devices]);

  const value = useMemo(
    () => ({
      devices,
      loading,
      addDevice,
      removeDevice,
      sendCommand,
      refreshDevice,
      pendingDeviceIds,
    }),
    [devices, loading, addDevice, removeDevice, sendCommand, refreshDevice, pendingDeviceIds]
  );

  return <DevicesContext.Provider value={value}>{children}</DevicesContext.Provider>;
}

export function useDevices(): DevicesContextValue {
  const ctx = useContext(DevicesContext);
  if (!ctx) {
    throw new Error('useDevices must be used within a DevicesProvider');
  }
  return ctx;
}
