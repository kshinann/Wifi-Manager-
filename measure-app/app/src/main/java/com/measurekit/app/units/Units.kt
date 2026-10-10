package com.measurekit.app.units

import java.util.Locale

enum class UnitSystem { METRIC, IMPERIAL }

/** Formatting helpers. All inputs are SI base units (metres, cubic metres, metres/second). */
object Units {
    const val METERS_PER_INCH = 0.0254
    const val METERS_PER_FOOT = 0.3048
    const val LITERS_PER_US_GALLON = 3.785411784
    const val ML_PER_US_FL_OZ = 29.5735295625
    const val KMH_PER_MS = 3.6
    const val MPH_PER_MS = 2.2369362920544

    fun length(meters: Double, system: UnitSystem): String = when (system) {
        UnitSystem.METRIC ->
            if (meters < 1.0) fmt(meters * 100, 1, "cm") else fmt(meters, 2, "m")
        UnitSystem.IMPERIAL -> {
            val inches = meters / METERS_PER_INCH
            if (inches < 36.0) fmt(inches, 1, "in") else fmt(meters / METERS_PER_FOOT, 2, "ft")
        }
    }

    /** Volume of a solid (e.g. a measured box). */
    fun solidVolume(cubicMeters: Double, system: UnitSystem): String = when (system) {
        UnitSystem.METRIC ->
            if (cubicMeters < 0.001) fmt(cubicMeters * 1e6, 0, "cm³") else fmt(cubicMeters * 1000, 2, "L")
        UnitSystem.IMPERIAL -> {
            val cubicFeet = cubicMeters / (METERS_PER_FOOT * METERS_PER_FOOT * METERS_PER_FOOT)
            if (cubicFeet < 1.0) fmt(cubicMeters / (METERS_PER_INCH * METERS_PER_INCH * METERS_PER_INCH), 0, "in³")
            else fmt(cubicFeet, 2, "ft³")
        }
    }

    /** Volume of a liquid. */
    fun liquidVolume(cubicMeters: Double, system: UnitSystem): String {
        val liters = cubicMeters * 1000
        return when (system) {
            UnitSystem.METRIC -> if (liters < 1.0) fmt(liters * 1000, 0, "mL") else fmt(liters, 2, "L")
            UnitSystem.IMPERIAL -> {
                val gallons = liters / LITERS_PER_US_GALLON
                if (gallons < 1.0) fmt(liters * 1000 / ML_PER_US_FL_OZ, 1, "fl oz") else fmt(gallons, 2, "gal")
            }
        }
    }

    fun speedValue(metersPerSecond: Double, system: UnitSystem): Double = when (system) {
        UnitSystem.METRIC -> metersPerSecond * KMH_PER_MS
        UnitSystem.IMPERIAL -> metersPerSecond * MPH_PER_MS
    }

    fun speedUnit(system: UnitSystem): String = if (system == UnitSystem.METRIC) "km/h" else "mph"

    fun distance(meters: Double, system: UnitSystem): String = when (system) {
        UnitSystem.METRIC -> if (meters < 1000) fmt(meters, 0, "m") else fmt(meters / 1000, 2, "km")
        UnitSystem.IMPERIAL -> {
            val miles = meters / 1609.344
            if (miles < 0.1) fmt(meters / METERS_PER_FOOT, 0, "ft") else fmt(miles, 2, "mi")
        }
    }

    /** Unit that the liquid calculator's dimension inputs are typed in. */
    fun inputLengthUnit(system: UnitSystem): String = if (system == UnitSystem.METRIC) "cm" else "in"

    fun inputToMeters(value: Double, system: UnitSystem): Double =
        if (system == UnitSystem.METRIC) value / 100 else value * METERS_PER_INCH

    private fun fmt(value: Double, decimals: Int, unit: String): String =
        String.format(Locale.US, "%.${decimals}f %s", value, unit)
}
