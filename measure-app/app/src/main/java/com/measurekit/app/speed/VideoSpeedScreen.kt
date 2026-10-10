package com.measurekit.app.speed

import android.content.Context
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.Stable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.measurekit.app.ui.DistanceField
import com.measurekit.app.units.UnitSystem
import com.measurekit.app.units.Units
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.withContext
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.roundToLong

/** An opened video. The retriever must only be used from [decoder]. */
private class VideoSource(context: Context, uri: Uri) : AutoCloseable {
    private val executor = Executors.newSingleThreadExecutor()
    val decoder = executor.asCoroutineDispatcher()
    private val retriever = MediaMetadataRetriever().apply { setDataSource(context, uri) }

    val durationUs: Long = (retriever.meta(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L) * 1000
    private val frameCount: Long? =
        if (Build.VERSION.SDK_INT >= 28) retriever.meta(MediaMetadataRetriever.METADATA_KEY_VIDEO_FRAME_COUNT)?.toLongOrNull() else null
    val playbackFps: Double? = frameCount?.takeIf { durationUs > 0 }?.let { it / (durationUs / 1e6) }
    val captureFps: Double? = retriever.meta(MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE)?.toDoubleOrNull()

    /** File time between frames; assumes 30 fps when the file doesn't say. */
    val frameStepUs: Long = (1e6 / (playbackFps ?: 30.0)).roundToLong().coerceAtLeast(1)

    /** Call on [decoder]. Frames are scaled down so every frame has the same, manageable size. */
    fun frameAt(timeUs: Long): Bitmap? =
        if (Build.VERSION.SDK_INT >= 27) {
            retriever.getScaledFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST, 1280, 1280)
        } else {
            retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
        }

    override fun close() {
        executor.execute { retriever.release() }
        executor.shutdown()
    }

    private fun MediaMetadataRetriever.meta(key: Int): String? = extractMetadata(key)
}

private enum class MarkTarget(val label: String) {
    START("1 · Object, first frame"),
    END("2 · Object, later frame"),
    REF_A("3 · Reference start"),
    REF_B("4 · Reference end"),
}

private data class TimedPoint(val point: PixelPoint, val timeUs: Long)

/** Everything the user has set up for one video. */
@Stable
private class VideoMarks(initialSlowFactor: Double) {
    var timeUs by mutableLongStateOf(0L)
    var target by mutableStateOf(MarkTarget.START)
    var start by mutableStateOf<TimedPoint?>(null)
    var end by mutableStateOf<TimedPoint?>(null)
    var refA by mutableStateOf<PixelPoint?>(null)
    var refB by mutableStateOf<PixelPoint?>(null)
    var slowText by mutableStateOf(String.format(Locale.US, "%.2f", initialSlowFactor))

    val slowFactor: Double? get() = slowText.replace(',', '.').toDoubleOrNull()?.takeIf { it > 0 }

    fun place(p: PixelPoint) {
        when (target) {
            MarkTarget.START -> { start = TimedPoint(p, timeUs); target = MarkTarget.END }
            MarkTarget.END -> { end = TimedPoint(p, timeUs); target = MarkTarget.REF_A }
            MarkTarget.REF_A -> { refA = p; target = MarkTarget.REF_B }
            MarkTarget.REF_B -> refB = p
        }
    }

    fun clear() {
        start = null; end = null; refA = null; refB = null
        target = MarkTarget.START
    }

    fun isPlaced(t: MarkTarget) = when (t) {
        MarkTarget.START -> start != null
        MarkTarget.END -> end != null
        MarkTarget.REF_A -> refA != null
        MarkTarget.REF_B -> refB != null
    }

    fun speedMs(refMeters: Double?): Double? {
        val a = start ?: return null
        val b = end ?: return null
        return VideoSpeed.speedMs(
            a.point, a.timeUs / 1e6, b.point, b.timeUs / 1e6,
            refA ?: return null, refB ?: return null, refMeters ?: return null,
            slowFactor ?: return null,
        )
    }
}

