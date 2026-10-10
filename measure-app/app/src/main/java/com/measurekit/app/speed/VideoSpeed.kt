package com.measurekit.app.speed

import kotlin.math.hypot

data class PixelPoint(val x: Float, val y: Float) {
    fun distanceTo(o: PixelPoint): Double = hypot((x - o.x).toDouble(), (y - o.y).toDouble())
}

object VideoSpeed {
    /**
     * Speed of an object marked at [p1] (file time [t1Seconds]) and [p2] ([t2Seconds]).
     * [refA]–[refB] is a reference of [refMeters] in the same plane as the motion and in the same
     * pixel space. [slowMotionFactor] turns file time into real time (8 for 240 fps played at 30 fps).
     */
    fun speedMs(
        p1: PixelPoint, t1Seconds: Double,
        p2: PixelPoint, t2Seconds: Double,
        refA: PixelPoint, refB: PixelPoint, refMeters: Double,
        slowMotionFactor: Double,
    ): Double? {
        val refPx = refA.distanceTo(refB)
        val realSeconds = kotlin.math.abs(t2Seconds - t1Seconds) / slowMotionFactor
        if (refPx <= 0 || refMeters <= 0 || realSeconds <= 0 || slowMotionFactor <= 0) return null
        val meters = p1.distanceTo(p2) / refPx * refMeters
        return meters / realSeconds
    }

    /**
     * Slow-motion factor from file metadata: the capture frame rate (if the camera app recorded one)
     * divided by the playback frame rate. Returns 1 when unknown or not slow motion.
     */
    fun slowMotionFactor(captureFps: Double?, playbackFps: Double?): Double {
        if (captureFps == null || playbackFps == null || playbackFps <= 0) return 1.0
        val f = captureFps / playbackFps
        return if (f > 1.05) f else 1.0
    }
}
