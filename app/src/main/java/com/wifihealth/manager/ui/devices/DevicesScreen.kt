@file:OptIn(
    androidx.compose.material3.ExperimentalMaterial3Api::class,
    com.google.accompanist.permissions.ExperimentalPermissionsApi::class,
)

package com.wifihealth.manager.ui.devices

import android.Manifest
import android.os.Build
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
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
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
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import com.wifihealth.manager.data.lan.unrecognizedDevices
import com.wifihealth.manager.data.model.DiscoveredDevice
import com.wifihealth.manager.data.model.LanScanResult
import com.wifihealth.manager.data.model.LanScanState
import com.wifihealth.manager.data.model.Severity
import com.wifihealth.manager.di.appContainer
import com.wifihealth.manager.ui.components.SectionCard
import com.wifihealth.manager.ui.components.SeverityBadge

@Composable
fun DevicesScreen() {
    val context = LocalContext.current
    val container = remember { context.appContainer() }
    val viewModel: DevicesViewModel = viewModel(factory = DevicesViewModel.factory(container))

    val scanState by viewModel.scanState.collectAsState()
    val scanResult by viewModel.scanResult.collectAsState()
    val progress by viewModel.progress.collectAsState()
    val knownDevices by viewModel.knownDevices.collectAsState()
    val knownIps = remember(knownDevices) { knownDevices.map { it.ipAddress }.toSet() }

    val discovered = scanResult?.devices.orEmpty()
    val unrecognized = discovered.unrecognizedDevices(knownIps)
    val recognized = discovered.filter { it.isThisDevice || it.ipAddress in knownIps }

    Scaffold(topBar = { TopAppBar(title = { Text("Devices on your network") }) }) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { ScanCard(scanState, progress, scanResult, onScan = { viewModel.scanNetwork() }) }

            item { AlertsCard(viewModel) }

            if (unrecognized.isNotEmpty()) {
                item {
                    SectionCard(title = "Unrecognized devices") {
                        Text(
                            "These responded on your network but aren't on your known-devices list. " +
                                "If you don't recognize one, consider changing your Wi-Fi password.",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
                items(unrecognized, key = { it.ipAddress }) { device ->
                    DeviceRow(
                        device = device,
                        severity = Severity.WARNING,
                        actionLabel = "Mark as known",
                        onAction = { viewModel.markKnown(device, label = null) },
                    )
                }
            }

            if (recognized.isNotEmpty()) {
                item {
                    Text(
                        "Known devices",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
                items(recognized, key = { it.ipAddress }) { device ->
                    DeviceRow(
                        device = device,
                        severity = Severity.GOOD,
                        actionLabel = if (device.isThisDevice) null else "Forget",
                        onAction = { viewModel.forget(device.ipAddress) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ScanCard(
    scanState: LanScanState,
    progress: Float,
    scanResult: LanScanResult?,
    onScan: () -> Unit,
) {
    SectionCard(title = "Scan your network") {
        Text(
            "Best-effort local scan -- it can't read device names or manufacturers (Android " +
                "blocks that for privacy) and may miss phones/tablets that don't respond to any " +
                "probe. Treat unrecognized results as a hint to investigate, not a guarantee.",
            style = MaterialTheme.typography.bodyMedium,
        )
        Spacer(Modifier.height(8.dp))
        when (scanState) {
            LanScanState.SCANNING -> {
                Column {
                    LinearProgressIndicator(
                        progress = { progress },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Text("Scanning...", style = MaterialTheme.typography.labelSmall)
                }
            }
            else -> {
                Button(onClick = onScan, modifier = Modifier.fillMaxWidth()) {
                    Text(if (scanResult == null) "Scan network" else "Scan again")
                }
            }
        }
        scanResult?.let { result ->
            val subnetNote = if (result.wasClamped) {
                " (subnet too large to scan fully; scanned a window near this device)"
            } else {
                ""
            }
            Text(
                "Last scan: ${result.devices.size} device(s) found across ${result.scannedAddressCount} " +
                    "address(es) checked$subnetNote.",
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}

@Composable
private fun AlertsCard(viewModel: DevicesViewModel) {
    val alertsEnabled by viewModel.alertsEnabled.collectAsState()
    val notificationPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        rememberPermissionState(Manifest.permission.POST_NOTIFICATIONS)
    } else {
        null
    }
    val permissionMissing = alertsEnabled && notificationPermission?.status?.isGranted == false

    SectionCard(title = "Unrecognized-device alerts") {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Notify me when a scan finds a device I haven't marked as known",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f),
            )
            Switch(
                checked = alertsEnabled,
                onCheckedChange = { checked ->
                    viewModel.setAlertsEnabled(checked)
                    val permission = notificationPermission
                    if (checked && permission != null && !permission.status.isGranted) {
                        permission.launchPermissionRequest()
                    }
                },
            )
        }
        if (permissionMissing) {
            Text(
                "Notification permission not granted -- alerts won't show until it's allowed.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun DeviceRow(
    device: DiscoveredDevice,
    severity: Severity,
    actionLabel: String?,
    onAction: () -> Unit,
) {
    SectionCard(title = if (device.isThisDevice) "This device" else device.displayName) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(device.ipAddress, style = MaterialTheme.typography.bodyMedium)
                SeverityBadge(severity, modifier = Modifier.padding(top = 4.dp))
            }
            if (actionLabel != null) {
                TextButton(onClick = onAction) { Text(actionLabel) }
            }
        }
    }
}
