package com.wifihealth.manager.ui.scan

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.wifihealth.manager.data.model.ChannelCongestion
import com.wifihealth.manager.data.model.WifiNetwork
import com.wifihealth.manager.data.wifi.ChannelAnalyzer
import com.wifihealth.manager.data.wifi.WifiScanner
import com.wifihealth.manager.di.AppContainer
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

class ScanViewModel(
    scanResults: StateFlow<List<WifiNetwork>>,
    private val wifiScanner: WifiScanner,
) : ViewModel() {

    val networks: StateFlow<List<WifiNetwork>> = scanResults

    val channelCongestion: StateFlow<List<ChannelCongestion>> = scanResults
        .map { ChannelAnalyzer.analyze(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun rescan() {
        wifiScanner.requestScan()
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
            initializer { ScanViewModel(container.scanResults, container.wifiScanner) }
        }
    }
}
