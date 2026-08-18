package com.wifihealth.manager.data.model

data class LanScanResult(
    val devices: List<DiscoveredDevice>,
    val scannedAddressCount: Int,
    val totalPossibleHosts: Long,
    val wasClamped: Boolean,
    val timestampEpochMillis: Long,
)

enum class LanScanState {
    IDLE,
    SCANNING,
    DONE,
}
