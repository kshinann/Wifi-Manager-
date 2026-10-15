package com.wifihealth.manager.data.wifi

import com.wifihealth.manager.data.model.Band
import com.wifihealth.manager.data.model.SecurityType
import com.wifihealth.manager.data.model.WifiNetwork
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ChannelAnalyzerTest {

    private fun network(
        channel: Int,
        band: Band,
        rssiDbm: Int,
        ssid: String = "ap-$channel-${band.name}-$rssiDbm",
        bssid: String = "00:11:22:33:44:${channel.toString().padStart(2, '0')}",
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

    // ---- frequencyToChannel ----------------------------------------------

    @Test fun `2_4GHz frequencies map to channel number`() {
        assertEquals(1, ChannelAnalyzer.frequencyToChannel(2412))
        assertEquals(6, ChannelAnalyzer.frequencyToChannel(2437))
        assertEquals(13, ChannelAnalyzer.frequencyToChannel(2472))
    }

    @Test fun `2_4GHz channel 14 is a special case`() {
        assertEquals(14, ChannelAnalyzer.frequencyToChannel(2484))
    }

    @Test fun `5GHz frequencies map to channel number`() {
        assertEquals(36, ChannelAnalyzer.frequencyToChannel(5180))
        assertEquals(165, ChannelAnalyzer.frequencyToChannel(5825))
    }

    @Test fun `6GHz frequencies map to channel number`() {
        assertEquals(1, ChannelAnalyzer.frequencyToChannel(5955))
        assertEquals(233, ChannelAnalyzer.frequencyToChannel(7115))
    }

    @Test fun `out-of-range frequency returns -1`() {
        assertEquals(-1, ChannelAnalyzer.frequencyToChannel(1000))
    }

    // ---- congestionScoreFor -----------------------------------------------

    @Test fun `2_4GHz channels within 4 of each other overlap and contribute`() {
        val networks = listOf(network(channel = 3, band = Band.GHZ_2_4, rssiDbm = -50))
        // channel 1 is within 4 of channel 3 -> overlaps
        assertTrue(ChannelAnalyzer.congestionScoreFor(1, Band.GHZ_2_4, networks) > 0)
    }

    @Test fun `2_4GHz channels more than 4 apart do not overlap`() {
        val networks = listOf(network(channel = 11, band = Band.GHZ_2_4, rssiDbm = -50))
        assertEquals(0, ChannelAnalyzer.congestionScoreFor(1, Band.GHZ_2_4, networks))
    }

    @Test fun `5GHz channels only compete on an exact match`() {
        val networks = listOf(network(channel = 36, band = Band.GHZ_5, rssiDbm = -50))
        assertEquals(0, ChannelAnalyzer.congestionScoreFor(40, Band.GHZ_5, networks))
        assertTrue(ChannelAnalyzer.congestionScoreFor(36, Band.GHZ_5, networks) > 0)
    }

    @Test fun `stronger signals contribute more interference weight`() {
        val strong = listOf(network(channel = 6, band = Band.GHZ_2_4, rssiDbm = -45))
        val weak = listOf(network(channel = 6, band = Band.GHZ_2_4, rssiDbm = -85))
        val strongScore = ChannelAnalyzer.congestionScoreFor(6, Band.GHZ_2_4, strong)
        val weakScore = ChannelAnalyzer.congestionScoreFor(6, Band.GHZ_2_4, weak)
        assertTrue(strongScore > weakScore)
    }

    @Test fun `networks on a different band never contribute`() {
        val networks = listOf(network(channel = 6, band = Band.GHZ_5, rssiDbm = -40))
        assertEquals(0, ChannelAnalyzer.congestionScoreFor(6, Band.GHZ_2_4, networks))
    }

    // ---- analyze ------------------------------------------------------------

    @Test fun `analyze groups by channel+band and sorts most congested first`() {
        val networks = listOf(
            network(channel = 1, band = Band.GHZ_2_4, rssiDbm = -80),
            network(channel = 6, band = Band.GHZ_2_4, rssiDbm = -45),
            network(channel = 6, band = Band.GHZ_2_4, rssiDbm = -45),
        )
        val result = ChannelAnalyzer.analyze(networks)
        assertEquals(6, result.first().channel)
        assertEquals(2, result.first().apCount)
    }

    @Test fun `analyze excludes networks with an unknown band`() {
        val networks = listOf(network(channel = 1, band = Band.UNKNOWN, rssiDbm = -50))
        assertTrue(ChannelAnalyzer.analyze(networks).isEmpty())
    }

    // ---- suggestBetterChannel -----------------------------------------------

    @Test fun `suggests a recommended channel when current is heavily congested`() {
        val networks = listOf(
            network(channel = 6, band = Band.GHZ_2_4, rssiDbm = -40),
            network(channel = 6, band = Band.GHZ_2_4, rssiDbm = -45),
            network(channel = 7, band = Band.GHZ_2_4, rssiDbm = -40),
        )
        val suggestion = ChannelAnalyzer.suggestBetterChannel(6, Band.GHZ_2_4, networks)
        assertEquals(1, suggestion)
    }

    @Test fun `no suggestion when current channel is already clear`() {
        val networks = listOf(network(channel = 6, band = Band.GHZ_2_4, rssiDbm = -80))
        assertNull(ChannelAnalyzer.suggestBetterChannel(1, Band.GHZ_2_4, networks))
    }

    @Test fun `no suggestion for a band with no candidate list`() {
        val networks = listOf(network(channel = 37, band = Band.GHZ_6, rssiDbm = -40))
        assertNull(ChannelAnalyzer.suggestBetterChannel(37, Band.GHZ_6, networks))
    }
}
