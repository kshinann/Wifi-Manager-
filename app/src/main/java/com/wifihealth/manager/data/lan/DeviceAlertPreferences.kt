package com.wifihealth.manager.data.lan

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.deviceAlertPreferencesDataStore by preferencesDataStore(name = "device_alert_preferences")

/**
 * Whether unrecognized-device scan alerts are enabled. Off by default: this is a
 * notification feature, and not everyone wants the app pushing alerts about their
 * network, so it only ever turns on from an explicit toggle in the Devices screen.
 */
class DeviceAlertPreferences(private val context: Context) {

    private val enabledKey = booleanPreferencesKey("alerts_enabled")

    val enabled: Flow<Boolean> = context.deviceAlertPreferencesDataStore.data.map { it[enabledKey] ?: false }

    suspend fun setEnabled(enabled: Boolean) {
        context.deviceAlertPreferencesDataStore.edit { it[enabledKey] = enabled }
    }
}
