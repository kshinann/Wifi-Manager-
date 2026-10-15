package com.wifihealth.manager.data.model

import kotlinx.serialization.Serializable

/**
 * A device the user has explicitly marked as trusted, keyed by IP address.
 *
 * IP is the only stable-ish identifier this app can get (see [DiscoveredDevice]) -- it is
 * *not* a durable device identity. A device can reappear as "unrecognized" after a DHCP lease
 * change (e.g. a router reboot reassigns addresses), which is a known limitation of scanning
 * without root/router access, not a bug.
 */
@Serializable
data class KnownDevice(
    val ipAddress: String,
    val label: String?,
    val markedKnownEpochMillis: Long,
)
