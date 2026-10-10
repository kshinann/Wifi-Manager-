package com.measurekit.app

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Hands measurements between tools, e.g. an AR length becomes the speed-trap distance. */
object MeasurementStore {
    private val _lastLengthMeters = MutableStateFlow<Double?>(null)
    val lastLengthMeters: StateFlow<Double?> = _lastLengthMeters.asStateFlow()

    fun setLastLength(meters: Double) {
        _lastLengthMeters.value = meters
    }
}
