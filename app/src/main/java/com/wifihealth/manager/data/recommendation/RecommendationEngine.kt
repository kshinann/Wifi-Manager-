package com.wifihealth.manager.data.recommendation

import com.wifihealth.manager.data.model.Band
import com.wifihealth.manager.data.model.ConnectionSnapshot
import com.wifihealth.manager.data.model.HealthScore
import com.wifihealth.manager.data.model.NetworkHealthReport
import com.wifihealth.manager.data.model.Recommendation
import com.wifihealth.manager.data.model.RecommendationCategory
import com.wifihealth.manager.data.model.SecurityType
import com.wifihealth.manager.data.model.Severity
import com.wifihealth.manager.data.model.SpeedTestResult
import com.wifihealth.manager.data.model.WifiNetwork
import com.wifihealth.manager.data.wifi.ChannelAnalyzer
import kotlin.math.roundToInt

/**
 * Turns raw connection/scan/speed-test data into a 0-100 health score and a
 * list of plain-language, actionable recommendations. Pure and stateless so
 * it can be unit tested without any Android framework dependency.
 */
object RecommendationEngine {

    fun evaluate(
        connection: ConnectionSnapshot,
        nearbyNetworks: List<WifiNetwork>,
        speedTest: SpeedTestResult?,
    ): NetworkHealthReport {
        val recommendations = mutableListOf<Recommendation>()

        val signalScore = signalScore(connection.rssiDbm)
        recommendations += signalRecommendation(connection.rssiDbm)

        val securityScore = securityScore(connection.security)
        recommendations += securityRecommendation(connection.security)

        val congestionScore = congestionScore(connection, nearbyNetworks)
        recommendationsForCongestion(connection, nearbyNetworks)?.let { recommendations += it }

        bandRecommendation(connection, nearbyNetworks)?.let { recommendations += it }

        val performanceScore = speedTest?.let { performanceScore(it, connection) }
        if (speedTest != null) {
            recommendations += performanceRecommendations(speedTest, connection)
        }

        if (connection.dnsServers.isEmpty() && connection.ssid != null) {
            recommendations += Recommendation(
                category = RecommendationCategory.CONFIGURATION,
                severity = Severity.INFO,
                title = "No DNS servers detected",
                detail = "The router isn't advertising any DNS servers over DHCP. Most setups work fine, but if pages fail to load try setting a public DNS (e.g. 1.1.1.1 or 8.8.8.8) on the router.",
            )
        }

        val overall = if (performanceScore != null) {
            signalScore + securityScore + congestionScore + performanceScore
        } else {
            (((signalScore + securityScore + congestionScore) / 80.0) * 100).roundToInt()
        }.coerceIn(0, 100)

        val healthScore = HealthScore(
            overall = overall,
            signalScore = signalScore,
            securityScore = securityScore,
            congestionScore = congestionScore,
            performanceScore = performanceScore,
        )

        return NetworkHealthReport(
            healthScore = healthScore,
            recommendations = recommendations.sortedBy { it.severity.ordinal },
        )
    }

    // ---- Signal ---------------------------------------------------------

    private fun signalScore(rssi: Int?): Int = when {
        rssi == null -> 0
        rssi >= -50 -> 40
        rssi >= -60 -> 32
        rssi >= -70 -> 20
        rssi >= -80 -> 10
        else -> 4
    }

    private fun signalRecommendation(rssi: Int?): Recommendation = when {
        rssi == null -> Recommendation(
            RecommendationCategory.SIGNAL, Severity.WARNING,
            "Not connected to Wi-Fi",
            "Connect to a Wi-Fi network to run a full health check.",
        )
        rssi < -80 -> Recommendation(
            RecommendationCategory.SIGNAL, Severity.CRITICAL,
            "Very weak signal ($rssi dBm)",
            "This device is far from the router or blocked by walls/floors. Move closer, relocate the router, or add a mesh extender near this location.",
        )
        rssi < -67 -> Recommendation(
            RecommendationCategory.SIGNAL, Severity.WARNING,
            "Weak signal ($rssi dBm)",
            "Signal is usable but marginal. Moving closer to the router or removing obstructions should noticeably improve reliability.",
        )
        rssi < -55 -> Recommendation(
            RecommendationCategory.SIGNAL, Severity.INFO,
            "Decent signal ($rssi dBm)",
            "Signal is good for browsing, but heavy video calls or large transfers may benefit from being closer to the router.",
        )
        else -> Recommendation(
            RecommendationCategory.SIGNAL, Severity.GOOD,
            "Strong signal ($rssi dBm)",
            "Signal strength is excellent at this location.",
        )
    }

