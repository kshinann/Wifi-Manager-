package com.wifihealth.manager.data.lan

/** Which addresses [LanDeviceScanner] should probe for a given own-IP/prefix-length pair. */
data class SubnetPlan(
    val addresses: List<String>,
    val totalPossibleHosts: Long,
    val wasClamped: Boolean,
)

/**
 * Pure IPv4 subnet math: computes the candidate host addresses to probe, capping how many are
 * ever materialized so a misreported or unusually large prefix (e.g. a /8) can't try to build a
 * multi-million-entry list. Kept separate from [LanDeviceScanner] so it can be unit tested
 * without sockets.
 */
object SubnetPlanner {

    fun plan(ownIpAddress: String, prefixLength: Int, maxAddresses: Int): SubnetPlan {
        val ownIp = ipToLong(ownIpAddress) ?: return SubnetPlan(emptyList(), 0, wasClamped = false)
        // Guard against nonsensical/missing prefix data by falling back to the overwhelmingly
        // common home-network size; below /8 the host range is too large to be meaningful here.
        val prefix = prefixLength.takeIf { it in 8..30 } ?: 24

        val hostBits = 32 - prefix
        val mask = (0xFFFFFFFFL shl hostBits) and 0xFFFFFFFFL
        val networkAddress = ownIp and mask
        val broadcastAddress = networkAddress or (mask.inv() and 0xFFFFFFFFL)

        val firstHost = networkAddress + 1
        val lastHost = broadcastAddress - 1
        if (firstHost > lastHost) return SubnetPlan(emptyList(), 0, wasClamped = false)

        val totalHosts = lastHost - firstHost + 1
        val (windowStart, windowEnd) = if (totalHosts <= maxAddresses) {
            firstHost to lastHost
        } else {
            val half = maxAddresses / 2L
            val start = (ownIp - half).coerceIn(firstHost, lastHost - maxAddresses + 1)
            start to (start + maxAddresses - 1).coerceAtMost(lastHost)
        }

        val addresses = (windowStart..windowEnd).map { longToIp(it) }
        return SubnetPlan(
            addresses = addresses,
            totalPossibleHosts = totalHosts,
            wasClamped = totalHosts > maxAddresses,
        )
    }

    private fun ipToLong(ip: String): Long? {
        val parts = ip.split(".")
        if (parts.size != 4) return null
        val octets = parts.map { it.toLongOrNull() ?: return null }
        if (octets.any { it !in 0..255 }) return null
        return (octets[0] shl 24) or (octets[1] shl 16) or (octets[2] shl 8) or octets[3]
    }

    private fun longToIp(value: Long): String =
        "${(value shr 24) and 0xFF}.${(value shr 16) and 0xFF}.${(value shr 8) and 0xFF}.${value and 0xFF}"
}
