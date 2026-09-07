package com.wifihealth.manager.di

import android.content.Context
import com.wifihealth.manager.data.lan.DeviceAlertNotifier
import com.wifihealth.manager.data.lan.DeviceAlertPreferences
import com.wifihealth.manager.data.lan.KnownDeviceStore
import com.wifihealth.manager.data.lan.LanDeviceScanner
import com.wifihealth.manager.data.model.ConnectionSnapshot
import com.wifihealth.manager.data.model.WifiNetwork
import com.wifihealth.manager.data.speedtest.SpeedTestEngine
import com.wifihealth.manager.data.speedtest.SpeedTestHistoryStore
import com.wifihealth.manager.data.wifi.ConnectionMonitor
import com.wifihealth.manager.data.wifi.WifiScanner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * Small hand-rolled DI container (no Hilt/Dagger dependency for an app this size).
 *
 * Wi-Fi scan results and connection state are shared app-wide as hot [StateFlow]s
 * so every screen observes the same underlying [android.net.ConnectivityManager]
 * callback / scan broadcast receiver instead of each re-registering its own.
 */
class AppContainer(context: Context) {

    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val wifiScanner = WifiScanner(context)
    val connectionMonitor = ConnectionMonitor(context)
    val speedTestEngine = SpeedTestEngine()
    val speedTestHistoryStore = SpeedTestHistoryStore(context)
    val lanDeviceScanner = LanDeviceScanner()
    val knownDeviceStore = KnownDeviceStore(context)
    val deviceAlertPreferences = DeviceAlertPreferences(context)
    val deviceAlertNotifier = DeviceAlertNotifier(context)

    val connectionState: StateFlow<ConnectionSnapshot> = connectionMonitor.connectionFlow()
        .stateIn(applicationScope, SharingStarted.WhileSubscribed(5_000), ConnectionSnapshot.EMPTY)

    val scanResults: StateFlow<List<WifiNetwork>> = wifiScanner.scanResultsFlow()
        .stateIn(applicationScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    init {
        applicationScope.launch {
            while (true) {
                wifiScanner.requestScan()
                delay(SCAN_INTERVAL_MS)
            }
        }
    }

    companion object {
        private const val SCAN_INTERVAL_MS = 15_000L
    }
}

fun Context.appContainer(): AppContainer =
    (applicationContext as com.wifihealth.manager.WifiHealthApplication).container
