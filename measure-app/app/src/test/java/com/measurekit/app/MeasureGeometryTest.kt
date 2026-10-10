package com.measurekit.app

import com.measurekit.app.ar.MeasureGeometry
import com.measurekit.app.ar.Vec3
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MeasureGeometryTest {
    @Test fun pathLengthSumsSegments() {
        val pts = listOf(Vec3(0f, 0f, 0f), Vec3(3f, 0f, 0f), Vec3(3f, 4f, 0f))
        assertEquals(7.0, MeasureGeometry.pathLength(pts), 1e-6)
    }

    @Test fun boxDimensionsAndVolume() {
        val pts = listOf(
            Vec3(0f, 0f, 0f), Vec3(0.4f, 0f, 0f), Vec3(0.4f, 0f, 0.3f),
            Vec3(0.2f, 0.25f, 0.1f), // anywhere on the top surface
        )
        val box = MeasureGeometry.box(pts)!!
        assertEquals(0.4, box.width, 1e-6)
        assertEquals(0.3, box.depth!!, 1e-6)
        assertEquals(0.25, box.height!!, 1e-6)
        assertEquals(0.03, box.volume!!, 1e-6)
    }

    @Test fun boxNeedsTwoPoints() {
        assertNull(MeasureGeometry.box(listOf(Vec3(0f, 0f, 0f))))
        assertNull(MeasureGeometry.box(listOf(Vec3(0f, 0f, 0f), Vec3(1f, 0f, 0f)))!!.volume)
    }
}
