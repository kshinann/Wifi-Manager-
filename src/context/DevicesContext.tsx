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

interface DevicesContextValue {
  devices: Device[];
  loading: boolean;
  addDevice: (type: DeviceType, name: string) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  sendCommand: (deviceId: string, command: RemoteCommand) => Promise<void>;
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

  const addDevice = useCallback(async (type: DeviceType, name: string) => {
    const driver = getDriverForType(type);
    const device: Device = {
      id: generateId(),
      name,
      type,
      driverId: driver.id,
      state: driver.createInitialState(type),
    };
    await driver.connect(device);
    setDevices((prev) => [...prev, device]);
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

  const value = useMemo(
    () => ({ devices, loading, addDevice, removeDevice, sendCommand, pendingDeviceIds }),
    [devices, loading, addDevice, removeDevice, sendCommand, pendingDeviceIds]
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
