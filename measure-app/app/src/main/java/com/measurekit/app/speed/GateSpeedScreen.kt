package com.measurekit.app.speed

import android.Manifest
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.measurekit.app.ui.DistanceField
import com.measurekit.app.ui.PermissionGate
import com.measurekit.app.units.UnitSystem
import com.measurekit.app.units.Units
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.abs

@Composable
fun GateSpeedScreen(units: UnitSystem, modifier: Modifier = Modifier) {
    PermissionGate(
        permissions = listOf(Manifest.permission.CAMERA),
        rationale = "The speed trap watches two lines in the camera view and times objects crossing them.",
        modifier = modifier,
    ) {
        GateSpeedContent(units, modifier)
    }
}

@Composable
private fun GateSpeedContent(units: UnitSystem, modifier: Modifier) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val analyzer = remember { GateAnalyzer() }
    val previewView = remember {
        PreviewView(context).apply { scaleType = PreviewView.ScaleType.FIT_CENTER }
    }

    var gateA by remember { mutableFloatStateOf(0.3f) }
    var gateB by remember { mutableFloatStateOf(0.7f) }
    var axis by remember { mutableStateOf(GateAxis.HORIZONTAL_MOTION) }
    var sensitivity by remember { mutableFloatStateOf(0.6f) }
    var distance by remember { mutableStateOf<Double?>(null) }

    SideEffect {
        analyzer.gateA = gateA
        analyzer.gateB = gateB
        analyzer.axis = axis
        // Higher sensitivity → less of the line has to change to count as a crossing.
        analyzer.threshold = 0.5f - 0.45f * sensitivity
        analyzer.distanceMeters = distance
    }

    DisposableEffect(lifecycleOwner) {
        val executor = Executors.newSingleThreadExecutor()
        val future = ProcessCameraProvider.getInstance(context)
        var provider: ProcessCameraProvider? = null
        var disposed = false
        future.addListener({
            if (disposed) return@addListener
            val p = future.get().also { provider = it }
            // Same aspect ratio for preview and analysis, so the gate lines line up with the picture.
            val selector = ResolutionSelector.Builder()
                .setAspectRatioStrategy(AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY)
                .build()
            val preview = Preview.Builder().setResolutionSelector(selector).build()
                .also { it.setSurfaceProvider(previewView.surfaceProvider) }
            val analysis = ImageAnalysis.Builder()
                .setResolutionSelector(selector)
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also { it.setAnalyzer(executor, analyzer) }
            p.unbindAll()
            p.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
        }, ContextCompat.getMainExecutor(context))
        onDispose {
            disposed = true
            provider?.unbindAll()
            executor.shutdown()
        }
    }

    val state by analyzer.state.collectAsStateWithLifecycle()
    val textMeasurer = rememberTextMeasurer()

    Column(modifier) {
        Box(
            Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentAlignment = Alignment.Center,
        ) {
            Box(Modifier.aspectRatio(state.uprightAspect, matchHeightConstraintsFirst = true)) {
                AndroidView(factory = { previewView }, modifier = Modifier.fillMaxSize())
                Canvas(
                    Modifier
                        .fillMaxSize()
                        .pointerInput(axis) {
                            var dragging = 0 // 1 = A, 2 = B
                            detectDragGestures(
                                onDragStart = { start ->
                                    val pos = if (axis == GateAxis.HORIZONTAL_MOTION) start.x / size.width else start.y / size.height
                                    dragging = if (abs(pos - gateA) <= abs(pos - gateB)) 1 else 2
                                },
                                onDrag = { change, amount ->
                                    change.consume()
                                    val delta = if (axis == GateAxis.HORIZONTAL_MOTION) amount.x / size.width else amount.y / size.height
                                    if (dragging == 1) gateA = (gateA + delta).coerceIn(0.02f, 0.98f)
                                    else gateB = (gateB + delta).coerceIn(0.02f, 0.98f)
                                },
                            )
                        },
                ) {
                    fun gate(position: Float, score: Float, name: String) {
                        val hot = score >= analyzer.threshold
                        val color = if (hot) Color(0xFFFF5252) else Color(0xFFFFD54F)
                        val (start, end) = if (axis == GateAxis.HORIZONTAL_MOTION) {
                            Offset(position * size.width, 0f) to Offset(position * size.width, size.height)
                        } else {
                            Offset(0f, position * size.height) to Offset(size.width, position * size.height)
                        }
                        drawLine(color, start, end, strokeWidth = if (hot) 10f else 6f)
                        drawText(
                            textMeasurer, name,
                            topLeft = start + Offset(12f, 12f),
                            style = TextStyle(color = color, fontSize = 20.sp, fontWeight = FontWeight.Bold),
                        )
                    }
                    gate(gateA, state.scoreA, "A")
                    gate(gateB, state.scoreB, "B")
                }
            }
        }

        Column(
            Modifier
                .fillMaxWidth()
                .heightIn(max = 340.dp)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val latest = state.readings.firstOrNull()
            Text(
                when {
                    distance == null -> "Enter the real distance between lines A and B"
                    latest != null -> Units.speed(latest.speedMs, units)
                    state.phase == "timing" -> "Timing…"
                    state.phase == "cooldown" -> "Waiting for the lines to clear…"
                    else -> "Ready. Waiting for an object"
                },
                style = if (latest != null && distance != null) MaterialTheme.typography.displaySmall else MaterialTheme.typography.titleMedium,
            )
            Text(
                "Hold the phone still (ideally on a tripod) and drag A and B onto two marks the object passes, " +
                    "for example road markings. Enter the real distance between those marks.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            DistanceField(label = "Distance A–B", units = units, onMeters = { distance = it })
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = axis == GateAxis.HORIZONTAL_MOTION,
                    onClick = { axis = GateAxis.HORIZONTAL_MOTION },
                    label = { Text("Moves across ↔") },
                )
                FilterChip(
                    selected = axis == GateAxis.VERTICAL_MOTION,
                    onClick = { axis = GateAxis.VERTICAL_MOTION },
                    label = { Text("Moves up/down ↕") },
                )
            }
            Text("Sensitivity", style = MaterialTheme.typography.labelLarge)
            Slider(value = sensitivity, onValueChange = { sensitivity = it })
            Text(
                String.format(Locale.US, "Camera %.0f fps · line activity A %.0f%% · B %.0f%%", state.fps, state.scoreA * 100, state.scoreB * 100),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = analyzer::reset) { Text("Re-arm") }
                OutlinedButton(onClick = analyzer::clearHistory, enabled = state.readings.isNotEmpty()) { Text("Clear history") }
            }
            state.readings.forEachIndexed { i, r ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("#${state.readings.size - i}  ${if (r.direction == Direction.A_TO_B) "A → B" else "B → A"}")
                    Text(String.format(Locale.US, "%s  (%.2f s)", Units.speed(r.speedMs, units), r.seconds))
                }
            }
        }
    }
}
