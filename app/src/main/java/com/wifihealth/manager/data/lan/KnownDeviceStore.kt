package com.wifihealth.manager.data.lan

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.wifihealth.manager.data.model.KnownDevice
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

private val Context.knownDevicesDataStore by preferencesDataStore(name = "known_devices")

/** Persists the user's "these devices are mine" allow-list, keyed by IP address. */
class KnownDeviceStore(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true }
    private val serializer = ListSerializer(KnownDevice.serializer())
    private val knownDevicesKey = stringPreferencesKey("known_devices_json")

    val knownDevices: Flow<List<KnownDevice>> = context.knownDevicesDataStore.data.map { prefs ->
        decode(prefs[knownDevicesKey])
    }

    suspend fun markKnown(ipAddress: String, label: String?) {
        context.knownDevicesDataStore.edit { prefs ->
            val existing = decode(prefs[knownDevicesKey]).filterNot { it.ipAddress == ipAddress }
            val updated = existing + KnownDevice(
                ipAddress = ipAddress,
                label = label,
                markedKnownEpochMillis = System.currentTimeMillis(),
            )
            prefs[knownDevicesKey] = json.encodeToString(serializer, updated)
        }
    }

    suspend fun forget(ipAddress: String) {
        context.knownDevicesDataStore.edit { prefs ->
            val updated = decode(prefs[knownDevicesKey]).filterNot { it.ipAddress == ipAddress }
            prefs[knownDevicesKey] = json.encodeToString(serializer, updated)
        }
    }

    private fun decode(raw: String?): List<KnownDevice> {
        if (raw.isNullOrBlank()) return emptyList()
        return try {
            json.decodeFromString(serializer, raw)
        } catch (e: Exception) {
            emptyList()
        }
    }
}
