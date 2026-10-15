package com.wifihealth.manager.data.model

/**
 * A host that responded during a local-network scan. [hostname] is best-effort (via reverse
 * DNS) and very often null, since most home routers don't run reverse DNS for their clients.
 * There is deliberately no MAC address / vendor field: modern Android blocks apps from reading
 * other devices' MAC addresses via ARP, so this app can identify a device by IP (and hostname,
 * when available) only.
 */
data class DiscoveredDevice(
    val ipAddress: String,
    val hostname: String?,
    val isThisDevice: Boolean = false,
) {
    val displayName: String get() = hostname ?: ipAddress
}
