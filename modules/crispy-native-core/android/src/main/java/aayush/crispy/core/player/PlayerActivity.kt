package aayush.crispy.core.player

import android.app.PictureInPictureParams
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.util.Rational
import android.view.Surface
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference
import java.util.ArrayDeque
import java.util.HashMap
import kotlin.math.roundToInt

/**
 * Native-first player host for Android:
 * - SurfaceView-backed video surface owned by the Activity
 * - React UI overlay mounted as a normal RN root (same JS runtime)
 * - Playback engines remain Service-owned (VlcPlaybackService / ExoPlaybackService)
 */
class PlayerActivity : ReactActivity() {
  companion object {
    const val EXTRA_SESSION_ID = "crispy.player.sessionId"
    const val EXTRA_URL = "crispy.player.url"
    const val EXTRA_HEADERS = "crispy.player.headers"
    const val EXTRA_ENGINE = "crispy.player.engine" // "exoplayer" | "vlc"
    const val EXTRA_PAUSED = "crispy.player.paused"
    const val EXTRA_TITLE = "crispy.player.title"
    const val EXTRA_ARTIST = "crispy.player.artist"
    const val EXTRA_ARTWORK_URL = "crispy.player.artworkUrl"

    const val ENGINE_EXO = "exoplayer"
    const val ENGINE_VLC = "vlc"

    private const val TAG = "PlayerActivity"
    private const val MAX_ASPECT = 2.39
    private const val MIN_ASPECT = 1.0 / MAX_ASPECT
    private const val SURFACE_ATTACH_RETRY_MS = 200L
    private const val MAX_SURFACE_ATTACH_RETRIES = 15
    private const val JS_EMIT_RETRY_MS = 250L
    private const val MAX_PENDING_JS_EVENTS = 96
    private const val PENDING_JS_EVENT_TTL_MS = 12_000L
    private const val REACT_CONTEXT_WARN_THROTTLE_MS = 2_000L

    private var activeRef: WeakReference<PlayerActivity>? = null
    fun getActive(): PlayerActivity? = activeRef?.get()
  }

  private var sessionId: String = ""
  private var engine: String = ENGINE_EXO
  private var url: String? = null
  private var headers: Map<String, String>? = null
  private var startPaused: Boolean = false

  private var title: String = ""
  private var artist: String = ""
  private var artworkUrl: String? = null

  private var surfaceView: SurfaceView? = null
  private var containerW: Int = 0
  private var containerH: Int = 0

  private var vlcService: VlcPlaybackService? = null
  private var exoService: ExoPlaybackService? = null
  private var bound: Boolean = false

  private var videoW: Int = 0
  private var videoH: Int = 0
  private var isPlaying: Boolean = false

  private var resizeMode: String? = null

  private var exoFallbackToVlcAttempted: Boolean = false

  private var pendingTracksEmit: Boolean = false
  private var cachedAudioTracks: List<Map<String, Any>> = emptyList()
  private var cachedSubtitleTracks: List<Map<String, Any>> = emptyList()

  private var lastProgressEmitMs: Long = 0L

  private var wasInPip: Boolean = false
  private var activityStopped: Boolean = false
  private val mainHandler = Handler(Looper.getMainLooper())

  private var surfaceAttachRetryCount: Int = 0
  private var surfaceAttachRetryScheduled: Boolean = false
  private var surfaceAttachRetryReason: String = ""
  private val surfaceAttachRetryRunnable = Runnable {
    surfaceAttachRetryScheduled = false
    surfaceAttachRetryCount += 1
    ensureSurfaceAttached("retry:$surfaceAttachRetryReason", resetRetries = false)
  }

  private data class PendingJsEvent(
    val eventName: String,
    val payload: Any?,
    val debugName: String,
    val enqueuedAtMs: Long
  )

  private val pendingJsEvents: ArrayDeque<PendingJsEvent> = ArrayDeque()
  private var jsEmitRetryScheduled: Boolean = false
  private var lastReactContextWarnAtMs: Long = 0L
  private val jsEmitRetryRunnable = Runnable {
    jsEmitRetryScheduled = false
    if (isFinishing || isDestroyedCompat()) return@Runnable
    flushQueuedJsEventsOnUiThread()
    if (pendingJsEvents.isNotEmpty()) {
      scheduleJsEmitRetry()
    }
  }

