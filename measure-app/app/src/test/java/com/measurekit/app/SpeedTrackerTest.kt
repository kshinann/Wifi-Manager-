package com.measurekit.app

import com.measurekit.app.speed.Fix
import com.measurekit.app.speed.SpeedTracker
import org.junit.Assert.assertEquals
import org.junit.Test

class SpeedTrackerTest {
    // ~0.0001° of latitude ≈ 11.1 m
    private fun fix(t: Long, lat: Double, speed: Float? = null, acc: Float = 5f) = Fix(t, lat, 0.0, speed, acc)

    @Test fun haversineOneDegreeLatitude() {
        assertEquals(111_195.0, SpeedTracker.haversineMeters(0.0, 0.0, 1.0, 0.0), 100.0)
    }

    @Test fun computesSpeedFromPositionsWhenNotReported() {
        val t = SpeedTracker()
        t.onFix(fix(0, 0.0))
        val s = t.onFix(fix(1000, 0.0001))
        assertEquals(11.12, s.currentMs, 0.05)
        assertEquals(11.12, s.distanceMeters, 0.05)
        assertEquals(11.12, s.averageMs, 0.05)
    }

    @Test fun stationaryJitterAddsNoDistance() {
        val t = SpeedTracker()
        t.onFix(fix(0, 0.0, speed = 0f))
        val s = t.onFix(fix(1000, 0.00002, speed = 0.1f))
        assertEquals(0.0, s.distanceMeters, 1e-9)
        assertEquals(0.0, s.currentMs, 1e-9)
    }

    @Test fun inaccurateFixesAreIgnored() {
        val t = SpeedTracker()
        t.onFix(fix(0, 0.0))
        val s = t.onFix(fix(1000, 0.01, acc = 200f))
        assertEquals(0.0, s.distanceMeters, 1e-9)
        assertEquals(200f, s.accuracyMeters!!, 0f)
    }

    @Test fun breakSegmentSkipsTheGap() {
        val t = SpeedTracker()
        t.onFix(fix(0, 0.0))
        t.onFix(fix(1000, 0.0001))
        t.breakSegment()
        t.onFix(fix(60_000, 0.01)) // 1 km away after a pause
        val s = t.onFix(fix(61_000, 0.0101))
        assertEquals(22.24, s.distanceMeters, 0.1)
    }
}
