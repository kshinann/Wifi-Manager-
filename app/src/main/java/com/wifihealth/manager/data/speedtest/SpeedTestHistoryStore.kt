package com.wifihealth.manager.data.speedtest

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.wifihealth.manager.data.model.SpeedTestResult
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

private val Context.speedTestDataStore by preferencesDataStore(name = "speed_test_history")

/** Persists the last [MAX_HISTORY] speed test results as JSON in DataStore Preferences. */
class SpeedTestHistoryStore(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true }
    private val serializer = ListSerializer(SpeedTestResult.serializer())
    private val historyKey = stringPreferencesKey("history_json")

    val history: Flow<List<SpeedTestResult>> = context.speedTestDataStore.data.map { prefs ->
        decode(prefs[historyKey])
    }

    suspend fun addResult(result: SpeedTestResult) {
        context.speedTestDataStore.edit { prefs ->
            val updated = (decode(prefs[historyKey]) + result).takeLast(MAX_HISTORY)
            prefs[historyKey] = json.encodeToString(serializer, updated)
        }
    }

    private fun decode(raw: String?): List<SpeedTestResult> {
        if (raw.isNullOrBlank()) return emptyList()
        return try {
            json.decodeFromString(serializer, raw)
        } catch (e: Exception) {
            emptyList()
        }
    }

    companion object {
        private const val MAX_HISTORY = 20
    }
}