@Composable
fun VideoSpeedScreen(units: UnitSystem, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var uri by remember { mutableStateOf<Uri?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { picked ->
        if (picked != null) uri = picked
    }
    val pickVideo = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.VideoOnly)) }

    var source by remember { mutableStateOf<VideoSource?>(null) }
    DisposableEffect(uri) {
        val opened = uri?.let {
            try {
                VideoSource(context, it)
            } catch (e: Exception) {
                error = "Couldn't open that video: ${e.message}"
                null
            }
        }
        source = opened
        if (opened != null) error = null
        onDispose { opened?.close() }
    }

    val s = source
    if (s == null) {
        Column(
            modifier.padding(32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "Record the moving object with your camera app, using slow motion if your phone has it. " +
                    "Keep something of known length in view at the same distance as the object.",
                style = MaterialTheme.typography.bodyLarge,
            )
            Button(onClick = pickVideo) { Text("Choose video") }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
    } else {
        VideoMarker(s, units, pickVideo, modifier)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun VideoMarker(source: VideoSource, units: UnitSystem, onPickOther: () -> Unit, modifier: Modifier) {
    val marks = remember(source) { VideoMarks(VideoSpeed.slowMotionFactor(source.captureFps, source.playbackFps)) }
    var refMeters by remember { mutableStateOf<Double?>(null) }
    var frame by remember(source) { mutableStateOf<Bitmap?>(null) }

    LaunchedEffect(source, marks.timeUs) {
        val t = marks.timeUs
        frame = withContext(source.decoder) { runCatching { source.frameAt(t) }.getOrNull() } ?: frame
    }
    val speed = marks.speedMs(refMeters)

    Column(modifier) {
        // Frame with tap-to-mark. Points are stored in bitmap pixels, so they don't depend on layout.
        BoxWithConstraints(
            Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentAlignment = Alignment.Center,
        ) {
            val bmp = frame
            if (bmp == null) {
                Text("Loading frame…")
            } else {
            val density = LocalDensity.current
            val boxW = with(density) { maxWidth.toPx() }
            val boxH = with(density) { maxHeight.toPx() }
            val scale = min(boxW / bmp.width, boxH / bmp.height)
            val offset = Offset((boxW - bmp.width * scale) / 2f, (boxH - bmp.height * scale) / 2f)
            fun toScreen(p: PixelPoint) = Offset(offset.x + p.x * scale, offset.y + p.y * scale)

            Image(bmp.asImageBitmap(), contentDescription = "Video frame", contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize())
            Canvas(
                Modifier
                    .fillMaxSize()
                    .pointerInput(scale, offset) {
                        detectTapGestures { tap ->
                            marks.place(PixelPoint((tap.x - offset.x) / scale, (tap.y - offset.y) / scale))
                        }
                    },
            ) {
                val objColor = Color(0xFFFF5252)
                val refColor = Color(0xFF40C4FF)
                val a = marks.start
                val b = marks.end
                a?.let { drawCircle(objColor, 14f, toScreen(it.point)) }
                b?.let { drawCircle(objColor, 14f, toScreen(it.point)) }
                if (a != null && b != null) drawLine(objColor, toScreen(a.point), toScreen(b.point), 4f)
                val ra = marks.refA
                val rb = marks.refB
                ra?.let { drawCircle(refColor, 12f, toScreen(it)) }
                rb?.let { drawCircle(refColor, 12f, toScreen(it)) }
                if (ra != null && rb != null) drawLine(refColor, toScreen(ra), toScreen(rb), 6f)
            }
            }
        }

        Column(
            Modifier
                .fillMaxWidth()
                .heightIn(max = 360.dp)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                speed?.let { Units.speed(it, units) } ?: "Mark the object on two frames, then a reference",
                style = if (speed != null) MaterialTheme.typography.displaySmall else MaterialTheme.typography.titleMedium,
            )
            Slider(
                value = if (source.durationUs > 0) marks.timeUs.toFloat() / source.durationUs else 0f,
                onValueChange = { marks.timeUs = (it * source.durationUs).toLong() },
            )
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedButton(onClick = { marks.timeUs = (marks.timeUs - source.frameStepUs).coerceAtLeast(0) }) { Text("◀ Frame") }
                Text(String.format(Locale.US, "%.3f s", marks.timeUs / 1e6))
                OutlinedButton(onClick = { marks.timeUs = (marks.timeUs + source.frameStepUs).coerceAtMost(source.durationUs) }) { Text("Frame ▶") }
            }
            Text("Tap the frame to place:", style = MaterialTheme.typography.labelLarge)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MarkTarget.entries.forEach { t ->
                    FilterChip(
                        selected = t == marks.target,
                        onClick = { marks.target = t },
                        label = { Text(if (marks.isPlaced(t)) "${t.label} ✓" else t.label) },
                    )
                }
            }
            DistanceField(label = "Reference length", units = units, onMeters = { refMeters = it })
            OutlinedTextField(
                value = marks.slowText,
                onValueChange = { marks.slowText = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                label = { Text("Slow-motion factor (8 = 240 fps played at 30 fps)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
            )
            val a = marks.start
            val b = marks.end
            val factor = marks.slowFactor
            if (a != null && b != null && factor != null) {
                Text(
                    String.format(Locale.US, "Real time between marks: %.3f s", abs(b.timeUs - a.timeUs) / 1e6 / factor),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Text(
                "For an accurate result the object should move across the view (not towards you), " +
                    "and the reference should be at the same distance from the camera as the object.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = marks::clear) { Text("Clear marks") }
                OutlinedButton(onClick = onPickOther) { Text("Other video") }
            }
        }
    }
}