    // ---- Security ---------------------------------------------------------

    private fun securityScore(security: SecurityType): Int = when (security) {
        SecurityType.WPA3, SecurityType.ENTERPRISE -> 20
        SecurityType.WPA2 -> 16
        SecurityType.WPA -> 8
        SecurityType.WEP -> 2
        SecurityType.OPEN -> 0
        SecurityType.UNKNOWN -> 10
    }

    private fun securityRecommendation(security: SecurityType): Recommendation = when (security) {
        SecurityType.OPEN -> Recommendation(
            RecommendationCategory.SECURITY, Severity.CRITICAL,
            "Network is open (no password)",
            "Anyone nearby can join and intercept traffic. Enable WPA2 or WPA3 encryption on the router immediately.",
        )
        SecurityType.WEP -> Recommendation(
            RecommendationCategory.SECURITY, Severity.CRITICAL,
            "WEP encryption is obsolete",
            "WEP can be broken in minutes with freely available tools. Switch the router to WPA2-PSK (AES) or WPA3.",
        )
        SecurityType.WPA -> Recommendation(
            RecommendationCategory.SECURITY, Severity.WARNING,
            "Using legacy WPA (TKIP)",
            "WPA/TKIP is outdated and limits throughput. Upgrade the router to WPA2 or WPA3 for better security and speed.",
        )
        SecurityType.WPA2 -> Recommendation(
            RecommendationCategory.SECURITY, Severity.INFO,
            "Good security (WPA2)",
            "WPA2 is solid. If the router and your devices support it, WPA3 offers even stronger protection against offline password attacks.",
        )
        SecurityType.WPA3, SecurityType.ENTERPRISE -> Recommendation(
            RecommendationCategory.SECURITY, Severity.GOOD,
            "Strong security (${security.label})",
            "This is the current best-practice encryption standard for Wi-Fi.",
        )
        SecurityType.UNKNOWN -> Recommendation(
            RecommendationCategory.SECURITY, Severity.INFO,
            "Security type could not be determined",
            "Grant location/nearby-devices permission so the app can read the encryption type in use.",
        )
    }

    // ---- Channel congestion ------------------------------------------------

    private const val CONGESTION_NORMALIZATION_MAX = 30.0

    private fun congestionScore(connection: ConnectionSnapshot, networks: List<WifiNetwork>): Int {
        val channel = connection.channel ?: return 20
        if (connection.band != Band.GHZ_2_4 && connection.band != Band.GHZ_5 && connection.band != Band.GHZ_6) return 20
        val raw = ChannelAnalyzer.congestionScoreFor(channel, connection.band, networks)
        val penalty = ((raw / CONGESTION_NORMALIZATION_MAX) * 20).roundToInt()
        return (20 - penalty).coerceIn(0, 20)
    }

    private fun recommendationsForCongestion(
        connection: ConnectionSnapshot,
        networks: List<WifiNetwork>,
    ): Recommendation? {
        val channel = connection.channel ?: return null
        val band = connection.band
        if (band != Band.GHZ_2_4 && band != Band.GHZ_5) return null

        val competingApCount = networks.count {
            it.band == band && it.bssid != connection.bssid && it.channel == channel
        }
        val suggestion = ChannelAnalyzer.suggestBetterChannel(channel, band, networks)

        return when {
            suggestion != null -> Recommendation(
                RecommendationCategory.CONGESTION, Severity.WARNING,
                "Channel $channel is congested",
                "$competingApCount other network(s) share channel $channel, and more overlap it partially. Try switching the router to channel $suggestion in its admin settings.",
            )
            competingApCount >= 4 -> Recommendation(
                RecommendationCategory.CONGESTION, Severity.INFO,
                "Several networks share this area",
                "Multiple access points are visible nearby. If speeds dip at peak times, try alternate channels or the other frequency band.",
            )
            else -> null
        }
    }

    // ---- Band ---------------------------------------------------------------

