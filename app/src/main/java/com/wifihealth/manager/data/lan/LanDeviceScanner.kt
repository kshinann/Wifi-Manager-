package com.wifihealth.manager.data.lan

import com.wifihealth.manager.data.model.DiscoveredDevice
import com.wifihealth.manager.data.model.LanScanResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.ConnectException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.atomic.AtomicInteger

/**
 * Best-effort local-network device discovery, without root and without any router API access.
 *
 * There is no reliable way to enumerate LAN clients from an ordinary Android app: ARP-table
 * access (which is how rooted tools/desktop scanners do this) has been locked down since
 * Android 10 specifically to stop cross-device tracking, and the router's own DHCP client list
 * -- the actually-authoritative source -- isn't exposed to LAN peers by any universal protocol.
 *
 * So this sweeps the subnet and, for each candidate address, tries a handful of commonly-open
 * TCP ports with a short timeout. A host counts as "alive" if a connection succeeds OR is
 * refused fast (a fast refusal still proves something is there; only a timeout means "probably
 * nothing here"). This reliably finds routers, computers, printers and IoT gear -- most of which
 * have at least one open port -- but can miss phones/tablets that run no listening service and
 * silently drop unsolicited traffic. It's a heuristic, not an authoritative device list.
 */
class LanDeviceScanner {

    suspend fun scan(
        ownIpAddress: String,
        subnetPrefixLength: Int,
        onProgress: (scanned: Int, total: Int) -> Unit = { _, _ -> },
    ): LanScanResult = withContext(Dispatchers.IO) {
        val plan = SubnetPlanner.plan(ownIpAddress, subnetPrefixLength, MAX_ADDRESSES_TO_SCAN)
        val semaphore = Semaphore(MAX_CONCURRENT_PROBES)
        val scannedCount = AtomicInteger(0)

        val discovered = coroutineScope {
            plan.addresses.map { ip ->
                async {
                    // Reverse DNS runs outside the permit: it has no explicit timeout and
                    // shouldn't hold a probe slot hostage while the rest of the sweep waits.
                    val alive = semaphore.withPermit {
                        val result = ip == ownIpAddress || probeHost(ip)
                        val progress = scannedCount.incrementAndGet()
                        onProgress(progress, plan.addresses.size)
                        result
                    }
                    if (!alive) return@async null
                    DiscoveredDevice(
                        ipAddress = ip,
                        hostname = if (ip == ownIpAddress) null else resolveHostname(ip),
                        isThisDevice = ip == ownIpAddress,
                    )
                }
            }.awaitAll().filterNotNull()
        }

        LanScanResult(
            devices = discovered.sortedBy { ipSortKey(it.ipAddress) },
            scannedAddressCount = plan.addresses.size,
            totalPossibleHosts = plan.totalPossibleHosts,
            wasClamped = plan.wasClamped,
            timestampEpochMillis = System.currentTimeMillis(),
        )
    }

    private fun probeHost(ip: String): Boolean = PROBE_PORTS.any { port -> tryConnect(ip, port) }

    private fun tryConnect(ip: String, port: Int): Boolean = try {
        Socket().use { it.connect(InetSocketAddress(ip, port), PROBE_TIMEOUT_MS) }
        true
    } catch (e: ConnectException) {
        // Refused fast: nothing listening on this port, but something answered -- host is up.
        true
    } catch (e: IOException) {
        // Timeout / unreachable / no route: treat as "no host here".
        false
    }

    private fun resolveHostname(ip: String): String? = try {
        val name = InetAddress.getByName(ip).canonicalHostName
        name.takeUnless { it == ip }
    } catch (e: IOException) {
        null
    }

    /** Numeric sort key so "10" doesn't sort before "9" the way plain string comparison would. */
    private fun ipSortKey(ip: String): Long {
        val parts = ip.split(".").map { it.toLongOrNull() ?: 0L }
        return (parts.getOrElse(0) { 0L } shl 24) or
            (parts.getOrElse(1) { 0L } shl 16) or
            (parts.getOrElse(2) { 0L } shl 8) or
            parts.getOrElse(3) { 0L }
    }

    companion object {
        private val PROBE_PORTS = listOf(80, 443, 8080, 22, 445, 139)
        private const val PROBE_TIMEOUT_MS = 300
        private const val MAX_CONCURRENT_PROBES = 32
        private const val MAX_ADDRESSES_TO_SCAN = 256
    }
}
