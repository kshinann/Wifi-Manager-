import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { DEVICE_CATALOG, protocolLabelFor } from '../drivers/deviceCatalog';
import { DeviceType } from '../types/device';
import { useDevices } from '../context/DevicesContext';

type Props = NativeStackScreenProps<RootStackParamList, 'AddDevice'>;

export function AddDeviceScreen({ navigation }: Props) {
  const { addDevice } = useDevices();
  const [selectedType, setSelectedType] = useState<DeviceType | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedType) return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Give the device a name so you can find it later.');
      return;
    }
    setSaving(true);
    try {
      await addDevice(selectedType, trimmed);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not add device', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>Choose a device type</Text>
          <View style={styles.grid}>
            {DEVICE_CATALOG.map((template) => {
              const selected = selectedType === template.type;
              return (
                <Pressable
                  key={template.type}
                  style={[styles.tile, selected && styles.tileSelected]}
                  onPress={() => setSelectedType(template.type)}
                >
                  <Ionicons
                    name={template.icon}
                    size={28}
                    color={selected ? '#2563eb' : '#374151'}
                  />
                  <Text style={[styles.tileLabel, selected && styles.tileLabelSelected]}>
                    {template.label}
                  </Text>
                  <Text style={styles.tileProtocol}>{protocolLabelFor(template.type)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.heading}>Name it</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Living Room TV"
            placeholderTextColor="#9ca3af"
            style={styles.input}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.saveButton, (!selectedType || saving) && styles.saveButtonDisabled]}
            disabled={!selectedType || saving}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonLabel}>{saving ? 'Connecting…' : 'Add device'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  content: {
    padding: 20,
    gap: 12,
  },
  heading: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'flex-start',
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileSelected: {
    borderColor: '#2563eb',
  },
  tileLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  tileLabelSelected: {
    color: '#2563eb',
  },
  tileProtocol: {
    fontSize: 11,
    color: '#9ca3af',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  footer: {
    padding: 20,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
