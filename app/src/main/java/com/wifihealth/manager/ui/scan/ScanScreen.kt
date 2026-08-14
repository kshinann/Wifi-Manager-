@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.wifihealth.manager.ui.scan

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.wifihealth.manager.data.model.ChannelCongestion
import com.wifihealth.manager.data.model.Severity
import com.wifihealth.manager.data.model.WifiNetwork
import com.wifihealth.manager.di.appContainer
import com.wifihealth.manager.ui.components.SectionCard
import com.wifihealth.manager.ui.components.SeverityBadge
import com.wifihealth.manager.ui.components.SignalBars
import com.wifihealth.manager.util.FormatUtils
import com.wifihealth.manager.util.PermissionUtils

@Composable
fun ScanScreen() {
    val context = LocalContext.current
    val container = remember { context.appContainer() }
    val viewModel: ScanViewModel = viewModel(factory = ScanViewModel.factory(container))

    val networks by viewModel.networks.collectAsState()
    val congestion by viewModel.channelCongestion.collectAsState()
    var detailNetwork by remember { mutableStateOf<WifiNetwork?>(null) }

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
            if (!PermissionUtils.isLocationEnabled(context)) {
                item { LocationDisabledBanner() }
            }
            if (congestion.isNotEmpty()) {
                item { ChannelCongestionCard(congestion) }
            }
            items(networks, key = { it.bssid }) { network ->
                NetworkRow(network, onClick = { detailNetwork = network })
            }
        }
    }

    detailNetwork?.let { network ->
        NetworkDetailDialog(network, onDismiss = { detailNetwork = null })
    }
}

@Composable
private fun LocationDisabledBanner() {
    val context = LocalContext.current
    SectionCard(title = "Location is turned off") {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(Icons.Default.LocationOff, contentDescription = null, tint = MaterialTheme.colorScheme.error)
            Column {
                Text(
                    "Android requires the device's Location setting to be on to return full Wi-Fi " +
                        "scan results, even though this app never reads your location. With it off, " +
                        "the list below may be empty or missing nearby networks.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = {
                    context.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
                }) {
                    Text("Open location settings")
                }
            }
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
private fun NetworkRow(network: WifiNetwork, onClick: () -> Unit) {
    SectionCard(
        title = network.ssid,
        modifier = Modifier.clickable(onClick = onClick),
    ) {
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

@Composable
private fun NetworkDetailDialog(network: WifiNetwork, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("Close") } },
        title = { Text(network.ssid) },
        text = {
            Column {
                DetailRow("BSSID", network.bssid)
                DetailRow("Signal", "${FormatUtils.dbm(network.rssiDbm)} (${network.signalQuality.label})")
                DetailRow("Frequency", FormatUtils.mhz(network.frequencyMhz))
                DetailRow("Channel", "${network.channel} (${network.band.label})")
                DetailRow("Channel width", network.channelWidthLabel)
                DetailRow("Security", network.security.label)
                DetailRow("Hidden", if (network.isHidden) "Yes" else "No")
                DetailRow("Last seen", "${network.lastSeenSecondsAgo}s ago")
                DetailRow("Raw capabilities", network.rawCapabilities)
            }
        },
    )
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(modifier = Modifier.padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, style = MaterialTheme.typography.labelLarge, modifier = Modifier.fillMaxWidth(0.35f))
        Text(value, style = MaterialTheme.typography.bodyMedium)
    }
}
