package com.measurekit.app

import com.measurekit.app.speed.Direction
import com.measurekit.app.speed.GateAxis
import com.measurekit.app.speed.GateDetector
import com.measurekit.app.speed.GateGeometry
import com.measurekit.app.speed.SpeedReading
import com.measurekit.app.speed.SpeedTrap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SpeedTrapTest {
    private val n = 64
    private val empty = FloatArray(n) { 100f }
    /** An object covering a quarter of the line. */
    private val occupied = FloatArray(n) { if (it < n / 4) 220f else 100f }
    private val frameNanos = 10_000_000L // 100 fps

    /** Runs frames 0..[frames] with each gate occupied during its frame range. Returns all readings. */
    private fun run(trap: SpeedTrap, frames: Int, a: IntRange, b: IntRange, distance: Double = 10.0): List<SpeedReading> =
        (0..frames).mapNotNull { f ->
            trap.onFrame(
                f * frameNanos,
                if (f in a) occupied else empty,
                if (f in b) occupied else empty,
                distance,
                threshold = 0.15f,
            )
        }

    @Test fun measuresSpeedBetweenGates() {
        // A at 1.00 s, B at 1.50 s, 10 m apart → 20 m/s.
        val readings = run(SpeedTrap(), 300, a = 100..120, b = 150..170)
        assertEquals(1, readings.size)
        assertEquals(20.0, readings[0].speedMs, 1e-6)
        assertEquals(Direction.A_TO_B, readings[0].direction)
    }

    @Test fun detectsReverseDirection() {
        val readings = run(SpeedTrap(), 300, a = 180..200, b = 100..120)
        assertEquals(Direction.B_TO_A, readings.single().direction)
        assertEquals(12.5, readings.single().speedMs, 1e-6)
    }

    @Test fun rearmsForTheNextObject() {
        val trap = SpeedTrap()
        val first = run(trap, 300, a = 100..120, b = 150..170)
        val second = (301..600).mapNotNull { f ->
            trap.onFrame(f * frameNanos, if (f in 400..420) occupied else empty, if (f in 425..445) occupied else empty, 10.0, 0.15f)
        }
        assertEquals(1, first.size)
        assertEquals(40.0, second.single().speedMs, 1e-6)
    }

    @Test fun bothGatesAtOnceIsIgnored() {
        assertEquals(0, run(SpeedTrap(), 300, a = 100..110, b = 100..110).size)
    }

    @Test fun firstCrossingTimesOut() {
        // B crosses 20 s after A: longer than the 15 s timeout, so no reading.
        assertEquals(0, run(SpeedTrap(), 2_500, a = 100..120, b = 2_100..2_120).size)
    }

    @Test fun globalBrightnessChangeIsNotAnObject() {
        val d = GateDetector()
        d.score(empty, 0.15f)
        val brighter = FloatArray(n) { 160f }
        assertEquals(0f, d.score(brighter, 0.15f), 0f)
        assertEquals(0.25f, GateDetector().also { it.score(empty, 0.15f) }.score(occupied, 0.15f), 1e-6f)
    }

    @Test fun uprightToBufferRotations() {
        // Upright top-left corner.
        assertEquals(0f to 0f, GateGeometry.uprightToBuffer(0f, 0f, 0))
        assertEquals(0f to 1f, GateGeometry.uprightToBuffer(0f, 0f, 90))
        assertEquals(1f to 1f, GateGeometry.uprightToBuffer(0f, 0f, 180))
        assertEquals(1f to 0f, GateGeometry.uprightToBuffer(0f, 0f, 270))
    }

    @Test fun gateLinesFollowTheAxis() {
        val vertical = GateGeometry.gateSamplePoints(0.3f, GateAxis.HORIZONTAL_MOTION, count = 5)
        assertTrue(vertical.all { it.first == 0.3f })
        val horizontal = GateGeometry.gateSamplePoints(0.6f, GateAxis.VERTICAL_MOTION, count = 5)
        assertTrue(horizontal.all { it.second == 0.6f })
    }
}
