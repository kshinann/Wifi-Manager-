package com.wifihealth.manager.data.model

import kotlinx.serialization.Serializable

@Serializable
data class SpeedTestResult(
    val timestampEpochMillis: Long,
    val ssid: String?,
    val downloadMbps: Double?,
    val uploadMbps: Double?,
    val latencyMs: Double?,
    val jitterMs: Double?,
    val packetLossPercent: Double?,
    val localLatencyMs: Double?,
)
