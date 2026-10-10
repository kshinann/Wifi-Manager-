package com.measurekit.app

import com.measurekit.app.units.UnitSystem
import com.measurekit.app.units.Units
import org.junit.Assert.assertEquals
import org.junit.Test

class UnitsTest {
    @Test fun lengthFormatting() {
        assertEquals("45.0 cm", Units.length(0.45, UnitSystem.METRIC))
        assertEquals("1.50 m", Units.length(1.5, UnitSystem.METRIC))
        assertEquals("12.0 in", Units.length(0.3048, UnitSystem.IMPERIAL))
        assertEquals("10.00 ft", Units.length(3.048, UnitSystem.IMPERIAL))
    }

    @Test fun liquidFormatting() {
        assertEquals("500 mL", Units.liquidVolume(0.0005, UnitSystem.METRIC))
        assertEquals("2.00 L", Units.liquidVolume(0.002, UnitSystem.METRIC))
        assertEquals("2.00 gal", Units.liquidVolume(0.007570823568, UnitSystem.IMPERIAL))
    }

    @Test fun speedConversion() {
        assertEquals(36.0, Units.speedValue(10.0, UnitSystem.METRIC), 1e-9)
        assertEquals(22.369, Units.speedValue(10.0, UnitSystem.IMPERIAL), 1e-3)
    }
}
