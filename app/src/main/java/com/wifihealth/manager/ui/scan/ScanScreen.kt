package com.wifihealth.manager.ui.scan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import com.wifihealth.manager.data.model.ChannelCongestion
import com.wifihealth.manager.data.model.WifiNetwork
import com.wifihealth.manager.di.appContainer
import com.wifihealth.manager.ui.components.SectionCard
import com.wifihealth.manager.ui.components.SeverityBadge
import com.wifihealth.manager.ui.components.SignalBars
import com.wifihealth.manager.data.model.Severity
import com.wifihealth.manager.util.FormatUtils

@Composable
fun ScanScreen() {
    val context = LocalContext.current
    val container = remember { context.appContainer() }
    val viewModel: ScanViewModel = viewModel(factory = ScanViewModel.factory(container))

    val networks by viewModel.networks.collectAsState()
    val congestion by viewModel.channelCongestion.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Nearby networks (${networks.size})") },
                actions = {
                    IconButton(onClick = { viewModel.rescan() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Rescan")
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (congestion.isNotEmpty()) {
                item { ChannelCongestionCard(congestion) }
            }
            items(networks, key = { it.bssid }) { network -> NetworkRow(network) }
        }
    }
}

@Composable
private fun ChannelCongestionCard(congestion: List<ChannelCongestion>) {
    SectionCard(title = "Busiest channels") {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(congestion.take(6), key = { "${it.band}-${it.channel}" }) { c ->
                val severity = when {
                    c.congestionScore >= 20 -> Severity.WARNING
                    c.congestionScore >= 10 -> Severity.INFO
                    else -> Severity.GOOD
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Ch ${c.channel}", style = MaterialTheme.typography.labelLarge)
                    Text(c.band.label, style = MaterialTheme.typography.labelSmall)
                    SeverityBadge(severity, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
    }
}

@Composable
private fun NetworkRow(network: WifiNetwork) {
    SectionCard(title = network.ssid) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column {
                Text("${network.band.label} · ch ${network.channel}", style = MaterialTheme.typography.bodyMedium)
                Text(network.security.label, style = MaterialTheme.typography.bodyMedium)
                Text(network.bssid, style = MaterialTheme.typography.labelSmall)
            }
            Column(horizontalAlignment = Alignment.End) {
                SignalBars(quality = network.signalQuality)
                Text(FormatUtils.dbm(network.rssiDbm), style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}
