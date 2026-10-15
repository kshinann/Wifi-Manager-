@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.wifihealth.manager.ui.speedtest

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.wifihealth.manager.data.model.SpeedTestResult
import com.wifihealth.manager.data.model.SpeedTestStage
import com.wifihealth.manager.di.appContainer
import com.wifihealth.manager.ui.components.SectionCard
import com.wifihealth.manager.ui.components.SpeedTrendChart
import com.wifihealth.manager.util.FormatUtils
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun SpeedTestScreen() {
    val context = LocalContext.current
    val container = remember { context.appContainer() }
    val viewModel: SpeedTestViewModel = viewModel(factory = SpeedTestViewModel.factory(container))

    val stage by viewModel.stage.collectAsState()
    val latestResult by viewModel.latestResult.collectAsState()
    val history by viewModel.history.collectAsState()
    val isRunning = stage != SpeedTestStage.IDLE && stage != SpeedTestStage.DONE

    Scaffold(topBar = { TopAppBar(title = { Text("Speed test") }) }) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                SectionCard(title = "Run a test") {
                    if (isRunning) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                            Text(stage.label, style = MaterialTheme.typography.bodyLarge)
                        }
                    } else {
                        Button(onClick = { viewModel.runTest() }, modifier = Modifier.fillMaxWidth()) {
                            Text("Run speed test")
                        }
                    }
                }
            }

            latestResult?.let { result ->
                item { ResultCard(result) }
            }

            if (history.size >= 2) {
                item {
                    SectionCard(title = "Trend") {
                        SpeedTrendChart(results = history)
                    }
                }
            }

            if (history.isNotEmpty()) {
                item {
                    Text(
                        "History",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
                items(history.reversed(), key = { it.timestampEpochMillis }) { HistoryRow(it) }
            }
        }
    }
}

@Composable
private fun ResultCard(result: SpeedTestResult) {
    SectionCard(title = "Latest result") {
        MetricRow("Download", FormatUtils.mbps(result.downloadMbps))
        MetricRow("Upload", FormatUtils.mbps(result.uploadMbps))
        MetricRow("Latency", FormatUtils.ms(result.latencyMs))
        MetricRow("Jitter", FormatUtils.ms(result.jitterMs))
        MetricRow("Packet loss", FormatUtils.percent(result.packetLossPercent))
        MetricRow("Local latency (router)", FormatUtils.ms(result.localLatencyMs))
    }
}

@Composable
private fun MetricRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.secondary)
        Text(value, style = MaterialTheme.typography.bodyLarge)
    }
}

private val historyDateFormat = SimpleDateFormat("MMM d, HH:mm", Locale.getDefault())

@Composable
private fun HistoryRow(result: SpeedTestResult) {
    SectionCard(title = historyDateFormat.format(Date(result.timestampEpochMillis))) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column {
                Text("SSID: ${result.ssid ?: "--"}", style = MaterialTheme.typography.bodyMedium)
                Text("Latency: ${FormatUtils.ms(result.latencyMs)}", style = MaterialTheme.typography.bodyMedium)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text("↓ ${FormatUtils.mbps(result.downloadMbps)}", style = MaterialTheme.typography.bodyMedium)
                Text("↑ ${FormatUtils.mbps(result.uploadMbps)}", style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}
