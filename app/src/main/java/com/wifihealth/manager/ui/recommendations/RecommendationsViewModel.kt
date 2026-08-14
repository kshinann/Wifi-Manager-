package com.wifihealth.manager.ui.recommendations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.wifihealth.manager.data.model.NetworkHealthReport
import com.wifihealth.manager.data.recommendation.healthReportFlow
import com.wifihealth.manager.di.AppContainer
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn

class RecommendationsViewModel(container: AppContainer) : ViewModel() {

    val report: StateFlow<NetworkHealthReport?> = healthReportFlow(
        container.connectionState,
        container.scanResults,
        container.speedTestHistoryStore.history,
    ).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
            initializer { RecommendationsViewModel(container) }
        }
    }
}
