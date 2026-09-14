import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Device } from '../types/device';
import { DEVICE_CATALOG } from '../drivers/deviceCatalog';
import { getDriver } from '../drivers/driverRegistry';

interface DeviceCardProps {
  device: Device;
  busy: boolean;
  onPress: () => void;
  onTogglePower: () => void;
}

export function DeviceCard({ device, busy, onPress, onTogglePower }: DeviceCardProps) {
  const template = DEVICE_CATALOG.find((t) => t.type === device.type);
  const driver = getDriver(device.driverId);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.iconWrap, device.state.power && styles.iconWrapOn]}>
        <Ionicons name={template?.icon ?? 'radio-outline'} size={26} color={device.state.power ? '#2563eb' : '#6b7280'} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{device.name}</Text>
        <Text style={styles.meta}>
          {template?.label ?? device.type} · {driver.protocol}
        </Text>
      </View>
      <Pressable
        onPress={onTogglePower}
        disabled={busy}
        style={[styles.powerButton, device.state.power && styles.powerButtonOn]}
        hitSlop={8}
      >
        {busy ? (
          <ActivityIndicator size="small" color={device.state.power ? '#fff' : '#1f2937'} />
        ) : (
          <Ionicons name="power" size={18} color={device.state.power ? '#fff' : '#1f2937'} />
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOn: {
    backgroundColor: '#dbeafe',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  meta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  powerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef1f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  powerButtonOn: {
    backgroundColor: '#2563eb',
  },
});
