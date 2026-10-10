package com.measurekit.app.ar

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.opengl.GLSurfaceView
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LargeFloatingActionButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.foundation.Canvas
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Session
import com.google.ar.core.exceptions.UnavailableApkTooOldException
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException
import com.google.ar.core.exceptions.UnavailableException
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException
import com.measurekit.app.ui.PermissionGate
import com.measurekit.app.units.UnitSystem
import com.measurekit.app.units.Units

@Composable
fun ArMeasureScreen(mode: ArMode, units: UnitSystem, modifier: Modifier = Modifier) {
    PermissionGate(
        permissions = listOf(Manifest.permission.CAMERA),
        rationale = "AR measuring uses the camera to find surfaces and track distances.",
        modifier = modifier,
    ) {
        ArSessionView(mode, units, modifier)
    }
}

@Composable
private fun ArSessionView(mode: ArMode, units: UnitSystem, modifier: Modifier) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val lifecycleOwner = LocalLifecycleOwner.current
    val maxPoints = if (mode == ArMode.BOX) MeasureGeometry.BOX_POINTS else 50
    val controller = remember(mode) { ArMeasureController(maxPoints) }
    val glView = remember(mode) {
        GLSurfaceView(context).apply {
            preserveEGLContextOnPause = true
            setEGLContextClientVersion(2)
            setEGLConfigChooser(8, 8, 8, 8, 16, 0)
            setRenderer(controller)
            renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
            setWillNotDraw(false)
        }
    }

    DisposableEffect(lifecycleOwner, controller) {
        var installRequested = false
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> {
                    if (controller.session == null) {
                        val session = createSession(activity, !installRequested, controller::reportError)
                        if (session == null) {
                            installRequested = true
                            return@LifecycleEventObserver
                        }
                        controller.attach(session)
                    }
                    controller.displayRotation = displayRotation(context)
                    try {
                        controller.session?.resume()
                        glView.onResume()
                    } catch (e: Exception) {
                        controller.reportError("Could not start the camera: ${e.message}")
                    }
                }
                Lifecycle.Event.ON_PAUSE -> {
                    glView.onPause()
                    controller.session?.pause()
                }
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            glView.onPause()
            controller.close()
        }
    }

    val state by controller.state.collectAsStateWithLifecycle()

    Box(modifier) {
        AndroidView(factory = { glView }, modifier = Modifier.fillMaxSize())
        MeasureOverlay(state, mode, units, Modifier.fillMaxSize())

        val message = state.error ?: state.hint
        if (message != null) {
            Text(
                message,
                color = Color.White,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 16.dp, start = 16.dp, end = 16.dp)
                    .background(Color(0x99000000), RoundedCornerShape(12.dp))
                    .padding(horizontal = 14.dp, vertical = 8.dp),
            )
        }

        ResultPanel(
            state = state,
            mode = mode,
            units = units,
            onAdd = controller::add,
            onUndo = controller::undo,
            onClear = controller::clear,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}

@Composable
private fun MeasureOverlay(state: ArFrameState, mode: ArMode, units: UnitSystem, modifier: Modifier) {
    val textMeasurer = rememberTextMeasurer()
    val accent = Color(0xFFFFD54F)
    val labelStyle = TextStyle(color = Color.Black, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)

    Canvas(modifier) {
        fun label(text: String, at: Offset) {
            val layout = textMeasurer.measure(text, labelStyle)
            val topLeft = Offset(at.x - layout.size.width / 2f, at.y - layout.size.height / 2f)
            drawRoundRect(
                color = Color.White,
                topLeft = topLeft - Offset(8f, 4f),
                size = androidx.compose.ui.geometry.Size(layout.size.width + 16f, layout.size.height + 8f),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(12f, 12f),
            )
            drawText(layout, topLeft = topLeft)
        }

        val pts = state.screenPoints
        val connections: List<Pair<Int, Int>> = when (mode) {
            ArMode.LENGTH -> (0 until pts.size - 1).map { it to it + 1 }
            ArMode.BOX -> listOf(0 to 1, 1 to 2, 2 to 3).filter { it.second < pts.size }
        }
        for ((i, j) in connections) {
            val a = pts[i] ?: continue
            val b = pts[j] ?: continue
            val start = Offset(a.x, a.y)
            val end = Offset(b.x, b.y)
            drawLine(accent, start, end, strokeWidth = 6f)
            val meters = if (mode == ArMode.BOX && j == 3) {
                MeasureGeometry.heightAbove(state.points.take(3), state.points[3])
            } else {
                state.points[i].distanceTo(state.points[j])
            }
            label(Units.length(meters, units), (start + end) / 2f)
        }
        for (p in pts) {
            if (p != null) drawCircle(accent, radius = 12f, center = Offset(p.x, p.y))
        }

        // Rubber band from the last point to the crosshair, with a live reading.
        val center = Offset(size.width / 2f, size.height / 2f)
        val last = pts.lastOrNull()
        val reticle = state.reticle
        val canAdd = mode == ArMode.LENGTH || pts.size < MeasureGeometry.BOX_POINTS
        if (last != null && reticle != null && canAdd) {
            drawLine(
                Color.White, Offset(last.x, last.y), center, strokeWidth = 4f,
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(20f, 14f)),
            )
            val live = if (mode == ArMode.BOX && pts.size == 3) {
                MeasureGeometry.heightAbove(state.points, reticle)
            } else {
                state.points.last().distanceTo(reticle)
            }
            label(Units.length(live, units), center + Offset(0f, -70f))
        }

        val reticleColor = if (reticle != null) Color(0xFF66BB6A) else Color.White
        drawCircle(reticleColor, radius = 28f, center = center, style = androidx.compose.ui.graphics.drawscope.Stroke(4f))
        drawCircle(reticleColor, radius = 5f, center = center)
    }
}

