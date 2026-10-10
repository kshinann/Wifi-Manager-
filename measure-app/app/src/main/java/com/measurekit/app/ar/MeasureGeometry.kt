package com.measurekit.app.ar

import kotlin.math.abs
import kotlin.math.sqrt

/** A point in ARCore world space, in metres. ARCore's Y axis points up (against gravity). */
data class Vec3(val x: Float, val y: Float, val z: Float) {
    fun distanceTo(o: Vec3): Double {
        val dx = (x - o.x).toDouble()
        val dy = (y - o.y).toDouble()
        val dz = (z - o.z).toDouble()
        return sqrt(dx * dx + dy * dy + dz * dz)
    }
}

enum class ArMode { LENGTH, BOX }

/**
 * Box measured from points: 1→2 is the width and 2→3 the depth along the base;
 * the 4th point sits on the top surface and gives the height above the base.
 */
data class BoxDims(val width: Double, val depth: Double?, val height: Double?) {
    val volume: Double? get() = if (depth != null && height != null) width * depth * height else null
}

object MeasureGeometry {
    const val BOX_POINTS = 4

    fun pathLength(points: List<Vec3>): Double =
        points.zipWithNext { a, b -> a.distanceTo(b) }.sum()

    fun segments(points: List<Vec3>): List<Double> =
        points.zipWithNext { a, b -> a.distanceTo(b) }

    fun heightAbove(base: List<Vec3>, top: Vec3): Double =
        abs(top.y - base.map { it.y }.average())

    /** Returns null until at least two base corners are placed. */
    fun box(points: List<Vec3>): BoxDims? {
        if (points.size < 2) return null
        val width = points[0].distanceTo(points[1])
        val depth = if (points.size >= 3) points[1].distanceTo(points[2]) else null
        val height = if (points.size >= 4) heightAbove(points.take(3), points[3]) else null
        return BoxDims(width, depth, height)
    }
}
