package com.measurekit.app.liquid

import kotlin.math.PI
import kotlin.math.acos
import kotlin.math.sqrt

/** Container shapes the liquid calculator supports. All dimensions are in metres. */
sealed interface Container {
    /** Total capacity in cubic metres. */
    val capacity: Double

    /** Volume of liquid filled to [fillHeight] (clamped to the container) in cubic metres. */
    fun liquidVolume(fillHeight: Double): Double

    /** Upright cylinder: bottle, can, round tank. */
    data class Cylinder(val diameter: Double, val height: Double) : Container {
        private val r get() = diameter / 2
        override val capacity get() = PI * r * r * height
        override fun liquidVolume(fillHeight: Double) = PI * r * r * fillHeight.coerceIn(0.0, height)
    }

    /** Rectangular box: aquarium, cooler, square tank. */
    data class Box(val length: Double, val width: Double, val height: Double) : Container {
        override val capacity get() = length * width * height
        override fun liquidVolume(fillHeight: Double) = length * width * fillHeight.coerceIn(0.0, height)
    }

    /** Truncated cone (cup, bucket, glass): diameters at the bottom and the top rim. */
    data class Frustum(val bottomDiameter: Double, val topDiameter: Double, val height: Double) : Container {
        override val capacity get() = liquidVolume(height)
        override fun liquidVolume(fillHeight: Double): Double {
            if (height <= 0) return 0.0
            val h = fillHeight.coerceIn(0.0, height)
            val r1 = bottomDiameter / 2
            val rh = r1 + (topDiameter / 2 - r1) * (h / height)
            return PI * h / 3 * (r1 * r1 + r1 * rh + rh * rh)
        }
    }

    /** Cylinder lying on its side (fuel/water tank). Fill height is measured from the bottom. */
    data class HorizontalCylinder(val diameter: Double, val length: Double) : Container {
        private val r get() = diameter / 2
        override val capacity get() = PI * r * r * length
        override fun liquidVolume(fillHeight: Double): Double {
            if (r <= 0) return 0.0
            val h = fillHeight.coerceIn(0.0, diameter)
            val segment = r * r * acos((r - h) / r) - (r - h) * sqrt((2 * r * h - h * h).coerceAtLeast(0.0))
            return segment * length
        }
    }
}

fun Container.fillFraction(fillHeight: Double): Double =
    if (capacity <= 0) 0.0 else (liquidVolume(fillHeight) / capacity).coerceIn(0.0, 1.0)