@Composable
private fun ResultPanel(
    state: ArFrameState,
    mode: ArMode,
    units: UnitSystem,
    onAdd: () -> Unit,
    onUndo: () -> Unit,
    onClear: () -> Unit,
    modifier: Modifier,
) {
    val n = state.points.size
    val (headline, detail) = when (mode) {
        ArMode.LENGTH -> {
            val segs = MeasureGeometry.segments(state.points)
            when {
                n == 0 -> "Tap + to place the first point" to "Aim the crosshair at where you want to start"
                n == 1 -> "Move to the end point and tap +" to "Keep adding points to measure a path"
                else -> "Total ${Units.length(MeasureGeometry.pathLength(state.points), units)}" to
                    (if (segs.size > 1) "${segs.size} segments" else "Tap + to continue the path")
            }
        }
        ArMode.BOX -> {
            val box = MeasureGeometry.box(state.points)
            val step = when (n) {
                0 -> "Place corner 1 on the base"
                1 -> "Place corner 2 (width)"
                2 -> "Place corner 3 (depth)"
                3 -> "Aim at the top surface and tap + (height)"
                else -> null
            }
            val dims = box?.let { b ->
                listOfNotNull(
                    "W ${Units.length(b.width, units)}",
                    b.depth?.let { "D ${Units.length(it, units)}" },
                    b.height?.let { "H ${Units.length(it, units)}" },
                ).joinToString("  ×  ")
            }
            val volume = box?.volume?.let { "Volume ${Units.solidVolume(it, units)}" }
            (volume ?: step ?: "") to (if (volume != null) dims.orEmpty() else dims ?: "Measure a box: 3 base corners and then the top")
        }
    }
    val canAdd = state.reticle != null && (mode == ArMode.LENGTH || n < MeasureGeometry.BOX_POINTS)

    Column(
        modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.92f), RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(headline, style = MaterialTheme.typography.titleLarge)
        Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(
            Modifier
                .fillMaxWidth()
                .padding(top = 12.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onUndo, enabled = n > 0) {
                Icon(Icons.AutoMirrored.Filled.Undo, contentDescription = "Undo last point")
            }
            LargeFloatingActionButton(
                onClick = { if (canAdd) onAdd() },
                containerColor = if (canAdd) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
            ) {
                Icon(Icons.Filled.Add, contentDescription = "Add point")
            }
            FilledIconButton(onClick = onClear, enabled = n > 0) {
                Icon(Icons.Filled.Delete, contentDescription = "Clear all points")
            }
        }
    }
}

/**
 * Creates an ARCore session, prompting to install or update Google Play Services for AR if needed.
 * Returns null while an install is in progress; the activity resumes once it finishes.
 */
private fun createSession(activity: Activity, userRequestedInstall: Boolean, onError: (String) -> Unit): Session? {
    return try {
        when (ArCoreApk.getInstance().requestInstall(activity, userRequestedInstall)) {
            ArCoreApk.InstallStatus.INSTALL_REQUESTED -> null
            else -> Session(activity)
        }
    } catch (e: UnavailableDeviceNotCompatibleException) {
        onError("This phone doesn't support ARCore, so AR measuring is unavailable. The Liquid and Speed tools still work.")
        null
    } catch (e: UnavailableUserDeclinedInstallationException) {
        onError("AR measuring needs Google Play Services for AR to be installed.")
        null
    } catch (e: UnavailableApkTooOldException) {
        onError("Update Google Play Services for AR to use AR measuring.")
        null
    } catch (e: UnavailableException) {
        onError("AR is unavailable: ${e.message}")
        null
    } catch (e: Exception) {
        onError("Could not start AR: ${e.message}")
        null
    }
}

@Suppress("DEPRECATION")
private fun displayRotation(context: Context): Int =
    (context.getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay.rotation

private fun Context.findActivity(): Activity {
    var c = this
    while (c is ContextWrapper) {
        if (c is Activity) return c
        c = c.baseContext
    }
    error("ArMeasureScreen must be hosted in an Activity")
}