  override fun getMainComponentName(): String = "PlayerOverlayRoot"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return object : ReactActivityDelegate(this, mainComponentName) {
      override fun getLaunchOptions(): Bundle? {
        val b = Bundle()
        b.putString("sessionId", sessionId)
        b.putString("engine", engine)
        b.putString("url", url)
        b.putBoolean("paused", startPaused)
        b.putString("title", title)
        b.putString("artist", artist)
        b.putString("artworkUrl", artworkUrl)
        return b
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    activeRef = WeakReference(this)
    parseIntent(intent)

    requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    super.onCreate(savedInstanceState)

    setupImmersiveMode()
    installTextureBehindReact()
    bindPlaybackService()
    updatePipParams()
  }

  private fun setupImmersiveMode() {
    // Use WindowInsetsControllerCompat for consistent behavior across API levels
    val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
    
    // Configure system bars behavior
    windowInsetsController.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    
    // Hide both status bar and navigation bar
    windowInsetsController.hide(WindowInsetsCompat.Type.systemBars())
    
    // Enable edge-to-edge display (Android 15+ requirement, backward compatible)
    WindowCompat.setDecorFitsSystemWindows(window, false)
    
    // Ensure the window uses the full screen (no letterboxing on modern devices)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    parseIntent(intent)
  }

  private fun parseIntent(intent: Intent) {
    sessionId = intent.getStringExtra(EXTRA_SESSION_ID) ?: sessionId

    val rawEngine = (intent.getStringExtra(EXTRA_ENGINE) ?: engine).lowercase()
    engine = when (rawEngine) {
      ENGINE_VLC -> ENGINE_VLC
      ENGINE_EXO -> ENGINE_EXO
      // Legacy fallback
      "mpv" -> ENGINE_VLC
      else -> ENGINE_EXO
    }

    url = intent.getStringExtra(EXTRA_URL)
    startPaused = intent.getBooleanExtra(EXTRA_PAUSED, false)
    title = intent.getStringExtra(EXTRA_TITLE) ?: ""
    artist = intent.getStringExtra(EXTRA_ARTIST) ?: ""
    artworkUrl = intent.getStringExtra(EXTRA_ARTWORK_URL)
    headers = readHeaders(intent)
  }

  private fun readHeaders(intent: Intent): Map<String, String>? {
    val raw: Any? = try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getSerializableExtra(EXTRA_HEADERS, HashMap::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getSerializableExtra(EXTRA_HEADERS)
      }
    } catch (_: Throwable) {
      null
    }

    val map = raw as? HashMap<*, *> ?: return null
    val out = HashMap<String, String>()
    for ((k, v) in map.entries) {
      val key = k as? String ?: continue
      val value = v as? String ?: continue
      out[key] = value
    }
    return out
  }

  private fun installTextureBehindReact() {
    val content = findViewById<ViewGroup>(android.R.id.content) ?: return

    // Ensure letterboxing area is true black (not theme default gray).
    try {
      content.setBackgroundColor(Color.BLACK)
    } catch (_: Throwable) {
      // ignore
    }

    val reactRoot = content.getChildAt(0)
    try {
      reactRoot?.setBackgroundColor(Color.TRANSPARENT)
    } catch (_: Throwable) {
      // ignore
    }

    val sv = SurfaceView(this)
    sv.setZOrderOnTop(false)
    sv.setZOrderMediaOverlay(false)
    try {
      sv.holder.setFormat(PixelFormat.OPAQUE)
    } catch (_: Throwable) {
      // ignore
    }
    sv.layoutParams = FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT,
      android.view.Gravity.CENTER
    )
    sv.holder.addCallback(surfaceCallback)
    surfaceView = sv
    content.addView(sv, 0)
    
