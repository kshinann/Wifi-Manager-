package com.wifihealth.manager.data.wifi

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.ScanResult
import android.net.wifi.WifiManager
import android.os.SystemClock
import androidx.core.content.ContextCompat
import com.wifihealth.manager.data.model.Band
import com.wifihealth.manager.data.model.SecurityType
import com.wifihealth.manager.data.model.WifiNetwork
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/** Wraps [WifiManager] scanning so the rest of the app deals only in [WifiNetwork]. */
class WifiScanner(context: Context) {

    private val appContext = context.applicationContext
    private val wifiManager = appContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    /**
     * Emits the current scan-result list immediately, then again every time the
     * system finishes a scan (whether it was triggered by this app or another).
     */
    fun scanResultsFlow(): Flow<List<WifiNetwork>> = callbackFlow {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                trySend(readScanResults())
            }
        }
        ContextCompat.registerReceiver(
            appContext,
            receiver,
            IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        trySend(readScanResults())
        awaitClose { appContext.unregisterReceiver(receiver) }
    }

    /**
     * Asks the platform to start a fresh scan. The OS throttles this heavily
     * (a handful of calls per app per 2 minutes on API 28+), so a `false`
     * return just means the previous scan results will be reused.
     */
    @SuppressLint("MissingPermission")
    fun requestScan(): Boolean = wifiManager.startScan()

    fun isWifiEnabled(): Boolean = wifiManager.isWifiEnabled

    @SuppressLint("MissingPermission")
    private fun readScanResults(): List<WifiNetwork> = try {
        wifiManager.scanResults
            .map { it.toWifiNetwork() }
            .distinctBy { it.bssid }
            .sortedByDescending { it.rssiDbm }
    } catch (e: SecurityException) {
        emptyList()
    }

    private fun ScanResult.toWifiNetwork(): WifiNetwork {
        val ssidName = SSID
        val hidden = ssidName.isNullOrBlank()
        return WifiNetwork(
            ssid = if (hidden) "(hidden network)" else ssidName!!,
            bssid = BSSID ?: "",
            rssiDbm = level,
            frequencyMhz = frequency,
            channel = ChannelAnalyzer.frequencyToChannel(frequency),
            band = Band.fromFrequencyMhz(frequency),
            security = SecurityType.fromCapabilities(capabilities ?: ""),
            isHidden = hidden,
            channelWidthLabel = channelWidthLabel(this),
            lastSeenSecondsAgo = lastSeenSecondsAgo(this),
            rawCapabilities = capabilities ?: "",
        )
    }

    private fun channelWidthLabel(scanResult: ScanResult): String = when (scanResult.channelWidth) {
        ScanResult.CHANNEL_WIDTH_20MHZ -> "20 MHz"
        ScanResult.CHANNEL_WIDTH_40MHZ -> "40 MHz"
        ScanResult.CHANNEL_WIDTH_80MHZ -> "80 MHz"
        ScanResult.CHANNEL_WIDTH_160MHZ -> "160 MHz"
        ScanResult.CHANNEL_WIDTH_80MHZ_PLUS_MHZ -> "80+80 MHz"
        5 -> "320 MHz" // ScanResult.CHANNEL_WIDTH_320MHZ (API 33); raw value for minSdk-26 compatibility
        else -> "Unknown"
    }

    private fun lastSeenSecondsAgo(scanResult: ScanResult): Long {
        val ageMicros = SystemClock.elapsedRealtime() * 1000 - scanResult.timestamp
        return (ageMicros / 1_000_000).coerceAtLeast(0)
    }
}
