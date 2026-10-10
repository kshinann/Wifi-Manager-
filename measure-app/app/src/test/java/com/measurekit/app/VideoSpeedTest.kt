package com.measurekit.app

import com.measurekit.app.speed.PixelPoint
import com.measurekit.app.speed.VideoSpeed
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class VideoSpeedTest {
    @Test fun scalesPixelsAndSlowMotion() {
        // 100 px with 50 px = 1 m → 2 m, in 0.8 s of 8× slow-motion file time = 0.1 s real → 20 m/s.
        val v = VideoSpeed.speedMs(
            PixelPoint(0f, 0f), 0.0, PixelPoint(100f, 0f), 0.8,
            PixelPoint(10f, 10f), PixelPoint(10f, 60f), 1.0, slowMotionFactor = 8.0,
        )
        assertEquals(20.0, v!!, 1e-9)
    }

    @Test fun invalidInputsGiveNoResult() {
        assertNull(VideoSpeed.speedMs(PixelPoint(0f, 0f), 1.0, PixelPoint(5f, 0f), 1.0, PixelPoint(0f, 0f), PixelPoint(1f, 0f), 1.0, 1.0))
        assertNull(VideoSpeed.speedMs(PixelPoint(0f, 0f), 0.0, PixelPoint(5f, 0f), 1.0, PixelPoint(0f, 0f), PixelPoint(0f, 0f), 1.0, 1.0))
    }

    @Test fun slowMotionFactorFromMetadata() {
        assertEquals(8.0, VideoSpeed.slowMotionFactor(captureFps = 240.0, playbackFps = 30.0), 1e-9)
        assertEquals(1.0, VideoSpeed.slowMotionFactor(captureFps = 240.0, playbackFps = 240.0), 1e-9)
        assertEquals(1.0, VideoSpeed.slowMotionFactor(captureFps = null, playbackFps = 30.0), 1e-9)
    }
}
