package com.wifihealth.manager.data.lan

import com.wifihealth.manager.data.model.DiscoveredDevice

/**
 * Devices from a scan that aren't this device and aren't on the known-devices allow-list.
 * Shared between the Devices screen (what to list as "unrecognized") and [DeviceAlertNotifier]
 * (what to notify about) so the two can never disagree on the definition.
 */
fun List<DiscoveredDevice>.unrecognizedDevices(knownIps: Set<String>): List<DiscoveredDevice> =
    filter { !it.isThisDevice && it.ipAddress !in knownIps }
