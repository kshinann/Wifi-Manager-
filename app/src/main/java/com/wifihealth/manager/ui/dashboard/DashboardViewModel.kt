package com.wifihealth.manager.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.wifihealth.manager.data.model.ConnectionSnapshot
import com.wifihealth.manager.data.model.NetworkHealthReport
import com.wifihealth.manager.data.model.SpeedTestResult
import com.wifihealth.manager.data.model.WifiNetwork
import com.wifihealth.manager.data.recommendation.healthReportFlow
import com.wifihealth.manager.data.wifi.WifiScanner
import com.wifihealth.manager.di.AppContainer
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

class DashboardViewModel(
    val connection: StateFlow<ConnectionSnapshot>,
    scanResults: StateFlow<List<WifiNetwork>>,
    speedTestHistory: Flow<List<SpeedTestResult>>,
    private val wifiScanner: WifiScanner,
) : ViewModel() {

    val nearbyCount: StateFlow<Int> = scanResults
        .map { it.size }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), scanResults.value.size)

    val report: StateFlow<NetworkHealthReport?> =
        healthReportFlow(connection, scanResults, speedTestHistory)
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun isWifiEnabled(): Boolean = wifiScanner.isWifiEnabled()

    fun rescan() {
        wifiScanner.requestScan()
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
            initializer {
                DashboardViewModel(
                    connection = container.connectionState,
                    scanResults = container.scanResults,
                    speedTestHistory = container.speedTestHistoryStore.history,
                    wifiScanner = container.wifiScanner,
                )
            }
        }
    }
}
