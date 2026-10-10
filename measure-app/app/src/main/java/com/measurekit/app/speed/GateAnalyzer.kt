package com.measurekit.app.speed

import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class GateUiState(
    val scoreA: Float = 0f,
    val scoreB: Float = 0f,
    val phase: String = "ready",
    val fps: Double = 0.0,
    /** Width ÷ height of the upright camera image. */
    val uprightAspect: Float = 3f / 4f,
    val readings: List<SpeedReading> = emptyList(),
)

/**
 * Samples the luma (Y) plane of each camera frame along the two gate lines and feeds the
 * [SpeedTrap]. The UI sets the configuration fields; they're read on the analysis thread.
 */
class GateAnalyzer : ImageAnalysis.Analyzer {
    @Volatile var gateA = 0.3f
    @Volatile var gateB = 0.7f
    @Volatile var axis = GateAxis.HORIZONTAL_MOTION
    @Volatile var threshold = 0.2f
    @Volatile var distanceMeters: Double? = null

    private val trap = SpeedTrap()
    @Volatile private var resetRequested = false
    private var configKey: Triple<Float, Float, GateAxis>? = null
    private var lastNanos = 0L
    private var avgFrameNanos = 0.0

    private val _state = MutableStateFlow(GateUiState())
    val state: StateFlow<GateUiState> = _state.asStateFlow()

    fun reset() {
        resetRequested = true
    }

    fun clearHistory() {
        _state.value = _state.value.copy(readings = emptyList())
    }

    override fun analyze(image: ImageProxy) {
        try {
            val key = Triple(gateA, gateB, axis)
            if (resetRequested || key != configKey) {
                // Moved lines see a different background, so start learning it again.
                trap.reset()
                configKey = key
                resetRequested = false
            }

            val rotation = image.imageInfo.rotationDegrees
            val nanos = image.imageInfo.timestamp
            val samplesA = sample(image, key.first, key.third, rotation)
            val samplesB = sample(image, key.second, key.third, rotation)
            val reading = trap.onFrame(nanos, samplesA, samplesB, distanceMeters ?: 0.0, threshold)

            if (lastNanos != 0L) {
                val dt = (nanos - lastNanos).toDouble()
                avgFrameNanos = if (avgFrameNanos == 0.0) dt else avgFrameNanos * 0.9 + dt * 0.1
            }
            lastNanos = nanos

            val upright = if (rotation % 180 == 0) image.width.toFloat() / image.height
            else image.height.toFloat() / image.width
            val prev = _state.value
            _state.value = GateUiState(
                scoreA = trap.lastScoreA,
                scoreB = trap.lastScoreB,
                phase = trap.phase,
                fps = if (avgFrameNanos > 0) 1e9 / avgFrameNanos else 0.0,
                uprightAspect = upright,
                readings = if (reading != null) (listOf(reading) + prev.readings).take(20) else prev.readings,
            )
        } finally {
            image.close()
        }
    }

    private fun sample(image: ImageProxy, position: Float, axis: GateAxis, rotation: Int): FloatArray {
        val plane = image.planes[0]
        val buffer = plane.buffer
        val rowStride = plane.rowStride
        val pixelStride = plane.pixelStride
        val w = image.width
        val h = image.height
        val points = GateGeometry.gateSamplePoints(position, axis)
        return FloatArray(points.size) { i ->
            val (u, v) = points[i]
            val (bx, by) = GateGeometry.uprightToBuffer(u, v, rotation)
            val cx = (bx * (w - 1)).toInt().coerceIn(1, w - 2)
            val cy = (by * (h - 1)).toInt().coerceIn(1, h - 2)
            // 3×3 average to reduce sensor noise.
            var sum = 0
            for (dy in -1..1) for (dx in -1..1) {
                sum += buffer.get((cy + dy) * rowStride + (cx + dx) * pixelStride).toInt() and 0xFF
            }
            sum / 9f
        }
    }
}