    // Capture initial container size
    content.post {
        containerW = content.width
        containerH = content.height
        applyResizeTransform()
    }
  }

  private val surfaceCallback = object : SurfaceHolder.Callback {
    override fun surfaceCreated(holder: SurfaceHolder) {
      ensureSurfaceAttached("surfaceCreated")
      updatePipParams()
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
      // Surface size changed. If this was triggered by our own resize, we're good.
      // But if the container changed (rotation?), we need to update container dims.
      val content = findViewById<ViewGroup>(android.R.id.content)
      if (content != null) {
          containerW = content.width
          containerH = content.height
      }
      
      if (engine == ENGINE_VLC) {
        vlcService?.setSurfaceSize(width, height)
      }
      if (width <= 0 || height <= 0) {
        scheduleSurfaceAttachRetry("surfaceChanged-invalid-size")
        return
      }
      // Note: We don't call applyResizeTransform() here to avoid loops.
      ensureSurfaceAttached("surfaceChanged")
      updatePipParams()
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
      cancelSurfaceAttachRetry()
      detachSurface()
    }
  }

  private fun bindPlaybackService() {
    if (bound) return

    val serviceIntent = if (engine == ENGINE_VLC) {
      Intent(this, VlcPlaybackService::class.java)
    } else {
      Intent(this, ExoPlaybackService::class.java)
    }

    try {
      startService(serviceIntent)
    } catch (t: Throwable) {
      Log.w(TAG, "startService failed", t)
    }

    bound = try {
      bindService(serviceIntent, connection, Context.BIND_AUTO_CREATE)
    } catch (t: Throwable) {
      Log.e(TAG, "bindService failed", t)
      false
    }
  }

  private val connection = object : ServiceConnection {
    override fun onServiceConnected(name: android.content.ComponentName, service: IBinder) {
      if (engine == ENGINE_VLC) {
        val binder = service as VlcPlaybackService.LocalBinder
        vlcService = binder.getService()
        vlcService?.registerClient()
        vlcService?.addListener(vlcListener)

        applyPendingLoadIfReady()
        ensureSurfaceAttached("vlcServiceConnected")
        updatePipParams()
        return
      }

      val binder = service as ExoPlaybackService.LocalBinder
      exoService = binder.getService()
      exoService?.registerClient()
      exoService?.addListener(exoListener)

      applyPendingLoadIfReady()
      ensureSurfaceAttached("exoServiceConnected")
      updatePipParams()
    }

    override fun onServiceDisconnected(name: android.content.ComponentName) {
      vlcService = null
      exoService = null
    }
  }

  private fun updateVideoSize(width: Int, height: Int) {
    if (width <= 0 || height <= 0) return
    if (videoW == width && videoH == height) return

    videoW = width
    videoH = height
    applyResizeTransform()
    updatePipParams()
  }

  private val vlcListener = object : VlcEngine.Listener {
    override fun onLoad(duration: Double, width: Int, height: Int) {
      updateVideoSize(width, height)

      emitNativePlayerEvent(
        "load",
        mapOf(
          "duration" to duration,
          "width" to width,
          "height" to height
        )
      )
    }

    override fun onVideoSizeChanged(width: Int, height: Int) {
      updateVideoSize(width, height)
    }

    override fun onProgress(position: Double, duration: Double) {
      val now = SystemClock.uptimeMillis()
      if (now - lastProgressEmitMs < 500L) return
      lastProgressEmitMs = now

      emitNativePlayerEvent(
        "progress",
        mapOf(
          "position" to position,
          "duration" to duration
        )
      )
    }

    override fun onEnd() {
      emitNativePlayerEvent("end", emptyMap())
    }

    override fun onError(error: String) {
      Log.w(TAG, "VLC error: $error")
      emitNativePlayerEvent(
        "error",
        mapOf(
          "message" to error
        )
      )
    }

    override fun onTracksChanged(audioTracks: List<Map<String, Any>>, subtitleTracks: List<Map<String, Any>>) {
      emitNativePlayerEvent(
        "tracks",
        mapOf(
          "audioTracks" to audioTracks,
          "subtitleTracks" to subtitleTracks
        )
      )
    }

    override fun onIsPlayingChanged(isPlaying: Boolean) {
      this@PlayerActivity.isPlaying = isPlaying
      updatePipParams()
      emitNativePlayerEvent(
        "isPlaying",
        mapOf(
          "isPlaying" to isPlaying
        )
      )
    }

    override fun onBufferingChanged(buffering: Boolean) {
      emitNativePlayerEvent(
        "buffering",
        mapOf(
          "buffering" to buffering
        )
      )
    }

    override fun onFirstFrameRendered() {
      emitNativePlayerEvent("first-frame", emptyMap())
    }
  }

  private val exoListener = object : ExoEngine.Listener {
    override fun onLoad(duration: Double, width: Int, height: Int) {
      updateVideoSize(width, height)

      emitNativePlayerEvent(
        "load",
        mapOf(
          "duration" to duration,
          "width" to width,
          "height" to height
        )
      )
    }

    override fun onProgress(currentTime: Double, duration: Double) {
      // ExoEngine already ticks at 500ms; forward as-is.
      emitNativePlayerEvent(
        "progress",
        mapOf(
          "position" to currentTime,
          "duration" to duration
        )
      )
    }

    override fun onEnd() {
      emitNativePlayerEvent("end", emptyMap())
    }

    override fun onError(error: String) {
      Log.w(TAG, "Exo error: $error")

      // If Exo fails (codec/decoder, etc.), fall back to VLC for this session.
      if (maybeFallbackToVlcFromExo(error)) {
        return
      }

      emitNativePlayerEvent(
        "error",
        mapOf(
          "message" to error
        )
      )
    }

    override fun onTracksChanged(audioTracks: List<Map<String, Any>>, subtitleTracks: List<Map<String, Any>>) {
      emitNativePlayerEvent(
        "tracks",
        mapOf(
          "audioTracks" to audioTracks,
          "subtitleTracks" to subtitleTracks
        )
      )
    }

    override fun onIsPlayingChanged(isPlaying: Boolean) {
      this@PlayerActivity.isPlaying = isPlaying
      updatePipParams()
      emitNativePlayerEvent(
        "isPlaying",
        mapOf(
          "isPlaying" to isPlaying
        )
      )
    }

    override fun onBufferingChanged(buffering: Boolean) {
      emitNativePlayerEvent(
        "buffering",
        mapOf(
          "buffering" to buffering
        )
      )
    }

    override fun onFirstFrameRendered() {
      emitNativePlayerEvent("first-frame", emptyMap())
    }
  }

  fun loadFromJs(
    nextUrl: String?,
    nextHeaders: Map<String, String>?,
    paused: Boolean,
    nextTitle: String?,
    nextArtist: String?,
    nextArtworkUrl: String?
  ) {
    url = nextUrl
    headers = nextHeaders
    startPaused = paused

    title = nextTitle ?: ""
    artist = nextArtist ?: ""
    artworkUrl = nextArtworkUrl

    applyPendingLoadIfReady()
  }

  private fun applyPendingLoadIfReady() {
    val nextUrl = url
    if (nextUrl.isNullOrBlank()) return

    isPlaying = !startPaused
    updatePipParams()

    if (engine == ENGINE_VLC) {
      val svc = vlcService ?: return
      headers?.let { svc.setHeaders(it) }
      svc.setMetadata(title, artist, artworkUrl)
      svc.setPaused(startPaused)
      svc.setSource(nextUrl)
      return
    }

    val svc = exoService ?: return
    headers?.let { svc.setHeaders(it) }
    svc.setMetadata(title, artist, artworkUrl)
    svc.setPaused(startPaused)
    svc.setSource(nextUrl)
  }

  private fun attachSurfaceIfReady(reason: String): Boolean {
    val sv = surfaceView ?: return false
    val holder = sv.holder
    if (holder.isCreating) return false

    if (engine == ENGINE_VLC) {
      val svc = vlcService ?: return false
      val surface = holder.surface
      if (surface == null || !surface.isValid) return false

      val frame = holder.surfaceFrame
      val w = when {
        frame.width() > 0 -> frame.width()
        sv.width > 0 -> sv.width
        else -> 1920
      }
      val h = when {
        frame.height() > 0 -> frame.height()
        sv.height > 0 -> sv.height
        else -> 1080
      }

      return try {
        svc.attachSurface(surface, w, h)
        true
      } catch (t: Throwable) {
        Log.w(TAG, "Failed to attach VLC surface reason=$reason", t)
        false
      }
    }

    val player = exoService?.getPlayer() ?: return false
    val surface = holder.surface
    if (surface == null || !surface.isValid) return false

    return try {
      player.clearVideoSurface()
      player.clearVideoSurfaceView(sv)
      player.setVideoSurfaceView(sv)
      true
    } catch (t: Throwable) {
      Log.w(TAG, "Failed to attach Exo surface view reason=$reason", t)
      false
    }
  }

  private fun detachSurface() {
    if (engine == ENGINE_VLC) {
      try {
        vlcService?.detachSurface()
      } catch (_: Throwable) {
        // ignore
      }
      return
    }

    val sv = surfaceView ?: return
    val player = exoService?.getPlayer() ?: return
    try {
      player.clearVideoSurfaceView(sv)
    } catch (_: Throwable) {
      // ignore
    }
  }

  private fun ensureSurfaceAttached(reason: String, resetRetries: Boolean = true) {
    if (isFinishing || isDestroyedCompat()) return
    if (resetRetries) {
      surfaceAttachRetryCount = 0
    }

    if (attachSurfaceIfReady(reason)) {
      cancelSurfaceAttachRetry()
      return
    }

    if (surfaceAttachRetryCount >= MAX_SURFACE_ATTACH_RETRIES) {
      Log.e(TAG, "Surface did not attach after retries; reason=$reason engine=$engine")
      return
    }

    scheduleSurfaceAttachRetry(reason)
  }

  private fun scheduleSurfaceAttachRetry(reason: String) {
    surfaceAttachRetryReason = reason
    if (surfaceAttachRetryScheduled) return
    surfaceAttachRetryScheduled = true
    mainHandler.postDelayed(surfaceAttachRetryRunnable, SURFACE_ATTACH_RETRY_MS)
  }

  private fun cancelSurfaceAttachRetry() {
    surfaceAttachRetryScheduled = false
    mainHandler.removeCallbacks(surfaceAttachRetryRunnable)
  }

  private fun isDestroyedCompat(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
      isDestroyed
    } else {
      false
    }
  }

  fun setPausedFromJs(paused: Boolean) {
    startPaused = paused
    isPlaying = !paused
    if (engine == ENGINE_VLC) vlcService?.setPaused(paused) else exoService?.setPaused(paused)
    updatePipParams()
  }

  fun seekFromJs(positionSec: Double) {
    if (engine == ENGINE_VLC) vlcService?.seek(positionSec) else exoService?.seek(positionSec)
  }

  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      if (!isPlaying) return
      emit("onPipWillEnter", null)
      try {
        enterPictureInPictureMode(buildPipParams())
      } catch (t: Throwable) {
        Log.w(TAG, "enterPiP failed", t)
      }
    }
  }

  override fun onStart() {
    super.onStart()
    activeRef = WeakReference(this)
    activityStopped = false
    ensureSurfaceAttached("onStart")
  }

  override fun onResume() {
    super.onResume()
    ensureSurfaceAttached("onResume")
    surfaceView?.post {
      ensureSurfaceAttached("onResume-post")
    }
  }

  override fun onStop() {
    super.onStop()
    activityStopped = true
  }

  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode)

    emit("onPipModeChanged", isInPictureInPictureMode)

    val was = wasInPip
    wasInPip = isInPictureInPictureMode

    if (!isInPictureInPictureMode && was && activityStopped) {
      // Treat as dismissal (swipe away).
      setPausedFromJs(true)
      emit("onPipDismissed", null)
      finish()
      return
    }

    if (!isInPictureInPictureMode && was) {
      ensureSurfaceAttached("exitPiP")
      surfaceView?.postDelayed({ ensureSurfaceAttached("exitPiP-post") }, 120L)
    }
  }

  override fun onBackPressed() {
    stopPlaybackAndFinish()
  }

  fun stopPlaybackAndFinishFromJs(reason: String?) {
    Log.i(TAG, "stopPlaybackAndFinishFromJs reason=$reason engine=$engine")
    stopPlaybackAndFinish()
  }

  private fun stopPlaybackAndFinish() {
    Log.i(TAG, "stopPlaybackAndFinish engine=$engine")
    // Stop playback directly via the bound service first (synchronous)
    try {
      if (engine == ENGINE_VLC) {
        vlcService?.stopPlayback()
      } else {
        exoService?.stopPlayback()
      }
    } catch (_: Throwable) {
      // ignore
    }
    
    // Also send stop intent to the service as a backup
    try {
      if (engine == ENGINE_VLC) {
        startService(Intent(this, VlcPlaybackService::class.java).setAction(VlcPlaybackService.ACTION_STOP))
      } else {
        startService(Intent(this, ExoPlaybackService::class.java).setAction(ExoPlaybackService.ACTION_STOP))
      }
    } catch (_: Throwable) {
      // ignore
    }
    finish()
  }

  override fun onDestroy() {
    // Let the background /player route clean up (e.g., destroyStream(sessionId)) once we close.
    emit("onNativePlayerClosed", sessionId)

    // If we are truly closing the player UI, ensure playback is stopped.
    // (The service is started via startService(), so it can keep running after unbind unless stopped.)
    if (isFinishing && !isInPictureInPictureMode) {
      Log.i(TAG, "onDestroy(isFinishing) stopping playback (engine=$engine)")
      try {
        if (engine == ENGINE_VLC) {
          vlcService?.stopPlayback()
        } else {
          exoService?.stopPlayback()
        }
      } catch (_: Throwable) {
        // ignore
      }

      try {
        if (engine == ENGINE_VLC) {
          startService(Intent(this, VlcPlaybackService::class.java).setAction(VlcPlaybackService.ACTION_STOP))
        } else {
          startService(Intent(this, ExoPlaybackService::class.java).setAction(ExoPlaybackService.ACTION_STOP))
        }
      } catch (_: Throwable) {
        // ignore
      }
    }

    try {
      if (engine == ENGINE_VLC) {
        vlcService?.removeListener(vlcListener)
        vlcService?.unregisterClient()
      } else {
        exoService?.removeListener(exoListener)
        exoService?.unregisterClient()
      }
    } catch (_: Throwable) {
      // ignore
    }

    try {
      detachSurface()
    } catch (_: Throwable) {
      // ignore
    }

    if (bound) {
      try {
        unbindService(connection)
      } catch (_: Throwable) {
        // ignore
      }
      bound = false
    }

    vlcService = null
    exoService = null
    surfaceView = null

    cancelSurfaceAttachRetry()
    cancelJsEmitRetry()
    pendingJsEvents.clear()

    val active = activeRef?.get()
    if (active === this) {
      activeRef = null
    }

    super.onDestroy()
  }

  fun setRateFromJs(rate: Double) {
    if (engine == ENGINE_VLC) vlcService?.setRate(rate) else exoService?.setRate(rate)
  }

  fun setVolumeFromJs(volume: Double) {
    if (engine == ENGINE_VLC) vlcService?.setVolume(volume) else exoService?.setVolume(volume)
  }

  fun setResizeModeFromJs(mode: String?) {
    Log.i(TAG, "setResizeModeFromJs engine=$engine mode=$mode container=${containerW}x${containerH} video=${videoW}x${videoH} surface=${surfaceView?.width}x${surfaceView?.height}")
    resizeMode = mode
    applyResizeTransform()
    updatePipParams()
    // Forward resize mode to VLC engine for its internal scaling.
    if (engine == ENGINE_VLC) {
      vlcService?.setResizeMode(mode)
    }
  }

  fun setAudioTrackFromJs(trackId: Int) {
    if (engine == ENGINE_VLC) vlcService?.setAudioTrack(trackId) else exoService?.setAudioTrack(trackId)
  }

  fun setSubtitleTrackFromJs(trackId: Int) {
    if (engine == ENGINE_VLC) vlcService?.setSubtitleTrack(trackId) else exoService?.setSubtitleTrack(trackId)
  }

  fun setSubtitleDelayFromJs(delaySec: Double) {
    if (engine == ENGINE_VLC) vlcService?.setSubtitleDelay(delaySec)
  }

  // --- VLC/MPV stubs ---
  fun setSubtitleSizeFromJs(size: Int) {}
  fun setSubtitleColorFromJs(color: String) {}
  fun setSubtitleBackgroundColorFromJs(color: String, opacity: Float) {}
  fun setSubtitleBorderSizeFromJs(size: Int) {}
  fun setSubtitleBorderColorFromJs(color: String) {}
  fun setSubtitlePositionFromJs(pos: Int) {}
  fun setSubtitleBoldFromJs(bold: Boolean) {}
  fun setSubtitleItalicFromJs(italic: Boolean) {}
  fun setDecoderModeFromJs(mode: String?) {}
  fun setGpuModeFromJs(mode: String?) {}

  private fun buildPipParams(): PictureInPictureParams {
    val builder = PictureInPictureParams.Builder()

    val ratio = buildAspectRatio(videoW, videoH)
    if (ratio != null) {
      try {
        builder.setAspectRatio(ratio)
      } catch (_: Throwable) {
        // ignore
      }
    }

    val rect = computeSourceRectHint()
    if (rect != null) {
      try {
        builder.setSourceRectHint(rect)
      } catch (_: Throwable) {
        // ignore
      }
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      try {
        builder.setAutoEnterEnabled(isPlaying)
      } catch (_: Throwable) {
        // ignore
      }
      setSeamlessResizeEnabledCompat(builder, false)
    }

    return builder.build()
  }

  private fun updatePipParams() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    if (isInPictureInPictureMode) return

    try {
      setPictureInPictureParams(buildPipParams())
    } catch (_: Throwable) {
      // ignore
    }
  }

  private fun applyResizeTransform() {
    val sv = surfaceView ?: return

    // VLC handles fit/fill internally via MediaPlayer.setVideoScale().
    // Keep the SurfaceView itself full-screen to avoid double-scaling.
    if (engine == ENGINE_VLC) {
      val mp = android.view.ViewGroup.LayoutParams.MATCH_PARENT
      val lp = sv.layoutParams as? FrameLayout.LayoutParams
      if (lp == null || lp.width != mp || lp.height != mp) {
        val p = lp ?: FrameLayout.LayoutParams(mp, mp)
        p.width = mp
        p.height = mp
        p.gravity = android.view.Gravity.CENTER
        sv.layoutParams = p
        Log.i(TAG, "applyResizeTransform: VLC -> reset SurfaceView to match_parent")
      }
      return
    }
    
    // We resize the SurfaceView layout params directly.
    
    if (containerW <= 0 || containerH <= 0 || videoW <= 0 || videoH <= 0) {
      // Not ready yet, keep full match_parent or previous state
      return
    }
    
    val mode = (resizeMode ?: "contain").lowercase()
    
    var targetW = containerW
    var targetH = containerH

    val videoRatio = videoW.toFloat() / videoH.toFloat()
    val containerRatio = containerW.toFloat() / containerH.toFloat()

    if (mode == "cover") {
      if (containerRatio > videoRatio) {
        // Container is wider -> match width, exceed height
        targetW = containerW
        targetH = (containerW / videoRatio).toInt()
      } else {
        // Container is taller -> match height, exceed width
        targetH = containerH
        targetW = (containerH * videoRatio).toInt()
      }
    } else {
      if (containerRatio > videoRatio) {
        // Container is wider -> fit height, adjust width
        targetH = containerH
        targetW = (containerH * videoRatio).toInt()
      } else {
        // Container is taller -> fit width, adjust height
        targetW = containerW
        targetH = (containerW / videoRatio).toInt()
      }
    }
    
    // Apply changes if needed
    val params = sv.layoutParams as? FrameLayout.LayoutParams ?: FrameLayout.LayoutParams(targetW, targetH)
    if (params.width != targetW || params.height != targetH) {
        params.width = targetW
        params.height = targetH
        params.gravity = android.view.Gravity.CENTER
        sv.layoutParams = params
        Log.i(TAG, "applyResizeTransform mode=$mode container=${containerW}x${containerH} video=${videoW}x${videoH} -> ${targetW}x${targetH}")
        // This will trigger surfaceChanged
    }
  }

  private fun maybeFallbackToVlcFromExo(exoError: String): Boolean {
    if (engine != ENGINE_EXO) return false
    if (exoFallbackToVlcAttempted) return false

    val nextUrl = url
    if (nextUrl.isNullOrBlank()) return false

    exoFallbackToVlcAttempted = true
    Log.w(TAG, "Falling back to VLC (session=$sessionId) due to Exo error: $exoError")

    // Stop Exo playback best-effort.
    try {
      startService(Intent(this, ExoPlaybackService::class.java).setAction(ExoPlaybackService.ACTION_STOP))
    } catch (_: Throwable) {
      // ignore
    }

    try {
      exoService?.removeListener(exoListener)
      exoService?.unregisterClient()
    } catch (_: Throwable) {
      // ignore
    }

    try {
      // Detach Exo from the SurfaceView before switching engines.
      detachSurface()
    } catch (_: Throwable) {
      // ignore
    }

    if (bound) {
      try {
        unbindService(connection)
      } catch (_: Throwable) {
        // ignore
      }
      bound = false
    }
    exoService = null

    // Switch engine and re-bind.
    engine = ENGINE_VLC
    videoW = 0
    videoH = 0

    bindPlaybackService()
    return true
  }

  private fun computeSourceRectHint(): Rect? {
    val sv = surfaceView ?: return null
    if (sv.width <= 0 || sv.height <= 0) return null
    
    val out = Rect()
    val ok = try {
      sv.getGlobalVisibleRect(out)
    } catch (_: Throwable) {
      false
    }
    if (!ok) return null

    // For SurfaceView resizing strategy, the View itself IS the content rect.
    // So 'out' (the global rect of the view) should be correct for the PiP hint.
    return out
  }

  private fun buildAspectRatio(width: Int, height: Int): Rational? {
    if (width <= 0 || height <= 0) return null
    val ratio = (width.toDouble() / height.toDouble()).coerceIn(MIN_ASPECT, MAX_ASPECT)
    val denom = 1000
    val num = (ratio * denom).roundToInt().coerceAtLeast(1)
    return try {
      Rational(num, denom)
    } catch (_: Throwable) {
      null
    }
  }

  private fun setSeamlessResizeEnabledCompat(builder: PictureInPictureParams.Builder, enabled: Boolean) {
    try {
      val m = builder.javaClass.getMethod("setSeamlessResizeEnabled", Boolean::class.javaPrimitiveType)
      m.invoke(builder, enabled)
    } catch (_: Throwable) {
      // ignore
    }
  }

  private fun getReactContextUnsafe(): ReactContext? {
    try {
      // 1. Try ReactActivity's instance manager (most reliable)
      val ctx = reactInstanceManager.currentReactContext
      if (ctx != null) return ctx
    } catch (_: Exception) {}

    try {
      // 2. Try Application if it is a ReactApplication
      val app = application as? ReactApplication
      val ctx = app?.reactNativeHost?.reactInstanceManager?.currentReactContext
      if (ctx != null) return ctx
    } catch (_: Exception) {}

    // 3. Bridgeless fallback: try ReactHost#getCurrentReactContext via reflection.
    val fromActivityHost = getReactContextFromReactHost(this)
    if (fromActivityHost != null) return fromActivityHost

    val fromAppHost = getReactContextFromReactHost(application)
    if (fromAppHost != null) return fromAppHost

    // 4. Fallback to the mounted React root view context.
    val content = findViewById<ViewGroup>(android.R.id.content)
    if (content != null) {
      for (i in 0 until content.childCount) {
        val child = content.getChildAt(i) ?: continue
        val ctx = unwrapReactContext(child.context)
        if (ctx != null) return ctx
      }
    }

    return null
  }

  private fun getReactContextFromReactHost(hostOwner: Any?): ReactContext? {
    if (hostOwner == null) return null
    return try {
      val getReactHost = hostOwner.javaClass.methods.firstOrNull {
        it.name == "getReactHost" && it.parameterTypes.isEmpty()
      } ?: return null

      val reactHost = getReactHost.invoke(hostOwner) ?: return null
      val getCurrentReactContext = reactHost.javaClass.methods.firstOrNull {
        it.name == "getCurrentReactContext" && it.parameterTypes.isEmpty()
      } ?: return null

      getCurrentReactContext.invoke(reactHost) as? ReactContext
    } catch (_: Throwable) {
      null
    }
  }

  private fun unwrapReactContext(context: Context?): ReactContext? {
    var current = context
    var guard = 0
    while (current != null && guard < 12) {
      if (current is ReactContext) return current
      current = (current as? ContextWrapper)?.baseContext
      guard += 1
    }
    return null
  }

  private fun emit(eventName: String, payload: Any?) {
    runOnUiThread {
      emitOrQueueJsEventOnUiThread(eventName, payload, eventName)
    }
  }

  private fun emitNativePlayerEvent(eventType: String, extras: Map<String, Any>) {
    if (eventType == "tracks") {
      @Suppress("UNCHECKED_CAST")
      val audio = extras["audioTracks"] as? List<Map<String, Any>>
      @Suppress("UNCHECKED_CAST")
      val subs = extras["subtitleTracks"] as? List<Map<String, Any>>
      cachedAudioTracks = audio ?: emptyList()
      cachedSubtitleTracks = subs ?: emptyList()
      pendingTracksEmit = true
    }

    val payload = HashMap<String, Any>()
    payload["sessionId"] = sessionId
    payload["engine"] = engine
    payload["type"] = eventType
    for ((k, v) in extras.entries) {
      payload[k] = v
    }

    runOnUiThread {
      if (pendingTracksEmit) {
        val trackPayload = HashMap<String, Any>()
        trackPayload["sessionId"] = sessionId
        trackPayload["engine"] = engine
        trackPayload["type"] = "tracks"
        trackPayload["audioTracks"] = cachedAudioTracks
        trackPayload["subtitleTracks"] = cachedSubtitleTracks

        emitOrQueueJsEventOnUiThread(
          "nativePlayerEvent",
          Arguments.makeNativeMap(trackPayload),
          "nativePlayerEvent:tracks"
        )
        pendingTracksEmit = false
      }

      if (eventType != "tracks") {
        emitOrQueueJsEventOnUiThread(
          "nativePlayerEvent",
          Arguments.makeNativeMap(payload),
          "nativePlayerEvent:$eventType"
        )
      }
    }
  }

  private fun emitOrQueueJsEventOnUiThread(eventName: String, payload: Any?, debugName: String) {
    if (tryEmitJsEvent(eventName, payload, debugName)) {
      flushQueuedJsEventsOnUiThread()
      return
    }

    enqueueJsEventOnUiThread(PendingJsEvent(eventName, payload, debugName, SystemClock.uptimeMillis()))
    scheduleJsEmitRetry()
  }

  private fun tryEmitJsEvent(eventName: String, payload: Any?, debugName: String): Boolean {
    val rc = getReactContextUnsafe()
    if (rc == null) {
      maybeLogReactContextUnavailable(debugName)
      return false
    }

    return try {
      rc
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, payload)
      true
    } catch (t: Throwable) {
      Log.e(TAG, "Failed to emit $debugName", t)
      false
    }
  }

  private fun enqueueJsEventOnUiThread(event: PendingJsEvent) {
    pruneExpiredJsEventsOnUiThread(event.enqueuedAtMs)

    while (pendingJsEvents.size >= MAX_PENDING_JS_EVENTS) {
      pendingJsEvents.removeFirst()
    }

    pendingJsEvents.addLast(event)
  }

  private fun flushQueuedJsEventsOnUiThread() {
    if (pendingJsEvents.isEmpty()) return

    pruneExpiredJsEventsOnUiThread(SystemClock.uptimeMillis())

    while (pendingJsEvents.isNotEmpty()) {
      val next = pendingJsEvents.peekFirst() ?: break
      if (!tryEmitJsEvent(next.eventName, next.payload, next.debugName)) {
        scheduleJsEmitRetry()
        return
      }
      pendingJsEvents.removeFirst()
    }
  }

  private fun pruneExpiredJsEventsOnUiThread(nowMs: Long) {
    while (pendingJsEvents.isNotEmpty()) {
      val head = pendingJsEvents.peekFirst() ?: break
      if (nowMs - head.enqueuedAtMs <= PENDING_JS_EVENT_TTL_MS) break
      pendingJsEvents.removeFirst()
    }
  }

  private fun scheduleJsEmitRetry() {
    if (jsEmitRetryScheduled) return
    jsEmitRetryScheduled = true
    mainHandler.postDelayed(jsEmitRetryRunnable, JS_EMIT_RETRY_MS)
  }

  private fun cancelJsEmitRetry() {
    jsEmitRetryScheduled = false
    mainHandler.removeCallbacks(jsEmitRetryRunnable)
  }

  private fun maybeLogReactContextUnavailable(debugName: String) {
    val now = SystemClock.uptimeMillis()
    if (now - lastReactContextWarnAtMs < REACT_CONTEXT_WARN_THROTTLE_MS) return
    lastReactContextWarnAtMs = now
    Log.w(
      TAG,
      "ReactContext unavailable, queueing event=$debugName pending=${pendingJsEvents.size}"
    )
  }
}
