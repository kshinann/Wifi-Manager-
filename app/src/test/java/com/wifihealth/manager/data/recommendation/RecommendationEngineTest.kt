package com.wifihealth.manager.data.recommendation

import com.wifihealth.manager.data.model.Band
import com.wifihealth.manager.data.model.ConnectionSnapshot
import com.wifihealth.manager.data.model.RecommendationCategory
import com.wifihealth.manager.data.model.SecurityType
import com.wifihealth.manager.data.model.Severity
import com.wifihealth.manager.data.model.SpeedTestResult
import com.wifihealth.manager.data.model.WifiNetwork
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RecommendationEngineTest {

    private fun connection(
        ssid: String? = "HomeNet",
        rssiDbm: Int? = -55,
        band: Band = Band.GHZ_5,
        channel: Int? = 36,
        security: SecurityType = SecurityType.WPA2,
        linkSpeedMbps: Int? = 400,
        dnsServers: List<String> = listOf("1.1.1.1"),
    ) = ConnectionSnapshot(
        ssid = ssid,
        bssid = "AA:BB:CC:00:00:01",
        rssiDbm = rssiDbm,
        frequencyMhz = null,
        channel = channel,
        band = band,
        linkSpeedMbps = linkSpeedMbps,
        txLinkSpeedMbps = linkSpeedMbps,
        rxLinkSpeedMbps = linkSpeedMbps,
        security = security,
        ipAddress = "192.168.1.50",
        subnetPrefixLength = 24,
        gateway = "192.168.1.1",
        dnsServers = dnsServers,
        dhcpLeaseSeconds = 3600,
    )

    private fun network(
        ssid: String,
        bssid: String,
        rssiDbm: Int,
        band: Band,
        channel: Int,
    ) = WifiNetwork(
        ssid = ssid,
        bssid = bssid,
        rssiDbm = rssiDbm,
        frequencyMhz = 0,
        channel = channel,
        band = band,
        security = SecurityType.WPA2,
        isHidden = false,
        channelWidthLabel = "20 MHz",
        lastSeenSecondsAgo = 0,
        rawCapabilities = "",
    )

    private fun speedTest(
        downloadMbps: Double? = 300.0,
        latencyMs: Double? = 10.0,
        jitterMs: Double? = 2.0,
        packetLossPercent: Double? = 0.0,
        localLatencyMs: Double? = 5.0,
    ) = SpeedTestResult(
        timestampEpochMillis = 0,
        ssid = "HomeNet",
        downloadMbps = downloadMbps,
        uploadMbps = 50.0,
        latencyMs = latencyMs,
        jitterMs = jitterMs,
        packetLossPercent = packetLossPercent,
        localLatencyMs = localLatencyMs,
    )

    // ---- signal --------------------------------------------------------------

    @Test fun `not connected yields a warning and zero signal score`() {
        val report = RecommendationEngine.evaluate(
            connection = connection(ssid = null, rssiDbm = null),
            nearbyNetworks = emptyList(),
            speedTest = null,
        )
        assertEquals(0, report.healthScore.signalScore)
        assertTrue(report.recommendations.any { it.title == "Not connected to Wi-Fi" && it.severity == Severity.WARNING })
    }

    @Test fun `very weak signal is a critical recommendation`() {
        val report = RecommendationEngine.evaluate(
            connection = connection(rssiDbm = -85),
            nearbyNetworks = emptyList(),
            speedTest = null,
        )
        assertTrue(report.recommendations.any { it.category == RecommendationCategory.SIGNAL && it.severity == Severity.CRITICAL })
    }

    @Test fun `strong signal is a good recommendation`() {
        val report = RecommendationEngine.evaluate(
            connection = connection(rssiDbm = -40),
            nearbyNetworks = emptyList(),
            speedTest = null,
        )
        assertEquals(40, report.healthScore.signalScore)
        assertTrue(report.recommendations.any { it.category == RecommendationCategory.SIGNAL && it.severity == Severity.GOOD })
    }

    // ---- security --------------------------------------------------------------

    @Test fun `open network is a critical security recommendation`() {
        val report = RecommendationEngine.evaluate(
            connection = connection(security = SecurityType.OPEN),
            nearbyNetworks = emptyList(),
            speedTest = null,
        )
        assertEquals(0, report.healthScore.securityScore)
        assertTrue(report.recommendations.any { it.title.contains("open") && it.severity == Severity.CRITICAL })
    }

    @Test fun `WPA3 is a good security recommendation`() {
        val report = RecommendationEngine.evaluate(
            connection = connection(security = SecurityType.WPA3),
            nearbyNetworks = emptyList(),
            speedTest = null,
        )
        assertEquals(20, report.healthScore.securityScore)
        assertTrue(report.recommendations.any { it.category == RecommendationCategory.SECURITY && it.severity == Severity.GOOD })
    }

    // ---- overall score --------------------------------------------------------------

    @Test fun `overall score is scaled to 100 when there is no speed test`() {
        val report = RecommendationEngine.evaluate(
            connection = connection(rssiDbm = -40, security = SecurityType.WPA3, band = Band.UNKNOWN, channel = null),
            nearbyNetworks = emptyList(),
            speedTest = null,
        )
        // signal(40) + security(20) + congestion(20, no band) = 80 -> scaled to 100
        assertEquals(100, report.healthScore.overall)
        assertEquals(null, report.healthScore.performanceScore)
    }

    @Test fun `overall score sums all four components when a speed test is present`() {
        val report = RecommendationEngine.evaluate(
            connection = connection(rssiDbm = -40, security = SecurityType.WPA3, band = Band.UNKNOWN, channel = null),
            nearbyNetworks = emptyList(),
            speedTest = speedTest(latencyMs = 10.0, jitterMs = 2.0, packetLossPercent = 0.0),
        )
        assertEquals(20, report.healthScore.performanceScore)
        // 40 + 20 + 20 + 20 = 100
        assertEquals(100, report.healthScore.overall)
    }

    // ---- congestion / channel suggestion --------------------------------------------------------------

    @Test fun `congested channel with a clearly better option is flagged`() {
        val crowded = listOf(
            network("Other1", "11:11:11:11:11:01", rssiDbm = -40, band = Band.GHZ_2_4, channel = 6),
            network("Other2", "11:11:11:11:11:02", rssiDbm = -45, band = Band.GHZ_2_4, channel = 6),
            network("Other3", "11:11:11:11:11:03", rssiDbm = -40, band = Band.GHZ_2_4, channel = 7),
        )
        val report = RecommendationEngine.evaluate(
            connection = connection(band = Band.GHZ_2_4, channel = 6),
            nearbyNetworks = crowded,
            speedTest = null,
        )
        assertTrue(report.recommendations.any { it.category == RecommendationCategory.CONGESTION && it.title.contains("congested") })
    }

    // ---- band --------------------------------------------------------------

    @Test fun `suggests switching to 5GHz when the same SSID is available and strong`() {
        val alt = listOf(network("HomeNet", "AA:BB:CC:00:00:02", rssiDbm = -60, band = Band.GHZ_5, channel = 36))
        val report = RecommendationEngine.evaluate(
            connection = connection(band = Band.GHZ_2_4, channel = 6, ssid = "HomeNet"),
            nearbyNetworks = alt,
            speedTest = null,
        )
        assertTrue(report.recommendations.any { it.category == RecommendationCategory.BAND && it.title.contains("5 GHz") })
    }

    @Test fun `suggests falling back to 2_4GHz when 5GHz signal is weak`() {
        val alt = listOf(network("HomeNet", "AA:BB:CC:00:00:02", rssiDbm = -50, band = Band.GHZ_2_4, channel = 6))
        val report = RecommendationEngine.evaluate(
            connection = connection(band = Band.GHZ_5, channel = 36, ssid = "HomeNet", rssiDbm = -80),
            nearbyNetworks = alt,
            speedTest = null,
        )
        assertTrue(report.recommendations.any { it.category == RecommendationCategory.BAND && it.title.contains("2.4 GHz") })
    }

    // ---- DNS --------------------------------------------------------------

    @Test fun `missing DNS servers is flagged when connected`() {
        val report = RecommendationEngine.evaluate(
            connection = connection(dnsServers = emptyList()),
            nearbyNetworks = emptyList(),
            speedTest = null,
        )
        assertTrue(report.recommendations.any { it.title == "No DNS servers detected" })
    }

    @Test fun `missing DNS servers is not flagged when not connected`() {
        val report = RecommendationEngine.evaluate(
            connection = connection(ssid = null, dnsServers = emptyList()),
            nearbyNetworks = emptyList(),
            speedTest = null,
        )
        assertTrue(report.recommendations.none { it.title == "No DNS servers detected" })
    }

    // ---- performance --------------------------------------------------------------

    @Test fun `high packet loss is a critical performance recommendation`() {
        val report = RecommendationEngine.evaluate(
            connection = connection(),
            nearbyNetworks = emptyList(),
            speedTest = speedTest(packetLossPercent = 8.0),
        )
        assertTrue(report.recommendations.any { it.category == RecommendationCategory.PERFORMANCE && it.severity == Severity.CRITICAL })
    }

    @Test fun `throughput far below link rate is flagged`() {
        val report = RecommendationEngine.evaluate(
            connection = connection(linkSpeedMbps = 400),
            nearbyNetworks = emptyList(),
            speedTest = speedTest(downloadMbps = 20.0),
        )
        assertTrue(report.recommendations.any { it.title.contains("negotiated link rate") })
    }

    @Test fun `high local latency points to local interference`() {
        val report = RecommendationEngine.evaluate(
            connection = connection(),
            nearbyNetworks = emptyList(),
            speedTest = speedTest(latencyMs = 40.0, localLatencyMs = 30.0),
        )
        assertTrue(report.recommendations.any { it.title.contains("router itself") })
    }

    @Test fun `healthy performance with no issues yields a good recommendation`() {
        val report = RecommendationEngine.evaluate(
            connection = connection(),
            nearbyNetworks = emptyList(),
            speedTest = speedTest(latencyMs = 10.0, jitterMs = 2.0, packetLossPercent = 0.0, localLatencyMs = 5.0),
        )
        assertTrue(report.recommendations.any { it.title == "Performance looks healthy" && it.severity == Severity.GOOD })
    }

    // ---- ordering --------------------------------------------------------------

    @Test fun `recommendations are sorted with the most severe first`() {
        val report = RecommendationEngine.evaluate(
            connection = connection(rssiDbm = -90, security = SecurityType.OPEN),
            nearbyNetworks = emptyList(),
            speedTest = null,
        )
        val severities = report.recommendations.map { it.severity.ordinal }
        assertEquals(severities.sorted(), severities)
    }
}
