package com.wifihealth.manager.data.wifi

import com.wifihealth.manager.data.model.Band
import com.wifihealth.manager.data.model.ChannelCongestion
import com.wifihealth.manager.data.model.WifiNetwork
import kotlin.math.abs

/**
 * Frequency/channel math and channel-congestion scoring.
 *
 * 2.4 GHz channels are only 5 MHz apart but each occupies ~22 MHz, so
 * anything within 4 channel numbers of another AP overlaps and contributes
 * interference. 5/6 GHz channels are spaced far enough apart (20 MHz steps)
 * that only exact-channel matches meaningfully compete for airtime.
 */
object ChannelAnalyzer {

    /** Non-overlapping 2.4 GHz channels recommended for router configuration. */
    val RECOMMENDED_2_4_GHZ_CHANNELS = listOf(1, 6, 11)

    /** Common non-DFS 5 GHz channels available on most consumer routers. */
    val COMMON_5_GHZ_CHANNELS = listOf(36, 40, 44, 48, 149, 153, 157, 161, 165)

    fun frequencyToChannel(freqMhz: Int): Int = when {
        freqMhz == 2484 -> 14
        freqMhz in 2412..2472 -> (freqMhz - 2412) / 5 + 1
        freqMhz in 5170..5825 -> (freqMhz - 5000) / 5
        freqMhz in 5955..7115 -> (freqMhz - 5950) / 5
        else -> -1
    }

    /** Interference weight for a signal at [rssiDbm]: stronger signals crowd the air more. */
    private fun interferenceWeight(rssiDbm: Int): Int = when {
        rssiDbm >= -50 -> 10
        rssiDbm >= -60 -> 7
        rssiDbm >= -70 -> 4
        rssiDbm >= -80 -> 2
        else -> 1
    }

    private fun overlaps(channelA: Int, channelB: Int, band: Band): Boolean =
        if (band == Band.GHZ_2_4) abs(channelA - channelB) <= 4 else channelA == channelB

    /** Congestion score for one specific channel/band, given all networks currently seen. */
    fun congestionScoreFor(channel: Int, band: Band, networks: List<WifiNetwork>): Int =
        networks.filter { it.band == band && overlaps(it.channel, channel, band) }
            .sumOf { interferenceWeight(it.rssiDbm) }

    /** Congestion for every channel actually in use among [networks], grouped by band. */
    fun analyze(networks: List<WifiNetwork>): List<ChannelCongestion> {
        val relevant = networks.filter { it.band == Band.GHZ_2_4 || it.band == Band.GHZ_5 || it.band == Band.GHZ_6 }
        val channelsInUse = relevant.map { it.channel to it.band }.distinct()
        return channelsInUse.map { (channel, band) ->
            val apCount = relevant.count { it.band == band && it.channel == channel }
            ChannelCongestion(
                channel = channel,
                band = band,
                apCount = apCount,
                congestionScore = congestionScoreFor(channel, band, relevant),
            )
        }.sortedByDescending { it.congestionScore }
    }

    /**
     * Suggests the least congested channel for [band] (excluding [currentChannel]),
     * or null if there's no meaningfully better option.
     */
    fun suggestBetterChannel(currentChannel: Int, band: Band, networks: List<WifiNetwork>): Int? {
        val candidates = when (band) {
            Band.GHZ_2_4 -> RECOMMENDED_2_4_GHZ_CHANNELS
            Band.GHZ_5 -> COMMON_5_GHZ_CHANNELS
            else -> return null
        }.filter { it != currentChannel }
        if (candidates.isEmpty()) return null

        val currentScore = congestionScoreFor(currentChannel, band, networks)
        val best = candidates.minByOrNull { congestionScoreFor(it, band, networks) } ?: return null
        val bestScore = congestionScoreFor(best, band, networks)

        // Only worth recommending a change if it meaningfully reduces contention.
        return if (currentScore > 0 && bestScore < currentScore * 0.6) best else null
    }
}
