package com.measurekit.app.speed

import kotlin.math.abs

/** Which way the object moves through the view, which decides how the gate lines are oriented. */
enum class GateAxis {
    /** Object moves left/right; the gates are vertical lines at horizontal positions. */
    HORIZONTAL_MOTION,

    /** Object moves up/down; the gates are horizontal lines at vertical positions. */
    VERTICAL_MOTION,
}

object GateGeometry {
    /**
     * Converts a point in the upright (as displayed) image, normalised to 0..1, into normalised
     * coordinates of the camera buffer. [rotationDegrees] is how far the buffer must turn
     * clockwise to look upright (CameraX `ImageInfo.rotationDegrees`).
     */
    fun uprightToBuffer(u: Float, v: Float, rotationDegrees: Int): Pair<Float, Float> =
        when (((rotationDegrees % 360) + 360) % 360) {
            90 -> v to 1f - u
            180 -> 1f - u to 1f - v
            270 -> 1f - v to u
            else -> u to v
        }

    /** Points along a gate line at [position] (0..1 across the motion axis), in upright coordinates. */
    fun gateSamplePoints(position: Float, axis: GateAxis, count: Int = 64): List<Pair<Float, Float>> =
        (0 until count).map { i ->
            val along = 0.03f + 0.94f * i / (count - 1)
            if (axis == GateAxis.HORIZONTAL_MOTION) position to along else along to position
        }
}

/**
 * Decides whether something is crossing one gate line. It compares the luma values sampled
 * along the line with a slowly updated background, after removing any overall brightness
 * change (auto exposure), and returns the fraction of samples that differ (0..1).
 */
class GateDetector(
    private val pixelDelta: Float = 25f,
    private val backgroundAlpha: Float = 0.05f,
) {
    private var background: FloatArray? = null

    fun reset() {
        background = null
    }

    fun score(samples: FloatArray, threshold: Float): Float {
        val bg = background
        if (bg == null || bg.size != samples.size) {
            background = samples.copyOf()
            return 0f
        }
        // The median difference is the overall brightness shift (auto exposure); an object
        // covering less than half the line doesn't move it.
        val offset = FloatArray(samples.size) { samples[it] - bg[it] }.sorted()[samples.size / 2]
        var changed = 0
        for (i in samples.indices) {
            if (abs(samples[i] - bg[i] - offset) > pixelDelta) changed++
        }
        val score = changed.toFloat() / samples.size
        // Learn slowly while occupied, so a car that parks on the line eventually fades into the background.
        val a = if (score < threshold) backgroundAlpha else backgroundAlpha * 0.1f
        for (i in bg.indices) bg[i] += (samples[i] - bg[i]) * a
        return score
    }
}

enum class Direction { A_TO_B, B_TO_A }

data class SpeedReading(val speedMs: Double, val direction: Direction, val seconds: Double, val timestampNanos: Long)

/**
 * Two-gate speed trap: speed = distance between the gates ÷ the time between the two crossings.
 * Each crossing time is interpolated between frames to beat the frame interval.
 */
class SpeedTrap(
    private val timeoutNanos: Long = 15_000_000_000L,
    private val rearmNanos: Long = 500_000_000L,
) {
    private sealed interface State {
        data object Armed : State
        data class FirstCrossed(val gateIsA: Boolean, val atNanos: Long) : State
        data class Cooldown(var clearSinceNanos: Long?) : State
    }

    private val gateA = GateDetector()
    private val gateB = GateDetector()
    private var state: State = State.Armed
    private var prevNanos: Long? = null
    private var prevScoreA = 0f
    private var prevScoreB = 0f

    var lastScoreA = 0f
        private set
    var lastScoreB = 0f
        private set

    /** "ready", "timing" or "cooldown", for the UI. */
    val phase: String
        get() = when (state) {
            State.Armed -> "ready"
            is State.FirstCrossed -> "timing"
            is State.Cooldown -> "cooldown"
        }

    fun reset() {
        gateA.reset()
        gateB.reset()
        state = State.Armed
        prevNanos = null
        prevScoreA = 0f
        prevScoreB = 0f
    }

    fun onFrame(nanos: Long, samplesA: FloatArray, samplesB: FloatArray, distanceMeters: Double, threshold: Float): SpeedReading? {
        val sA = gateA.score(samplesA, threshold)
        val sB = gateB.score(samplesB, threshold)
        lastScoreA = sA
        lastScoreB = sB
        val prevT = prevNanos
        prevNanos = nanos
        val crossA = prevT?.let { rising(prevT, nanos, prevScoreA, sA, threshold) }
        val crossB = prevT?.let { rising(prevT, nanos, prevScoreB, sB, threshold) }
        prevScoreA = sA
        prevScoreB = sB

        var reading: SpeedReading? = null
        when (val s = state) {
            State.Armed -> state = when {
                // Both lines tripped in one frame means a shadow, a flash or a camera bump: ignore it.
                crossA != null && crossB != null -> State.Cooldown(null)
                crossA != null -> State.FirstCrossed(true, crossA)
                crossB != null -> State.FirstCrossed(false, crossB)
                else -> State.Armed
            }
            is State.FirstCrossed -> {
                val second = if (s.gateIsA) crossB else crossA
                if (second != null && second > s.atNanos) {
                    val seconds = (second - s.atNanos) / 1e9
                    if (distanceMeters > 0) {
                        reading = SpeedReading(
                            speedMs = distanceMeters / seconds,
                            direction = if (s.gateIsA) Direction.A_TO_B else Direction.B_TO_A,
                            seconds = seconds,
                            timestampNanos = nanos,
                        )
                    }
                    state = State.Cooldown(null)
                } else if (nanos - s.atNanos > timeoutNanos) {
                    state = State.Armed
                }
            }
            is State.Cooldown -> {
                val clear = sA < threshold && sB < threshold
                if (!clear) {
                    s.clearSinceNanos = null
                } else {
                    val since = s.clearSinceNanos ?: nanos.also { s.clearSinceNanos = it }
                    if (nanos - since >= rearmNanos) state = State.Armed
                }
            }
        }
        return reading
    }

    /** Interpolated time at which the score crossed [threshold] upwards, or null if it didn't this frame. */
    private fun rising(t0: Long, t1: Long, s0: Float, s1: Float, threshold: Float): Long? {
        if (s0 >= threshold || s1 < threshold) return null
        val f = ((threshold - s0) / (s1 - s0)).coerceIn(0f, 1f)
        return t0 + ((t1 - t0) * f).toLong()
    }
}
