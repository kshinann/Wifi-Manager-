package com.wifihealth.manager.ui.speedtest

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.wifihealth.manager.data.model.ConnectionSnapshot
import com.wifihealth.manager.data.model.SpeedTestResult
import com.wifihealth.manager.data.model.SpeedTestStage
import com.wifihealth.manager.data.speedtest.SpeedTestEngine
import com.wifihealth.manager.data.speedtest.SpeedTestHistoryStore
import com.wifihealth.manager.di.AppContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class SpeedTestViewModel(
    private val speedTestEngine: SpeedTestEngine,
    private val historyStore: SpeedTestHistoryStore,
    private val connectionState: StateFlow<ConnectionSnapshot>,
) : ViewModel() {

    private val _stage = MutableStateFlow(SpeedTestStage.IDLE)
    val stage: StateFlow<SpeedTestStage> = _stage

    private val _latestResult = MutableStateFlow<SpeedTestResult?>(null)
    val latestResult: StateFlow<SpeedTestResult?> = _latestResult

    val history: StateFlow<List<SpeedTestResult>> = historyStore.history
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun runTest() {
        val current = _stage.value
        if (current != SpeedTestStage.IDLE && current != SpeedTestStage.DONE) return

        viewModelScope.launch {
            val connection = connectionState.value
            val result = speedTestEngine.runFullTest(
                ssid = connection.ssid,
                gatewayIp = connection.gateway,
                onStage = { _stage.value = it },
            )
            _latestResult.value = result
            historyStore.addResult(result)
        }
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
            initializer {
                SpeedTestViewModel(
                    speedTestEngine = container.speedTestEngine,
                    historyStore = container.speedTestHistoryStore,
                    connectionState = container.connectionState,
                )
            }
        }
    }
}