    private fun bandRecommendation(connection: ConnectionSnapshot, networks: List<WifiNetwork>): Recommendation? {
        val ssid = connection.ssid ?: return null
        if (connection.band == Band.GHZ_2_4) {
            val strongerAlt = networks.firstOrNull {
                it.ssid == ssid && (it.band == Band.GHZ_5 || it.band == Band.GHZ_6) && it.rssiDbm >= -70
            }
            if (strongerAlt != null) {
                return Recommendation(
                    RecommendationCategory.BAND, Severity.INFO,
                    "${strongerAlt.band.label} band available",
                    "This router also broadcasts \"$ssid\" on ${strongerAlt.band.label}, which is usually faster and less congested. Switch to it if your device is close enough to the router.",
                )
            }
        } else if (connection.band == Band.GHZ_5 || connection.band == Band.GHZ_6) {
            val rssi = connection.rssiDbm ?: return null
            val fallback = networks.firstOrNull { it.ssid == ssid && it.band == Band.GHZ_2_4 }
            if (rssi < -75 && fallback != null) {
                return Recommendation(
                    RecommendationCategory.BAND, Severity.INFO,
                    "2.4 GHz has longer range",
                    "Signal is weak on ${connection.band.label} at this distance. The 2.4 GHz band on this router will reach further, at the cost of some speed.",
                )
            }
        }
        return null
    }

    // ---- Performance (speed test) -------------------------------------------

    private fun performanceScore(result: SpeedTestResult, connection: ConnectionSnapshot): Int {
        val latencyPts = when (val l = result.latencyMs) {
            null -> 4
            else -> when {
                l <= 20 -> 8
                l <= 50 -> 6
                l <= 100 -> 3
                else -> 0
            }
        }
        val jitterPts = when (val j = result.jitterMs) {
            null -> 3
            else -> when {
                j <= 5 -> 6
                j <= 15 -> 4
                j <= 30 -> 2
                else -> 0
            }
        }
        val lossPts = when (val loss = result.packetLossPercent) {
            null -> 3
            else -> when {
                loss <= 0.5 -> 6
                loss <= 3 -> 3
                else -> 0
            }
        }
        return (latencyPts + jitterPts + lossPts).coerceIn(0, 20)
    }

    private fun performanceRecommendations(
        result: SpeedTestResult,
        connection: ConnectionSnapshot,
    ): List<Recommendation> {
        val recs = mutableListOf<Recommendation>()

        result.packetLossPercent?.let { loss ->
            if (loss > 5) {
                recs += Recommendation(
                    RecommendationCategory.PERFORMANCE, Severity.CRITICAL,
                    "Packet loss detected (${loss.roundToInt()}%)",
                    "Dropped packets cause stutter and retries. Check for interference, a failing cable, or contact your ISP if this persists.",
                )
            }
        }

        result.latencyMs?.let { latency ->
            if (latency > 100) {
                recs += Recommendation(
                    RecommendationCategory.PERFORMANCE, Severity.WARNING,
                    "High latency (${latency.roundToInt()} ms)",
                    "This will make calls and gaming feel laggy. If local latency is also high, the issue is likely local interference; if only internet latency is high, it's likely upstream of the router.",
                )
            }
        }

        result.jitterMs?.let { jitter ->
            if (jitter > 30) {
                recs += Recommendation(
                    RecommendationCategory.PERFORMANCE, Severity.WARNING,
                    "Unstable connection (jitter ${jitter.roundToInt()} ms)",
                    "Latency is swinging significantly between probes, which points to congestion or interference rather than distance.",
                )
            }
        }

        val linkSpeed = connection.linkSpeedMbps
        val download = result.downloadMbps
        if (linkSpeed != null && linkSpeed > 0 && download != null && download < linkSpeed * 0.2) {
            recs += Recommendation(
                RecommendationCategory.PERFORMANCE, Severity.WARNING,
                "Throughput far below the negotiated link rate",
                "The radio negotiated a $linkSpeed Mbps link, but measured throughput was only ${download.roundToInt()} Mbps. Try rebooting the router, checking for interference, or verifying the internet plan speed.",
            )
        }

        if (result.localLatencyMs != null && result.latencyMs != null) {
            val gap = result.latencyMs - result.localLatencyMs
            if (result.localLatencyMs > 15) {
                recs += Recommendation(
                    RecommendationCategory.PERFORMANCE, Severity.WARNING,
                    "High latency to the router itself",
                    "Even the hop to your own router is slow (${result.localLatencyMs.roundToInt()} ms), which points to local Wi-Fi interference or a router under heavy load rather than an ISP issue.",
                )
            } else if (gap > 80) {
                recs += Recommendation(
                    RecommendationCategory.PERFORMANCE, Severity.INFO,
                    "Latency looks upstream of the router",
                    "The local hop is fast, but overall latency is much higher — this points to the ISP or internet path rather than your Wi-Fi setup.",
                )
            }
        }

        if (recs.isEmpty()) {
            recs += Recommendation(
                RecommendationCategory.PERFORMANCE, Severity.GOOD,
                "Performance looks healthy",
                "Latency, jitter and packet loss are all within normal ranges for this test.",
            )
        }
        return recs
    }
}
