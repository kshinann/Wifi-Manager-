package com.wifihealth.manager.data.wifi

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.Build
import com.wifihealth.manager.data.model.Band
import com.wifihealth.manager.data.model.ConnectionSnapshot
import com.wifihealth.manager.data.model.SecurityType
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import java.net.Inet4Address

/** Tracks the currently associated Wi-Fi network: signal, link speed, IP configuration. */
class ConnectionMonitor(context: Context) {

    private val appContext = context.applicationContext
    private val connectivityManager =
        appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val wifiManager = appContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    fun connectionFlow(): Flow<ConnectionSnapshot> = callbackFlow {
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .removeCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
            .build()

        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                trySend(buildSnapshot(network, capabilities))
            }

            override fun onLinkPropertiesChanged(network: Network, linkProperties: LinkProperties) {
                trySend(buildSnapshot(network, connectivityManager.getNetworkCapabilities(network)))
            }

            override fun onLost(network: Network) {
                trySend(ConnectionSnapshot.EMPTY)
            }
        }

        connectivityManager.registerNetworkCallback(request, callback)
        trySend(currentSnapshot())
        awaitClose { connectivityManager.unregisterNetworkCallback(callback) }
    }

    private fun currentSnapshot(): ConnectionSnapshot {
        val network = connectivityManager.activeNetwork ?: return ConnectionSnapshot.EMPTY
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return ConnectionSnapshot.EMPTY
        return buildSnapshot(network, capabilities)
    }

    private fun buildSnapshot(network: Network, capabilities: NetworkCapabilities?): ConnectionSnapshot {
        if (capabilities == null || !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
            return ConnectionSnapshot.EMPTY
        }
        val wifiInfo = wifiInfoFrom(capabilities) ?: return ConnectionSnapshot.EMPTY
        val linkProperties = connectivityManager.getLinkProperties(network)

        val frequency = wifiInfo.frequency.takeIf { it > 0 }
        val channel = frequency?.let { ChannelAnalyzer.frequencyToChannel(it) }?.takeIf { it > 0 }

        val ipv4Address = linkProperties?.linkAddresses?.firstOrNull { it.address is Inet4Address }
        val gateway = linkProperties?.routes
            ?.firstOrNull { it.isDefaultRoute && it.gateway is Inet4Address }
            ?.gateway?.hostAddress
        val dns = linkProperties?.dnsServers?.mapNotNull { it.hostAddress }.orEmpty()

        val leaseSeconds = try {
            @Suppress("DEPRECATION")
            wifiManager.dhcpInfo?.leaseDuration
        } catch (e: SecurityException) {
            null
        }

        return ConnectionSnapshot(
            ssid = unquoteSsid(wifiInfo.ssid),
            bssid = wifiInfo.bssid?.takeUnless { it == "02:00:00:00:00:00" },
            rssiDbm = wifiInfo.rssi,
            frequencyMhz = frequency,
            channel = channel,
            band = frequency?.let { Band.fromFrequencyMhz(it) } ?: Band.UNKNOWN,
            linkSpeedMbps = wifiInfo.linkSpeed.takeIf { it >= 0 },
            txLinkSpeedMbps = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                wifiInfo.txLinkSpeedMbps.takeIf { it > 0 }
            } else null,
            rxLinkSpeedMbps = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                wifiInfo.rxLinkSpeedMbps.takeIf { it > 0 }
            } else null,
            security = securityTypeFor(wifiInfo),
            ipAddress = ipv4Address?.address?.hostAddress,
            subnetPrefixLength = ipv4Address?.prefixLength,
            gateway = gateway,
            dnsServers = dns,
            dhcpLeaseSeconds = leaseSeconds,
        )
    }

    /**
     * [NetworkCapabilities.getTransportInfo] is the non-deprecated way to read [WifiInfo]
     * starting API 31; below that we fall back to the (still functional) legacy accessor.
     */
    private fun wifiInfoFrom(capabilities: NetworkCapabilities): WifiInfo? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            capabilities.transportInfo as? WifiInfo
        } else {
            @Suppress("DEPRECATION")
            wifiManager.connectionInfo
        }

    private fun securityTypeFor(wifiInfo: WifiInfo): SecurityType {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return SecurityType.UNKNOWN
        return when (wifiInfo.currentSecurityType) {
            WifiInfo.SECURITY_TYPE_OPEN -> SecurityType.OPEN
            WifiInfo.SECURITY_TYPE_WEP -> SecurityType.WEP
            WifiInfo.SECURITY_TYPE_PSK -> SecurityType.WPA2
            WifiInfo.SECURITY_TYPE_SAE -> SecurityType.WPA3
            WifiInfo.SECURITY_TYPE_OWE -> SecurityType.ENHANCED_OPEN
            WifiInfo.SECURITY_TYPE_EAP,
            WifiInfo.SECURITY_TYPE_EAP_WPA3_ENTERPRISE,
            WifiInfo.SECURITY_TYPE_EAP_WPA3_ENTERPRISE_192_BIT -> SecurityType.ENTERPRISE
            else -> SecurityType.UNKNOWN
        }
    }

    private fun unquoteSsid(raw: String?): String? {
        if (raw == null || raw == WifiManager.UNKNOWN_SSID) return null
        return raw.removeSurrounding("\"")
    }
}
