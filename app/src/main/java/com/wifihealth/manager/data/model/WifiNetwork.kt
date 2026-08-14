package com.wifihealth.manager.data.model

/** A single Wi-Fi access point observed during a scan. */
data class WifiNetwork(
    val ssid: String,
    val bssid: String,
    val rssiDbm: Int,
    val frequencyMhz: Int,
    val channel: Int,
    val band: Band,
    val security: SecurityType,
    val isHidden: Boolean,
) {
    val signalQuality: SignalQuality get() = SignalQuality.fromRssi(rssiDbm)
}

/** Bucketed signal strength, shared by scan results and the active connection. */
enum class SignalQuality(val label: String) {
    EXCELLENT("Excellent"),
    GOOD("Good"),
    FAIR("Fair"),
    WEAK("Weak");

    companion object {
        fun fromRssi(rssiDbm: Int): SignalQuality = when {
            rssiDbm >= -50 -> EXCELLENT
            rssiDbm >= -60 -> GOOD
            rssiDbm >= -70 -> FAIR
            else -> WEAK
        }
    }
}
