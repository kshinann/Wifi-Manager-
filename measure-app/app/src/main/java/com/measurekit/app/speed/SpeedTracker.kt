package com.measurekit.app.speed

import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin
import kotlin.math.sqrt

/** One GPS fix. [speed] is the receiver-reported speed in m/s when available. */
data class Fix(
    val timeMillis: Long,
    val latitude: Double,
    val longitude: Double,
    val speed: Float?,
    val accuracyMeters: Float,
)

data class SpeedStats(
    val currentMs: Double = 0.0,
    val maxMs: Double = 0.0,
    val averageMs: Double = 0.0,
    val distanceMeters: Double = 0.0,
    val movingMillis: Long = 0,
    val accuracyMeters: Float? = null,
    val fixCount: Int = 0,
)

/**
 * Turns a stream of GPS fixes into speed statistics. It ignores inaccurate fixes and
 * treats speeds below [stationaryThresholdMs] as standing still, so GPS jitter
 * doesn't add distance while the phone sits on a table.
 */
class SpeedTracker(
    private val maxAccuracyMeters: Float = 30f,
    private val stationaryThresholdMs: Double = 0.5,
) {
    private var last: Fix? = null
    var stats = SpeedStats()
        private set

    fun reset() {
        last = null
        stats = SpeedStats()
    }

    /** Keeps the totals, but the next fix starts a new segment (so a pause doesn't add a jump). */
    fun breakSegment() {
        last = null
        stats = stats.copy(currentMs = 0.0)
    }

    fun onFix(fix: Fix): SpeedStats {
        val prev = last
        if (fix.accuracyMeters > maxAccuracyMeters) {
            stats = stats.copy(accuracyMeters = fix.accuracyMeters)
            return stats
        }
        last = fix
        if (prev == null) {
            val s = fix.speed?.toDouble() ?: 0.0
            stats = stats.copy(currentMs = s, maxMs = max(stats.maxMs, s), accuracyMeters = fix.accuracyMeters, fixCount = stats.fixCount + 1)
            return stats
        }

        val dtMillis = fix.timeMillis - prev.timeMillis
        if (dtMillis <= 0) return stats
        val segment = haversineMeters(prev.latitude, prev.longitude, fix.latitude, fix.longitude)
        val speed = fix.speed?.toDouble() ?: (segment / (dtMillis / 1000.0))
        val moving = speed >= stationaryThresholdMs

        val distance = stats.distanceMeters + if (moving) segment else 0.0
        val movingMillis = stats.movingMillis + if (moving) dtMillis else 0
        stats = SpeedStats(
            currentMs = if (moving) speed else 0.0,
            maxMs = max(stats.maxMs, speed),
            averageMs = if (movingMillis > 0) distance / (movingMillis / 1000.0) else 0.0,
            distanceMeters = distance,
            movingMillis = movingMillis,
            accuracyMeters = fix.accuracyMeters,
            fixCount = stats.fixCount + 1,
        )
        return stats
    }

    companion object {
        private const val EARTH_RADIUS_M = 6_371_008.8

        fun haversineMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
            val dLat = Math.toRadians(lat2 - lat1)
            val dLon = Math.toRadians(lon2 - lon1)
            val a = sin(dLat / 2) * sin(dLat / 2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2) * sin(dLon / 2)
            return 2 * EARTH_RADIUS_M * asin(sqrt(a))
        }
    }
}
