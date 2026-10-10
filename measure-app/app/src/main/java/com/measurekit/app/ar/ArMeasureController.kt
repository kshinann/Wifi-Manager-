package com.measurekit.app.ar

import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.opengl.Matrix
import com.google.ar.core.Anchor
import com.google.ar.core.Config
import com.google.ar.core.DepthPoint
import com.google.ar.core.Frame
import com.google.ar.core.HitResult
import com.google.ar.core.Plane
import com.google.ar.core.Point
import com.google.ar.core.Session
import com.google.ar.core.TrackingFailureReason
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.CameraNotAvailableException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.ConcurrentLinkedQueue
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

/** Screen position in view pixels. */
data class ScreenPoint(val x: Float, val y: Float)

data class ArFrameState(
    val tracking: Boolean = false,
    val hint: String? = "Starting camera…",
    /** Placed points in world space. */
    val points: List<Vec3> = emptyList(),
    /** The same points projected to the screen; null when behind the camera. */
    val screenPoints: List<ScreenPoint?> = emptyList(),
    /** Surface point under the centre crosshair, if any. */
    val reticle: Vec3? = null,
    val error: String? = null,
)

/**
 * Owns the ARCore session and its anchors. All ARCore calls happen on the GL thread;
 * the UI talks to it through [add], [undo] and [clear], which queue commands for the next frame.
 */
class ArMeasureController(private val maxPoints: Int) : GLSurfaceView.Renderer {

    private sealed interface Command {
        data object Add : Command
        data object Undo : Command
        data object Clear : Command
    }

    private val background = BackgroundRenderer()
    private val commands = ConcurrentLinkedQueue<Command>()
    private val anchors = mutableListOf<Anchor>()

    private val _state = MutableStateFlow(ArFrameState())
    val state: StateFlow<ArFrameState> = _state.asStateFlow()

    @Volatile var session: Session? = null
        private set
    private var boundSession: Session? = null
    @Volatile private var geometryDirty = true
    @Volatile var displayRotation = 0
    private var viewWidth = 0
    private var viewHeight = 0

    private val viewMatrix = FloatArray(16)
    private val projMatrix = FloatArray(16)
    private val viewProj = FloatArray(16)

    fun add() = commands.add(Command.Add)
    fun undo() = commands.add(Command.Undo)
    fun clear() = commands.add(Command.Clear)

    fun attach(newSession: Session) {
        val config = Config(newSession).apply {
            planeFindingMode = Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
            focusMode = Config.FocusMode.AUTO
            updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
            // Depth makes hits work on surfaces without detected planes (edges, curved objects).
            if (newSession.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) {
                depthMode = Config.DepthMode.AUTOMATIC
            }
        }
        newSession.configure(config)
        session = newSession
        geometryDirty = true
    }

    /** Call after the GLSurfaceView has been paused, so the GL thread no longer touches the session. */
    fun close() {
        anchors.forEach { it.detach() }
        anchors.clear()
        session?.close()
        session = null
        boundSession = null
    }

    fun reportError(message: String) {
        _state.value = _state.value.copy(error = message)
    }

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        GLES20.glClearColor(0f, 0f, 0f, 1f)
        background.createOnGlThread()
        // A new GL context means a new texture; rebind it.
        boundSession = null
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        GLES20.glViewport(0, 0, width, height)
        viewWidth = width
        viewHeight = height
        geometryDirty = true
    }

    override fun onDrawFrame(gl: GL10?) {
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
        val s = session ?: return
        if (boundSession !== s) {
            s.setCameraTextureName(background.textureId)
            boundSession = s
        }
        if (geometryDirty && viewWidth > 0) {
            s.setDisplayGeometry(displayRotation, viewWidth, viewHeight)
            geometryDirty = false
        }

        val frame = try {
            s.update()
        } catch (e: CameraNotAvailableException) {
            reportError("Camera not available. Close other camera apps and try again.")
            return
        }
        background.draw(frame)

        val camera = frame.camera
        if (camera.trackingState != TrackingState.TRACKING) {
            processCommands(hit = null)
            publish(frame, tracking = false, hint = hintFor(camera.trackingFailureReason), reticle = null)
            return
        }

        val hit = centerHit(frame)
        processCommands(hit)

        val hasPlanes = s.getAllTrackables(Plane::class.java).any { it.trackingState == TrackingState.TRACKING }
        val hint = when {
            hit != null -> null
            !hasPlanes -> "Move your phone slowly to find surfaces"
            else -> "Aim the crosshair at a surface"
        }
        val reticle = hit?.hitPose?.let { Vec3(it.tx(), it.ty(), it.tz()) }
        publish(frame, tracking = true, hint = hint, reticle = reticle)
    }

    private fun centerHit(frame: Frame): HitResult? =
        frame.hitTest(viewWidth / 2f, viewHeight / 2f).firstOrNull { hit ->
            when (val t = hit.trackable) {
                is Plane -> t.isPoseInPolygon(hit.hitPose)
                is DepthPoint -> true
                is Point -> t.orientationMode == Point.OrientationMode.ESTIMATED_SURFACE_NORMAL
                else -> false
            }
        }

    private fun processCommands(hit: HitResult?) {
        while (true) {
            when (commands.poll() ?: break) {
                Command.Add -> if (hit != null && anchors.size < maxPoints) anchors += hit.createAnchor()
                Command.Undo -> anchors.removeLastOrNull()?.detach()
                Command.Clear -> {
                    anchors.forEach { it.detach() }
                    anchors.clear()
                }
            }
        }
    }

    private fun publish(frame: Frame, tracking: Boolean, hint: String?, reticle: Vec3?) {
        val points = anchors.map { a -> a.pose.let { Vec3(it.tx(), it.ty(), it.tz()) } }
        val screen = if (tracking) {
            frame.camera.getViewMatrix(viewMatrix, 0)
            frame.camera.getProjectionMatrix(projMatrix, 0, 0.05f, 100f)
            Matrix.multiplyMM(viewProj, 0, projMatrix, 0, viewMatrix, 0)
            points.map(::project)
        } else {
            points.map { null }
        }
        _state.value = ArFrameState(
            tracking = tracking,
            hint = hint,
            points = points,
            screenPoints = screen,
            reticle = reticle,
            error = null,
        )
    }

    private fun project(p: Vec3): ScreenPoint? {
        val world = floatArrayOf(p.x, p.y, p.z, 1f)
        val clip = FloatArray(4)
        Matrix.multiplyMV(clip, 0, viewProj, 0, world, 0)
        if (clip[3] <= 0f) return null
        val ndcX = clip[0] / clip[3]
        val ndcY = clip[1] / clip[3]
        return ScreenPoint((ndcX + 1f) / 2f * viewWidth, (1f - ndcY) / 2f * viewHeight)
    }

    private fun hintFor(reason: TrackingFailureReason): String = when (reason) {
        TrackingFailureReason.INSUFFICIENT_LIGHT -> "Too dark. Move to a brighter area"
        TrackingFailureReason.EXCESSIVE_MOTION -> "Moving too fast. Slow down"
        TrackingFailureReason.INSUFFICIENT_FEATURES -> "Aim at a surface with more texture or detail"
        TrackingFailureReason.CAMERA_UNAVAILABLE -> "Camera unavailable"
        else -> "Move your phone slowly to start tracking"
    }
}
