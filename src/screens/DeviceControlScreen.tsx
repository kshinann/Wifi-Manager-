import React, { useLayoutEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useDevices } from '../context/DevicesContext';
import { RemoteButton } from '../components/RemoteButton';
import { RemoteCommand } from '../types/driver';

type Props = NativeStackScreenProps<RootStackParamList, 'DeviceControl'>;

export function DeviceControlScreen({ route, navigation }: Props) {
  const { deviceId } = route.params;
  const { devices, pendingDeviceIds, sendCommand, removeDevice } = useDevices();
  const device = devices.find((d) => d.id === deviceId);
  const busy = pendingDeviceIds.includes(deviceId);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: device?.name ?? 'Device',
      headerRight: () => (
        <Pressable
          onPress={() =>
            Alert.alert('Remove device', `Remove "${device?.name}" from your remotes?`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                  await removeDevice(deviceId);
                  navigation.goBack();
                },
              },
            ])
          }
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={22} color="#dc2626" />
        </Pressable>
      ),
    });
  }, [navigation, device?.name, deviceId, removeDevice]);

  if (!device) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.missing}>This device no longer exists.</Text>
      </SafeAreaView>
    );
  }

  const send = (command: RemoteCommand) => sendCommand(deviceId, command);
  const isOn = device.state.power;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.powerRow}>
        <RemoteButton
          label={isOn ? 'On' : 'Off'}
          icon="power"
          variant={isOn ? 'primary' : 'default'}
          size="large"
          busy={busy}
          onPress={() => send('power')}
        />
      </View>

      <View style={[styles.body, !isOn && styles.bodyDisabled]} pointerEvents={isOn ? 'auto' : 'none'}>
        {device.type === 'tv' && (
          <TvControls state={device.state} send={send} busy={busy} />
        )}
        {device.type === 'ac' && (
          <AcControls state={device.state} send={send} busy={busy} />
        )}
        {device.type === 'fan' && (
          <FanControls state={device.state} send={send} busy={busy} />
        )}
        {device.type === 'light' && (
          <LightControls state={device.state} send={send} busy={busy} />
        )}
        {device.type === 'speaker' && (
          <SpeakerControls state={device.state} send={send} busy={busy} />
        )}
      </View>
    </SafeAreaView>
  );
}

interface ControlsProps {
  state: ReturnType<typeof useDevices>['devices'][number]['state'];
  send: (command: RemoteCommand) => void;
  busy: boolean;
}

function TvControls({ state, send, busy }: ControlsProps) {
  return (
    <>
      <Stat label="Volume" value={String(state.volume ?? 0)} />
      <Row>
        <RemoteButton label="Vol −" icon="remove" busy={busy} onPress={() => send('volumeDown')} />
        <RemoteButton label="Vol +" icon="add" busy={busy} onPress={() => send('volumeUp')} />
        <RemoteButton label="Mute" icon="volume-mute-outline" busy={busy} onPress={() => send('mute')} />
      </Row>
      <Stat label="Channel" value={String(state.channel ?? 1)} />
      <Row>
        <RemoteButton label="Ch −" icon="chevron-down" busy={busy} onPress={() => send('channelDown')} />
        <RemoteButton label="Ch +" icon="chevron-up" busy={busy} onPress={() => send('channelUp')} />
      </Row>
      <Stat label="Input" value={state.input ?? '—'} />
      <Row>
        <RemoteButton label="Change input" icon="swap-horizontal" busy={busy} onPress={() => send('cycleInput')} />
      </Row>
    </>
  );
}

function AcControls({ state, send, busy }: ControlsProps) {
  return (
    <>
      <Stat label="Temperature" value={`${state.temperature ?? 24}°C`} />
      <Row>
        <RemoteButton label="Temp −" icon="remove" busy={busy} onPress={() => send('tempDown')} />
        <RemoteButton label="Temp +" icon="add" busy={busy} onPress={() => send('tempUp')} />
      </Row>
      <Stat label="Mode" value={state.mode ?? 'cool'} />
      <Row>
        <RemoteButton label="Change mode" icon="repeat" busy={busy} onPress={() => send('cycleMode')} />
      </Row>
      <Stat label="Fan speed" value={String(state.fanSpeed ?? 1)} />
      <Row>
        <RemoteButton label="Fan −" icon="remove" busy={busy} onPress={() => send('fanSpeedDown')} />
        <RemoteButton label="Fan +" icon="add" busy={busy} onPress={() => send('fanSpeedUp')} />
      </Row>
    </>
  );
}

function FanControls({ state, send, busy }: ControlsProps) {
  return (
    <>
      <Stat label="Speed" value={String(state.fanSpeed ?? 1)} />
      <Row>
        <RemoteButton label="Speed −" icon="remove" busy={busy} onPress={() => send('fanSpeedDown')} />
        <RemoteButton label="Speed +" icon="add" busy={busy} onPress={() => send('fanSpeedUp')} />
      </Row>
      <Stat label="Oscillating" value={state.oscillating ? 'Yes' : 'No'} />
      <Row>
        <RemoteButton label="Toggle sweep" icon="sync" busy={busy} onPress={() => send('toggleOscillate')} />
      </Row>
    </>
  );
}

function LightControls({ state, send, busy }: ControlsProps) {
  return (
    <>
      <Stat label="Brightness" value={`${state.brightness ?? 0}%`} />
      <Row>
        <RemoteButton label="Dimmer" icon="remove" busy={busy} onPress={() => send('brightnessDown')} />
        <RemoteButton label="Brighter" icon="add" busy={busy} onPress={() => send('brightnessUp')} />
      </Row>
      <Stat label="Color" value={state.color ?? '—'} swatch={state.color} />
      <Row>
        <RemoteButton label="Change color" icon="color-palette-outline" busy={busy} onPress={() => send('cycleColor')} />
      </Row>
    </>
  );
}

function SpeakerControls({ state, send, busy }: ControlsProps) {
  return (
    <>
      <Stat label="Volume" value={String(state.volume ?? 0)} />
      <Row>
        <RemoteButton label="Vol −" icon="remove" busy={busy} onPress={() => send('volumeDown')} />
        <RemoteButton label="Vol +" icon="add" busy={busy} onPress={() => send('volumeUp')} />
      </Row>
      <Row>
        <RemoteButton
          label={state.playing ? 'Pause' : 'Play'}
          icon={state.playing ? 'pause' : 'play'}
          variant="primary"
          busy={busy}
          onPress={() => send('playPause')}
        />
      </Row>
    </>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Stat({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        {swatch && <View style={[styles.swatch, { backgroundColor: swatch }]} />}
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  missing: {
    textAlign: 'center',
    marginTop: 40,
    color: '#6b7280',
  },
  powerRow: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  body: {
    paddingHorizontal: 20,
    gap: 8,
  },
  bodyDisabled: {
    opacity: 0.4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  stat: {
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#00000022',
  },
});
