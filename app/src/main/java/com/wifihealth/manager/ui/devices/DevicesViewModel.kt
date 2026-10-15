package com.wifihealth.manager.ui.devices

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.wifihealth.manager.data.lan.DeviceAlertNotifier
import com.wifihealth.manager.data.lan.DeviceAlertPreferences
import com.wifihealth.manager.data.lan.KnownDeviceStore
import com.wifihealth.manager.data.lan.LanDeviceScanner
import com.wifihealth.manager.data.lan.unrecognizedDevices
import com.wifihealth.manager.data.model.ConnectionSnapshot
import com.wifihealth.manager.data.model.DiscoveredDevice
import com.wifihealth.manager.data.model.KnownDevice
import com.wifihealth.manager.data.model.LanScanResult
import com.wifihealth.manager.data.model.LanScanState
import com.wifihealth.manager.di.AppContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class DevicesViewModel(
    private val connectionState: StateFlow<ConnectionSnapshot>,
    private val scanner: LanDeviceScanner,
    private val knownDeviceStore: KnownDeviceStore,
    private val alertPreferences: DeviceAlertPreferences,
    private val alertNotifier: DeviceAlertNotifier,
) : ViewModel() {

    private val _scanState = MutableStateFlow(LanScanState.IDLE)
    val scanState: StateFlow<LanScanState> = _scanState

    private val _scanResult = MutableStateFlow<LanScanResult?>(null)
    val scanResult: StateFlow<LanScanResult?> = _scanResult

    private val _progress = MutableStateFlow(0f)
    val progress: StateFlow<Float> = _progress

    val knownDevices: StateFlow<List<KnownDevice>> = knownDeviceStore.knownDevices
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val alertsEnabled: StateFlow<Boolean> = alertPreferences.enabled
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    fun setAlertsEnabled(enabled: Boolean) {
        viewModelScope.launch { alertPreferences.setEnabled(enabled) }
    }

    fun scanNetwork() {
        if (_scanState.value == LanScanState.SCANNING) return
        val connection = connectionState.value
        val ip = connection.ipAddress ?: return
        val prefix = connection.subnetPrefixLength ?: return

        viewModelScope.launch {
            _scanState.value = LanScanState.SCANNING
            _progress.value = 0f
            val result = scanner.scan(ip, prefix) { scanned, total ->
                _progress.value = if (total > 0) scanned / total.toFloat() else 1f
            }
            _scanResult.value = result
            _scanState.value = LanScanState.DONE

            if (alertsEnabled.value) {
                val knownIps = knownDevices.value.map { it.ipAddress }.toSet()
                val unrecognized = result.devices.unrecognizedDevices(knownIps)
                if (unrecognized.isNotEmpty()) {
                    alertNotifier.notifyUnrecognized(unrecognized)
                }
            }
        }
    }

    fun markKnown(device: DiscoveredDevice, label: String?) {
        viewModelScope.launch { knownDeviceStore.markKnown(device.ipAddress, label) }
    }

    fun forget(ipAddress: String) {
        viewModelScope.launch { knownDeviceStore.forget(ipAddress) }
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
            initializer {
                DevicesViewModel(
                    connectionState = container.connectionState,
                    scanner = container.lanDeviceScanner,
                    knownDeviceStore = container.knownDeviceStore,
                    alertPreferences = container.deviceAlertPreferences,
                    alertNotifier = container.deviceAlertNotifier,
                )
            }
        }
    }
}
