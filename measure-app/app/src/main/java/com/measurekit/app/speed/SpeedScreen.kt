package com.measurekit.app.speed

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.measurekit.app.ui.PermissionGate
import com.measurekit.app.units.UnitSystem
import com.measurekit.app.units.Units
import java.util.Locale

@Composable
fun SpeedScreen(units: UnitSystem, modifier: Modifier = Modifier) {
    PermissionGate(
        permissions = listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
        rationale = "The speedometer uses GPS to measure your speed and distance. Grant precise location.",
        modifier = modifier,
    ) {
        Speedometer(units, modifier)
    }
}

@SuppressLint("MissingPermission") // Guarded by PermissionGate.
@Composable
private fun Speedometer(units: UnitSystem, modifier: Modifier) {
    val context = LocalContext.current
    val tracker = remember { SpeedTracker() }
    var stats by remember { mutableStateOf(SpeedStats()) }
    var running by remember { mutableStateOf(true) }
    var gpsEnabled by remember { mutableStateOf(true) }

    DisposableEffect(running) {
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        // All four methods are implemented explicitly: older Android versions
        // have no default implementations and would crash.
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                stats = tracker.onFix(
                    Fix(
                        timeMillis = location.time,
                        latitude = location.latitude,
                        longitude = location.longitude,
                        speed = if (location.hasSpeed()) location.speed else null,
                        accuracyMeters = if (location.hasAccuracy()) location.accuracy else Float.MAX_VALUE,
                    ),
                )
            }
            @Deprecated("Deprecated in Java")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
            override fun onProviderEnabled(provider: String) { gpsEnabled = true }
            override fun onProviderDisabled(provider: String) { gpsEnabled = false }
        }
        gpsEnabled = lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
        if (running) {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 500L, 0f, listener, Looper.getMainLooper())
        }
        onDispose { lm.removeUpdates(listener) }
    }

    val speedUnit = Units.speedUnit(units)
    val current = Units.speedValue(stats.currentMs, units)
    val gaugeMax = if (units == UnitSystem.METRIC) 200.0 else 120.0

    Column(
        modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (!gpsEnabled) {
            Text("GPS is off. Turn on Location to measure speed.", color = MaterialTheme.colorScheme.error)
        } else if (stats.fixCount == 0) {
            Text("Waiting for GPS signal… Works best outdoors.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        Box(Modifier.fillMaxWidth(0.85f).aspectRatio(1f), contentAlignment = Alignment.Center) {
            val track = MaterialTheme.colorScheme.surfaceVariant
            val needle = MaterialTheme.colorScheme.primary
            Canvas(Modifier.fillMaxSize()) {
                val stroke = 28f
                val inset = stroke / 2
                val arcSize = Size(size.width - stroke, size.height - stroke)
                drawArc(track, 135f, 270f, false, Offset(inset, inset), arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
                val sweep = (current / gaugeMax).coerceIn(0.0, 1.0).toFloat() * 270f
                drawArc(needle, 135f, sweep, false, Offset(inset, inset), arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(String.format(Locale.US, "%.0f", current), style = MaterialTheme.typography.displayLarge)
                Text(speedUnit, style = MaterialTheme.typography.titleMedium)
            }
        }

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                StatRow("Max", String.format(Locale.US, "%.1f %s", Units.speedValue(stats.maxMs, units), speedUnit))
                StatRow("Average (moving)", String.format(Locale.US, "%.1f %s", Units.speedValue(stats.averageMs, units), speedUnit))
                StatRow("Distance", Units.distance(stats.distanceMeters, units))
                StatRow("Moving time", formatDuration(stats.movingMillis))
                StatRow("GPS accuracy", stats.accuracyMeters?.let { "± ${Units.length(it.toDouble(), units)}" } ?: "—")
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(onClick = {
                if (running) {
                    tracker.breakSegment()
                    stats = tracker.stats
                }
                running = !running
            }) { Text(if (running) "Pause" else "Resume") }
            OutlinedButton(onClick = {
                tracker.reset()
                stats = tracker.stats
            }) { Text("Reset") }
        }
    }
}

@Composable
private fun StatRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.titleMedium)
    }
}

private fun formatDuration(millis: Long): String {
    val s = millis / 1000
    return String.format(Locale.US, "%d:%02d:%02d", s / 3600, (s / 60) % 60, s % 60)
}
