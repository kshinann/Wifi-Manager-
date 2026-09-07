@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.wifihealth.manager.ui.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.wifihealth.manager.data.model.ConnectionSnapshot
import com.wifihealth.manager.data.model.Recommendation
import com.wifihealth.manager.di.appContainer
import com.wifihealth.manager.ui.components.HealthScoreGauge
import com.wifihealth.manager.ui.components.SectionCard
import com.wifihealth.manager.ui.components.SeverityBadge
import com.wifihealth.manager.ui.components.SignalBars
import com.wifihealth.manager.util.FormatUtils

@Composable
fun DashboardScreen(onSeeAllRecommendations: () -> Unit) {
    val context = LocalContext.current
    val container = remember { context.appContainer() }
    val viewModel: DashboardViewModel = viewModel(factory = DashboardViewModel.factory(container))

    val connection by viewModel.connection.collectAsState()
    val nearbyCount by viewModel.nearbyCount.collectAsState()
    val report by viewModel.report.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Wi-Fi Health") },
                actions = {
                    IconButton(onClick = { viewModel.rescan() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Rescan")
                    }
                },
            )
        },
    ) { padding ->
        if (!viewModel.isWifiEnabled()) {
            WifiDisabledMessage(modifier = Modifier.padding(padding))
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    HealthScoreGauge(
                        score = report?.healthScore?.overall ?: 0,
                        label = report?.healthScore?.label ?: "Checking...",
                    )
                }
            }

            item { ConnectionSummaryCard(connection = connection, nearbyCount = nearbyCount) }

            item {
                SectionCard(
                    title = "Top recommendations",
                    trailing = { TextButton(onClick = onSeeAllRecommendations) { Text("See all") } },
                ) {
                    val top = report?.recommendations.orEmpty().take(3)
                    if (top.isEmpty()) {
                        Text("Running checks...", style = MaterialTheme.typography.bodyMedium)
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            top.forEach { RecommendationRow(it) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ConnectionSummaryCard(connection: ConnectionSnapshot, nearbyCount: Int) {
    SectionCard(title = "Current connection") {
        if (connection.ssid == null) {
            Text("Not connected to a Wi-Fi network.", style = MaterialTheme.typography.bodyMedium)
            return@SectionCard
        }
        InfoRow("SSID", connection.ssid)
        InfoRow("Signal", "${FormatUtils.dbm(connection.rssiDbm)} (${connection.signalQuality?.label ?: "--"})") {
            SignalBars(quality = connection.signalQuality)
        }
        InfoRow("Band / channel", "${connection.band.label} · ch ${connection.channel ?: "--"}")
        InfoRow("Security", connection.security.label)
        InfoRow("Link speed", connection.linkSpeedMbps?.let { "$it Mbps" } ?: "--")
        InfoRow("IP address", connection.ipAddress ?: "--")
        InfoRow("Gateway", connection.gateway ?: "--")
        InfoRow("Networks nearby", "$nearbyCount")
    }
}

@Composable
private fun InfoRow(label: String, value: String, trailing: @Composable () -> Unit = {}) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.secondary)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(value, style = MaterialTheme.typography.bodyLarge)
            trailing()
        }
    }
}

@Composable
private fun RecommendationRow(recommendation: Recommendation) {
    Column {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            SeverityBadge(recommendation.severity)
            Text(recommendation.title, style = MaterialTheme.typography.bodyLarge)
        }
        Spacer(Modifier.height(4.dp))
        Text(recommendation.detail, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun WifiDisabledMessage(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            Icons.Default.WifiOff,
            contentDescription = null,
            modifier = Modifier.padding(bottom = 12.dp),
            tint = MaterialTheme.colorScheme.secondary,
        )
        Text("Wi-Fi is turned off", style = MaterialTheme.typography.titleMedium)
        Text("Enable Wi-Fi to check network health.", style = MaterialTheme.typography.bodyMedium)
    }
}
