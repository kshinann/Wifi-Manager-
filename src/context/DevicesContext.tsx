import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Device, DeviceType } from '../types/device';
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
    loadDevices()
      .then(setDevices)
      .finally(() => setLoading(false));
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
    setDevices((prev) => {
      const device = prev.find((d) => d.id === deviceId);
      if (device) {
        getDriver(device.driverId).disconnect(device);
      }
      return prev.filter((d) => d.id !== deviceId);
    });
  }, []);

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
