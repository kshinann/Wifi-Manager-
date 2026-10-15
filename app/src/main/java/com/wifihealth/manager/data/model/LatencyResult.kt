package com.wifihealth.manager.data.model

/** Result of a series of TCP-connect latency probes against a single host. */
data class LatencyResult(
    val avgMs: Double?,
    val jitterMs: Double?,
    val packetLossPercent: Double,
) {
    companion object {
        val UNREACHABLE = LatencyResult(avgMs = null, jitterMs = null, packetLossPercent = 100.0)
    }
}
