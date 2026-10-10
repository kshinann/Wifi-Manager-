package com.measurekit.app

import com.measurekit.app.liquid.Container
import com.measurekit.app.liquid.fillFraction
import org.junit.Assert.assertEquals
import org.junit.Test
import kotlin.math.PI

class LiquidVolumeTest {
    private val eps = 1e-9

    @Test fun cylinderHalfFull() {
        val c = Container.Cylinder(diameter = 0.1, height = 0.2)
        assertEquals(PI * 0.05 * 0.05 * 0.2, c.capacity, eps)
        assertEquals(c.capacity / 2, c.liquidVolume(0.1), eps)
        assertEquals(0.5, c.fillFraction(0.1), eps)
    }

    @Test fun fillIsClampedToContainer() {
        val b = Container.Box(1.0, 1.0, 1.0)
        assertEquals(1.0, b.liquidVolume(5.0), eps)
        assertEquals(0.0, b.liquidVolume(-1.0), eps)
    }

    @Test fun frustumWithEqualDiametersIsACylinder() {
        val f = Container.Frustum(0.1, 0.1, 0.2)
        val c = Container.Cylinder(0.1, 0.2)
        assertEquals(c.liquidVolume(0.13), f.liquidVolume(0.13), eps)
    }

    @Test fun frustumFromPointIsACone() {
        val f = Container.Frustum(bottomDiameter = 0.0, topDiameter = 0.2, height = 0.3)
        assertEquals(PI * 0.1 * 0.1 * 0.3 / 3, f.capacity, eps)
    }

    @Test fun horizontalCylinderHalfAndFull() {
        val t = Container.HorizontalCylinder(diameter = 1.0, length = 2.0)
        assertEquals(t.capacity / 2, t.liquidVolume(0.5), 1e-9)
        assertEquals(t.capacity, t.liquidVolume(1.0), 1e-9)
        assertEquals(0.0, t.liquidVolume(0.0), 1e-9)
    }
}
