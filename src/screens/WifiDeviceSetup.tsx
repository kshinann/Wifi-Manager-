import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDevices } from '../context/DevicesContext';
import { getLocalSubnetBase, scanLocalNetwork, ScanHandle } from '../wifi/subnetScan';
import { WifiProbeResult, WifiProtocolId } from '../wifi/protocols/types';

type Mode = 'scan' | 'manual' | 'demo';

export function WifiDeviceSetup({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<Mode>('scan');

  return (
    <View style={styles.container}>
      <View style={styles.modeRow}>
        <ModeTab label="Scan network" active={mode === 'scan'} onPress={() => setMode('scan')} />
        <ModeTab label="Enter IP" active={mode === 'manual'} onPress={() => setMode('manual')} />
        <ModeTab label="Try demo" active={mode === 'demo'} onPress={() => setMode('demo')} />
      </View>

      {mode === 'scan' && <ScanMode onDone={onDone} />}
      {mode === 'manual' && <ManualMode onDone={onDone} />}
      {mode === 'demo' && <DemoMode onDone={onDone} />}
    </View>
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.modeTab, active && styles.modeTabActive]} onPress={onPress}>
      <Text style={[styles.modeTabLabel, active && styles.modeTabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function ScanMode({ onDone }: { onDone: () => void }) {
  const { addDevice } = useDevices();
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<WifiProbeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addingHost, setAddingHost] = useState<string | null>(null);
  const handleRef = useRef<ScanHandle | null>(null);

  useEffect(() => () => handleRef.current?.cancel(), []);

  const startScan = async () => {
    setError(null);
    setResults([]);
    setScanning(true);
    try {
      const subnetBase = await getLocalSubnetBase();
      const handle = scanLocalNetwork(subnetBase, (result) => {
        setResults((prev) => (prev.some((r) => r.host === result.host) ? prev : [...prev, result]));
      });
      handleRef.current = handle;
      await handle.done;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  const handleAdd = async (result: WifiProbeResult) => {
    setAddingHost(result.host);
    try {
      await addDevice({
        type: 'light',
        name: result.deviceName,
        driverId: result.protocolId,
        host: result.host,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingHost(null);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.helpText}>
        Scans your phone's WiFi subnet for Tasmota and Shelly devices (plain local HTTP,
        no cloud account needed). Your phone must be on the same WiFi network as the device.
      </Text>

      <Pressable
        style={[styles.primaryButton, scanning && styles.primaryButtonDisabled]}
        disabled={scanning}
        onPress={startScan}
      >
        {scanning ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="wifi" size={18} color="#fff" />
        )}
        <Text style={styles.primaryButtonLabel}>{scanning ? 'Scanning…' : 'Scan for devices'}</Text>
      </Pressable>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {results.map((result) => (
        <View key={result.host} style={styles.resultRow}>
          <View style={styles.resultInfo}>
            <Text style={styles.resultName}>{result.deviceName}</Text>
            <Text style={styles.resultMeta}>
              {result.host} · {result.protocolId} · {result.state.power ? 'currently on' : 'currently off'}
            </Text>
          </View>
          <Pressable
            style={styles.addChip}
            disabled={addingHost === result.host}
            onPress={() => handleAdd(result)}
          >
            {addingHost === result.host ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <Text style={styles.addChipLabel}>Add</Text>
            )}
          </Pressable>
        </View>
      ))}

      {!scanning && results.length === 0 && !error && (
        <Text style={styles.helpTextMuted}>No devices found yet. Tap "Scan for devices" to start.</Text>
      )}
    </View>
  );
}

function ManualMode({ onDone }: { onDone: () => void }) {
  const { addDevice } = useDevices();
  const [host, setHost] = useState('');
  const [protocolId, setProtocolId] = useState<WifiProtocolId>('tasmota');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!host.trim() || !name.trim()) {
      setError('Enter both the device IP address and a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addDevice({ type: 'light', name: name.trim(), driverId: protocolId, host: host.trim() });
      onDone();
    } catch (err) {
      setError(
        `Could not reach a ${protocolId} device at ${host.trim()}. ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.helpText}>
        Know the device's IP address already? Enter it directly instead of scanning.
      </Text>

      <View style={styles.protocolRow}>
        <ModeTab label="Tasmota" active={protocolId === 'tasmota'} onPress={() => setProtocolId('tasmota')} />
        <ModeTab label="Shelly" active={protocolId === 'shelly'} onPress={() => setProtocolId('shelly')} />
      </View>

      <TextInput
        value={host}
        onChangeText={setHost}
        placeholder="e.g. 192.168.1.45"
        placeholderTextColor="#9ca3af"
        keyboardType="decimal-pad"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Kitchen Plug"
        placeholderTextColor="#9ca3af"
        style={styles.input}
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
        disabled={busy}
        onPress={handleAdd}
      >
        {busy && <ActivityIndicator color="#fff" size="small" />}
        <Text style={styles.primaryButtonLabel}>{busy ? 'Connecting…' : 'Add device'}</Text>
      </Pressable>
    </View>
  );
}

function DemoMode({ onDone }: { onDone: () => void }) {
  const { addDevice } = useDevices();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addDevice({ type: 'light', name: name.trim(), driverId: 'mock-wifi' });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.helpText}>
        No real device on hand? Add a simulated one to try the app out.
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Demo Light"
        placeholderTextColor="#9ca3af"
        style={styles.input}
      />
      <Pressable
        style={[styles.primaryButton, (busy || !name.trim()) && styles.primaryButtonDisabled]}
        disabled={busy || !name.trim()}
        onPress={handleAdd}
      >
        {busy && <ActivityIndicator color="#fff" size="small" />}
        <Text style={styles.primaryButtonLabel}>{busy ? 'Adding…' : 'Add simulated device'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: '#eef1f6',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: '#fff',
  },
  modeTabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  modeTabLabelActive: {
    color: '#2563eb',
  },
  section: {
    gap: 10,
  },
  helpText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  helpTextMuted: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
  },
  primaryButton: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  protocolRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  resultMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  addChip: {
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#dbeafe',
  },
  addChipLabel: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 13,
  },
});
