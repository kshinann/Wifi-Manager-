package com.wifihealth.manager.data.recommendation

import com.wifihealth.manager.data.model.ConnectionSnapshot
import com.wifihealth.manager.data.model.NetworkHealthReport
import com.wifihealth.manager.data.model.SpeedTestResult
import com.wifihealth.manager.data.model.WifiNetwork
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine

/** Combines live connection/scan state with the most recent speed test into a health report. */
fun healthReportFlow(
    connectionState: Flow<ConnectionSnapshot>,
    scanResults: Flow<List<WifiNetwork>>,
    speedTestHistory: Flow<List<SpeedTestResult>>,
): Flow<NetworkHealthReport> = combine(connectionState, scanResults, speedTestHistory) { connection, networks, history ->
    RecommendationEngine.evaluate(connection, networks, history.lastOrNull())
}
