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
import android.view.View
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
    const val EXTRA_INFO_HASH = "crispy.player.infoHash"
    const val EXTRA_FILE_IDX = "crispy.player.fileIdx"
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

    private var activeRef: WeakReference<PlayerActivity>? = null
    fun getActive(): PlayerActivity? = activeRef?.get()
  }

  private var sessionId: String = ""
  private var engine: String = ENGINE_EXO
  private var url: String? = null
  private var infoHash: String? = null
  private var fileIdx: Int? = null
  private var headers: Map<String, String>? = null
  private var startPaused: Boolean = false

  private var title: String = ""
  private var artist: String = ""
  private var artworkUrl: String? = null

  private var surfaceView: SurfaceView? = null
  private var subtitleSurfaceView: SurfaceView? = null
  private var reactRootView: View? = null
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

  private lateinit var reactEmitter: PlayerReactEventEmitter
  private lateinit var nativeEventEmitter: PlayerNativePlayerEventEmitter
  private lateinit var surfaceLayer: PlayerSurfaceLayerController
  private val surfaceResizer = PlayerSurfaceResizer(TAG)
  private val pipParamsHelper = PlayerPipParamsHelper(MAX_ASPECT, MIN_ASPECT)

  private var lastProgressEmitMs: Long = 0L

  private var wasInPip: Boolean = false
  private var activityStopped: Boolean = false
  private val mainHandler = Handler(Looper.getMainLooper())
  private val warnLog = PlayerThrottledLogger(TAG)

  private inline fun bestEffort(step: String, crossinline block: () -> Unit) {
    try {
      block()
    } catch (e: Exception) {
      warnLog.w(step, "Best-effort step failed step=$step engine=$engine session=$sessionId", e)
    }
  }

  private var surfaceAttachRetryCount: Int = 0
  private var surfaceAttachRetryScheduled: Boolean = false
  private var surfaceAttachRetryReason: String = ""
  private var awaitingExitPipRelayout: Boolean = false
  private var exitPipContainerW: Int = 0
  private var exitPipContainerH: Int = 0
  private var lastAppliedVlcSurfaceW: Int = -1
  private var lastAppliedVlcSurfaceH: Int = -1
  private val surfaceAttachRetryRunnable = Runnable {
    surfaceAttachRetryScheduled = false
    surfaceAttachRetryCount += 1
    ensureSurfaceAttached("retry:$surfaceAttachRetryReason", resetRetries = false)
  }

  override fun getMainComponentName(): String = "PlayerOverlayRoot"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return object : ReactActivityDelegate(this, mainComponentName) {
      override fun getLaunchOptions(): Bundle? {
        val b = Bundle()
        b.putString("sessionId", sessionId)
        b.putString("engine", engine)
        b.putString("url", url)
        b.putString("infoHash", infoHash)
        if (fileIdx != null) {
          b.putInt("fileIdx", fileIdx!!)
        }
        val launchHeaders = headers
        if (!launchHeaders.isNullOrEmpty()) {
          val headersBundle = Bundle(launchHeaders.size)
          for ((k, v) in launchHeaders) {
            headersBundle.putString(k, v)
          }
          b.putBundle("headers", headersBundle)
        }
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
    reactEmitter = PlayerReactEventEmitter(this, TAG, mainHandler)
    nativeEventEmitter = PlayerNativePlayerEventEmitter(TAG, reactEmitter, { sessionId }, { engine })
    installSurfaceLayers()
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
    infoHash = intent.getStringExtra(EXTRA_INFO_HASH)
    fileIdx = if (intent.hasExtra(EXTRA_FILE_IDX)) intent.getIntExtra(EXTRA_FILE_IDX, -1) else null
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
    } catch (_: Exception) {
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

  private fun installSurfaceLayers() {
    surfaceLayer = PlayerSurfaceLayerController(
      this,
      object : PlayerSurfaceLayerController.Callbacks {
        override fun onContainerLayoutChanged(newW: Int, newH: Int, oldW: Int, oldH: Int) {
          val prevW = containerW
          val prevH = containerH
          containerW = newW
          containerH = newH

          emitVlcDebugEvent(
            "containerLayoutChanged",
            mapOf(
              "oldContainerWidth" to prevW,
              "oldContainerHeight" to prevH,
              "newContainerWidth" to newW,
              "newContainerHeight" to newH
            )
          )

          applyResizeTransform()
          updatePipParams()

          if (awaitingExitPipRelayout && !isInPictureInPictureMode) {
            if (newW != exitPipContainerW || newH != exitPipContainerH) {
              awaitingExitPipRelayout = false
              ensureSurfaceAttached("exitPiP-layoutChanged")
            }
          }
        }

        override fun onVideoSurfaceCreated() {
          ensureSurfaceAttached("surfaceCreated")
          updatePipParams()
          emitVlcDebugEvent("surfaceCreated")
        }

        override fun onVideoSurfaceChanged(format: Int, width: Int, height: Int) {
          val content = findViewById<ViewGroup>(android.R.id.content)
          if (content != null) {
            val prevW = containerW
            val prevH = containerH
            containerW = content.width
            containerH = content.height
            if (containerW != prevW || containerH != prevH) {
              applyResizeTransform()
            }
          }

          emitVlcDebugEvent(
            "surfaceChanged",
            mapOf(
              "surfaceChangedWidth" to width,
              "surfaceChangedHeight" to height,
              "surfaceChangedFormat" to format
            )
          )

          if (width <= 0 || height <= 0) {
            scheduleSurfaceAttachRetry("surfaceChanged-invalid-size")
            emitVlcDebugEvent("surfaceChanged-invalid-size")
            return
          }

          ensureSurfaceAttached("surfaceChanged")
          updatePipParams()
        }

        override fun onVideoSurfaceDestroyed() {
          cancelSurfaceAttachRetry()
          detachSurface()
          emitVlcDebugEvent("surfaceDestroyed")
        }

        override fun onSubtitleSurfaceCreated() {
          ensureSurfaceAttached("subtitleSurfaceCreated")
          emitVlcDebugEvent("subtitleSurfaceCreated")
        }

        override fun onSubtitleSurfaceChanged(format: Int, width: Int, height: Int) {
          val content = findViewById<ViewGroup>(android.R.id.content)
          if (content != null) {
            val prevW = containerW
            val prevH = containerH
            containerW = content.width
            containerH = content.height
            if (containerW != prevW || containerH != prevH) {
              applyResizeTransform()
            }
          }

          emitVlcDebugEvent(
            "subtitleSurfaceChanged",
            mapOf(
              "subtitleSurfaceChangedWidth" to width,
              "subtitleSurfaceChangedHeight" to height,
              "subtitleSurfaceChangedFormat" to format
            )
          )

          if (width <= 0 || height <= 0) {
            scheduleSurfaceAttachRetry("subtitleSurfaceChanged-invalid-size")
            emitVlcDebugEvent("subtitleSurfaceChanged-invalid-size")
            return
          }

          ensureSurfaceAttached("subtitleSurfaceChanged")
          updatePipParams()
        }

        override fun onSubtitleSurfaceDestroyed() {
          cancelSurfaceAttachRetry()
          detachSurface()
          emitVlcDebugEvent("subtitleSurfaceDestroyed")
        }
      }
    )

    surfaceLayer.install()
    surfaceView = surfaceLayer.videoSurfaceView
    subtitleSurfaceView = surfaceLayer.subtitleSurfaceView
    reactRootView = surfaceLayer.reactRootView

    // Capture initial container size.
    val content = findViewById<ViewGroup>(android.R.id.content)
    content?.post {
      containerW = content.width
      containerH = content.height
      applyResizeTransform()
    }
  }

  private fun setReactOverlayVisible(visible: Boolean, reason: String) {
    if (!::surfaceLayer.isInitialized) return
    val changed = surfaceLayer.setReactOverlayVisible(visible)
    if (!changed) return

    emitVlcDebugEvent(
      "setReactOverlayVisible",
      mapOf(
        "overlayVisible" to visible,
        "overlayReason" to reason
      )
    )
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
    } catch (t: Exception) {
      Log.w(TAG, "startService failed", t)
    }

    bound = try {
      bindService(serviceIntent, connection, Context.BIND_AUTO_CREATE)
    } catch (t: Exception) {
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
        lastAppliedVlcSurfaceW = -1
        lastAppliedVlcSurfaceH = -1
        emitVlcDebugEvent("vlcServiceConnected")
        ensureSurfaceAttached("vlcServiceConnected")

        applyPendingLoadIfReady()
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
      emitVlcDebugEvent("serviceDisconnected")
      vlcService = null
      exoService = null
      lastAppliedVlcSurfaceW = -1
      lastAppliedVlcSurfaceH = -1
    }
  }

  private fun updateVideoSize(width: Int, height: Int) {
    if (width <= 0 || height <= 0) return
    if (videoW == width && videoH == height) return

    videoW = width
    videoH = height
    emitVlcDebugEvent(
      "updateVideoSize",
      mapOf(
        "reportedVideoWidth" to width,
        "reportedVideoHeight" to height
      )
    )
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
    val subtitleHolder = subtitleSurfaceView?.holder
    if (holder.isCreating) return false
    if (subtitleHolder == null) return false
    if (subtitleHolder.isCreating) return false

    if (engine == ENGINE_VLC) {
      val svc = vlcService ?: return false
      val surface = holder.surface
      if (surface == null || !surface.isValid) return false

      val subtitleSurface = subtitleHolder.surface
      if (subtitleSurface == null || !subtitleSurface.isValid) return false

      val frame = holder.surfaceFrame
      val layoutParams = sv.layoutParams
      val layoutW = layoutParams?.width ?: 0
      val layoutH = layoutParams?.height ?: 0
      val frameW = frame.width()
      val frameH = frame.height()
      val w = maxOf(layoutW, sv.width, frameW).takeIf { it > 0 } ?: 1920
      val h = maxOf(layoutH, sv.height, frameH).takeIf { it > 0 } ?: 1080

      return try {
        svc.attachSurfaces(holder, subtitleHolder, w, h)
        lastAppliedVlcSurfaceW = -1
        lastAppliedVlcSurfaceH = -1
        emitVlcDebugEvent(
          "attachSurfacesIfReady:$reason",
          mapOf(
            "attachWidth" to w,
            "attachHeight" to h,
            "attachLayoutWidth" to layoutW,
            "attachLayoutHeight" to layoutH,
            "attachFrameWidth" to frameW,
            "attachFrameHeight" to frameH,
            "subtitleAttached" to true
          )
        )
        true
      } catch (t: Exception) {
        Log.w(TAG, "Failed to attach VLC surfaces reason=$reason", t)
        emitVlcDebugEvent(
          "attachSurfacesFailed:$reason",
          mapOf(
            "attachWidth" to w,
            "attachHeight" to h,
            "attachLayoutWidth" to layoutW,
            "attachLayoutHeight" to layoutH,
            "attachFrameWidth" to frameW,
            "attachFrameHeight" to frameH,
            "subtitleAttached" to true,
            "error" to (t.message ?: "unknown")
          )
        )
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
    } catch (t: Exception) {
      Log.w(TAG, "Failed to attach Exo surface view reason=$reason", t)
      false
    }
  }

  private fun detachSurface() {
    if (engine == ENGINE_VLC) {
      bestEffort("vlcService.detachSurface") {
        vlcService?.detachSurface()
      }
      lastAppliedVlcSurfaceW = -1
      lastAppliedVlcSurfaceH = -1
      return
    }

    val sv = surfaceView ?: return
    val player = exoService?.getPlayer() ?: return
    bestEffort("exoPlayer.clearVideoSurfaceView") {
      player.clearVideoSurfaceView(sv)
    }
  }

  private fun ensureSurfaceAttached(reason: String, resetRetries: Boolean = true) {
    if (isFinishing || isDestroyedCompat()) return
    if (resetRetries) {
      surfaceAttachRetryCount = 0
    }

    if (attachSurfaceIfReady(reason)) {
      cancelSurfaceAttachRetry()

      val content = findViewById<ViewGroup>(android.R.id.content)
      if (content != null) {
        containerW = content.width
        containerH = content.height
      }
      applyResizeTransform()
      updatePipParams()

      emitVlcDebugEvent("ensureSurfaceAttached:success", mapOf("attachReason" to reason))
      return
    }

    if (surfaceAttachRetryCount >= MAX_SURFACE_ATTACH_RETRIES) {
      Log.e(TAG, "Surface did not attach after retries; reason=$reason engine=$engine")
      emitVlcDebugEvent("ensureSurfaceAttached:max-retries", mapOf("attachReason" to reason))
      return
    }

    emitVlcDebugEvent("ensureSurfaceAttached:retry", mapOf("attachReason" to reason))
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
      setReactOverlayVisible(false, "onUserLeaveHint")
      try {
        val entered = enterPictureInPictureMode(buildPipParams())
        if (entered) {
          // Some devices are slow to call onPictureInPictureModeChanged; emit immediately so JS can react.
          emit("onPipModeChanged", true)
        } else {
          setReactOverlayVisible(true, "enterPiP-returned-false")
        }
      } catch (t: Exception) {
        Log.w(TAG, "enterPiP failed", t)
        setReactOverlayVisible(true, "enterPiP-exception")
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

    val previousContainerW = containerW
    val previousContainerH = containerH

    emit("onPipModeChanged", isInPictureInPictureMode)

    setReactOverlayVisible(!isInPictureInPictureMode, "onPictureInPictureModeChanged")

    // Recompute transforms for the new window bounds (PiP window can be much smaller).
    val content = findViewById<ViewGroup>(android.R.id.content)
    if (content != null) {
      containerW = content.width
      containerH = content.height
    }
    applyResizeTransform()

    val was = wasInPip
    wasInPip = isInPictureInPictureMode

    if (!isInPictureInPictureMode && was && activityStopped) {
      // Treat as dismissal (swipe away).
      setPausedFromJs(true)
      emit("onPipDismissed", null)
      finish()
      return
    }

    if (isInPictureInPictureMode) {
      awaitingExitPipRelayout = false
    }

    if (!isInPictureInPictureMode && was) {
      ensureSurfaceAttached("exitPiP")

      val containerChanged =
        containerW > 0 && containerH > 0 &&
          (containerW != previousContainerW || containerH != previousContainerH)

      if (containerChanged) {
        awaitingExitPipRelayout = false
      } else {
        awaitingExitPipRelayout = true
        exitPipContainerW = containerW
        exitPipContainerH = containerH
      }
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
    bestEffort("stopPlaybackAndFinish.stopPlayback") {
      if (engine == ENGINE_VLC) {
        vlcService?.stopPlayback()
      } else {
        exoService?.stopPlayback()
      }
    }
    
    // Also send stop intent to the service as a backup
    bestEffort("stopPlaybackAndFinish.startService(ACTION_STOP)") {
      if (engine == ENGINE_VLC) {
        startService(Intent(this, VlcPlaybackService::class.java).setAction(VlcPlaybackService.ACTION_STOP))
      } else {
        startService(Intent(this, ExoPlaybackService::class.java).setAction(ExoPlaybackService.ACTION_STOP))
      }
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
      bestEffort("onDestroy.stopPlayback") {
        if (engine == ENGINE_VLC) {
          vlcService?.stopPlayback()
        } else {
          exoService?.stopPlayback()
        }
      }

      bestEffort("onDestroy.startService(ACTION_STOP)") {
        if (engine == ENGINE_VLC) {
          startService(Intent(this, VlcPlaybackService::class.java).setAction(VlcPlaybackService.ACTION_STOP))
        } else {
          startService(Intent(this, ExoPlaybackService::class.java).setAction(ExoPlaybackService.ACTION_STOP))
        }
      }
    }

    bestEffort("onDestroy.removeListener+unregister") {
      if (engine == ENGINE_VLC) {
        vlcService?.removeListener(vlcListener)
        vlcService?.unregisterClient()
      } else {
        exoService?.removeListener(exoListener)
        exoService?.unregisterClient()
      }
    }

    detachSurface()

    if (bound) {
      bestEffort("onDestroy.unbindService") { unbindService(connection) }
      bound = false
    }

    vlcService = null
    exoService = null
    surfaceView = null
    subtitleSurfaceView = null
    reactRootView = null

    if (::surfaceLayer.isInitialized) {
      bestEffort("onDestroy.surfaceLayer.dispose") { surfaceLayer.dispose() }
    }

    cancelSurfaceAttachRetry()

    if (::reactEmitter.isInitialized) {
      bestEffort("onDestroy.reactEmitter.destroy") { reactEmitter.destroy() }
    }

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
    emitVlcDebugEvent("setResizeModeFromJs", mapOf("requestedMode" to (mode ?: "null")))
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
    return pipParamsHelper.buildParams(surfaceView, videoW, videoH, isPlaying)
  }

  private fun updatePipParams() {
    pipParamsHelper.updateParams(this, surfaceView, videoW, videoH, isPlaying)
  }

  private fun applyResizeTransform() {
    val result = surfaceResizer.apply(
      surfaceView,
      subtitleSurfaceView,
      containerW,
      containerH,
      videoW,
      videoH,
      resizeMode
    )

    if (result.status != PlayerSurfaceResizer.Status.SKIPPED_NOT_READY) {
      syncVlcSurfaceSizeIfNeeded(result.targetW, result.targetH)
    }

    when (result.status) {
      PlayerSurfaceResizer.Status.SKIPPED_NOT_READY -> {
        emitVlcDebugEvent("applyResizeTransform:skipped-not-ready")
      }

      PlayerSurfaceResizer.Status.APPLIED -> {
        emitVlcDebugEvent(
          "applyResizeTransform:applied",
          mapOf(
            "targetWidth" to result.targetW,
            "targetHeight" to result.targetH,
            "videoRatio" to result.videoRatio,
            "containerRatio" to result.containerRatio,
            "changed" to true
          )
        )
      }

      PlayerSurfaceResizer.Status.NO_OP -> {
        emitVlcDebugEvent(
          "applyResizeTransform:no-op",
          mapOf(
            "targetWidth" to result.targetW,
            "targetHeight" to result.targetH,
            "videoRatio" to result.videoRatio,
            "containerRatio" to result.containerRatio,
            "changed" to false
          )
        )
      }
    }
  }

  private fun syncVlcSurfaceSizeIfNeeded(width: Int, height: Int) {
    if (engine != ENGINE_VLC) return
    if (width <= 0 || height <= 0) return
    val svc = vlcService ?: return

    if (lastAppliedVlcSurfaceW == width && lastAppliedVlcSurfaceH == height) {
      return
    }

    svc.setSurfaceSize(width, height)
    lastAppliedVlcSurfaceW = width
    lastAppliedVlcSurfaceH = height
  }

  private fun emitVlcDebugEvent(reason: String, extras: Map<String, Any> = emptyMap()) {
    if (engine != ENGINE_VLC) return

    val sv = surfaceView
    val holder = sv?.holder
    val surfaceFrame = holder?.surfaceFrame

    val subtitleSv = subtitleSurfaceView
    val subtitleHolder = subtitleSv?.holder
    val subtitleSurfaceFrame = subtitleHolder?.surfaceFrame

    val snapshot = HashMap<String, Any>()
    snapshot["reason"] = reason
    snapshot["resizeMode"] = (resizeMode ?: "contain").lowercase()
    snapshot["containerWidth"] = containerW
    snapshot["containerHeight"] = containerH
    snapshot["inPipMode"] = isInPictureInPictureMode
    snapshot["overlayVisible"] = (reactRootView?.visibility ?: View.VISIBLE) == View.VISIBLE
    snapshot["videoWidth"] = videoW
    snapshot["videoHeight"] = videoH
    snapshot["surfaceViewWidth"] = sv?.width ?: 0
    snapshot["surfaceViewHeight"] = sv?.height ?: 0
    snapshot["holderFrameWidth"] = surfaceFrame?.width() ?: 0
    snapshot["holderFrameHeight"] = surfaceFrame?.height() ?: 0
    snapshot["subtitleSurfaceViewWidth"] = subtitleSv?.width ?: 0
    snapshot["subtitleSurfaceViewHeight"] = subtitleSv?.height ?: 0
    snapshot["subtitleHolderFrameWidth"] = subtitleSurfaceFrame?.width() ?: 0
    snapshot["subtitleHolderFrameHeight"] = subtitleSurfaceFrame?.height() ?: 0
    snapshot["surfaceValid"] = try {
      holder?.surface?.isValid ?: false
    } catch (_: Exception) {
      false
    }
    snapshot["subtitleSurfaceValid"] = try {
      subtitleHolder?.surface?.isValid ?: false
    } catch (_: Exception) {
      false
    }
    snapshot["isPlaying"] = isPlaying
    snapshot["surfaceAttachRetryCount"] = surfaceAttachRetryCount

    for ((key, value) in extras.entries) {
      snapshot[key] = value
    }

    val serviceSnapshot = try {
      vlcService?.getDebugSnapshot()
    } catch (_: Exception) {
      null
    }
    if (serviceSnapshot != null) {
      snapshot["vlcEngine"] = serviceSnapshot
    }

    emitNativePlayerEvent("vlc-debug", mapOf("snapshot" to snapshot))

    Log.i(
      TAG,
      "vlc-debug reason=$reason mode=${snapshot["resizeMode"]} container=${containerW}x${containerH} video=${videoW}x${videoH} view=${sv?.width ?: 0}x${sv?.height ?: 0} holder=${surfaceFrame?.width() ?: 0}x${surfaceFrame?.height() ?: 0}"
    )
  }

  private fun maybeFallbackToVlcFromExo(exoError: String): Boolean {
    if (engine != ENGINE_EXO) return false
    if (exoFallbackToVlcAttempted) return false

    if (url.isNullOrBlank()) return false

    exoFallbackToVlcAttempted = true
    Log.w(TAG, "Falling back to VLC (session=$sessionId) due to Exo error: $exoError")

    // Prevent any pending surface attach retries from racing the engine switch.
    cancelSurfaceAttachRetry()

    // Stop Exo playback best-effort.
    var stoppedViaBinder = false
    bestEffort("exoFallback.exoService.stopPlayback") {
      val svc = exoService ?: return@bestEffort
      svc.stopPlayback()
      stoppedViaBinder = true
    }
    if (!stoppedViaBinder) {
      bestEffort("exoFallback.startService(ACTION_STOP_EXO)") {
        startService(Intent(this, ExoPlaybackService::class.java).setAction(ExoPlaybackService.ACTION_STOP))
      }
    }

    bestEffort("exoFallback.exoService.removeListener+unregister") {
      exoService?.removeListener(exoListener)
      exoService?.unregisterClient()
    }

    // Detach Exo from the SurfaceView before switching engines.
    bestEffort("exoFallback.detachSurface") { detachSurface() }

    if (bound) {
      bestEffort("exoFallback.unbindService") { unbindService(connection) }
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

  private fun emit(eventName: String, payload: Any?) {
    reactEmitter.emit(eventName, payload)
  }

  private fun emitNativePlayerEvent(eventType: String, extras: Map<String, Any>) {
    nativeEventEmitter.emitNativePlayerEvent(eventType, extras)
  }
}
