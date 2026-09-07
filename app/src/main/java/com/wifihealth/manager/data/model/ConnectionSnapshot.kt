package com.wifihealth.manager.data.model

/** Point-in-time picture of the Wi-Fi network the device is currently associated with. */
data class ConnectionSnapshot(
    val ssid: String?,
    val bssid: String?,
    val rssiDbm: Int?,
    val frequencyMhz: Int?,
    val channel: Int?,
    val band: Band,
    val linkSpeedMbps: Int?,
    val txLinkSpeedMbps: Int?,
    val rxLinkSpeedMbps: Int?,
    val security: SecurityType,
    val ipAddress: String?,
    val subnetPrefixLength: Int?,
    val gateway: String?,
    val dnsServers: List<String>,
    val dhcpLeaseSeconds: Int?,
) {
    val signalQuality: SignalQuality? get() = rssiDbm?.let { SignalQuality.fromRssi(it) }

    companion object {
        val EMPTY = ConnectionSnapshot(
            ssid = null,
            bssid = null,
            rssiDbm = null,
            frequencyMhz = null,
            channel = null,
            band = Band.UNKNOWN,
            linkSpeedMbps = null,
            txLinkSpeedMbps = null,
            rxLinkSpeedMbps = null,
            security = SecurityType.UNKNOWN,
            ipAddress = null,
            subnetPrefixLength = null,
            gateway = null,
            dnsServers = emptyList(),
            dhcpLeaseSeconds = null,
        )
    }
}
