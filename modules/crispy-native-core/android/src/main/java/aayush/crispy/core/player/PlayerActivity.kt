package aayush.crispy.core.player

import android.app.PictureInPictureParams
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.ActivityInfo
import android.graphics.Matrix
import android.graphics.Color
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.SystemClock
import android.util.Log
import android.util.Rational
import android.view.Surface
import android.view.TextureView
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference
import java.util.HashMap
import kotlin.math.roundToInt

/**
 * Native-first player host for Android:
 * - TextureView-backed surface owned by an Activity (smooth PiP resize)
 * - React UI overlay mounted as a normal RN root (same JS runtime)
 * - Playback engines remain Service-owned (MpvPlaybackService / ExoPlaybackService)
 */
class PlayerActivity : ReactActivity() {
  companion object {
    const val EXTRA_SESSION_ID = "crispy.player.sessionId"
    const val EXTRA_URL = "crispy.player.url"
    const val EXTRA_HEADERS = "crispy.player.headers"
    const val EXTRA_ENGINE = "crispy.player.engine" // "exoplayer" | "mpv"
    const val EXTRA_PAUSED = "crispy.player.paused"
    const val EXTRA_TITLE = "crispy.player.title"
    const val EXTRA_ARTIST = "crispy.player.artist"
    const val EXTRA_ARTWORK_URL = "crispy.player.artworkUrl"

    const val ENGINE_EXO = "exoplayer"
    const val ENGINE_MPV = "mpv"

    private const val TAG = "PlayerActivity"
    private const val MAX_ASPECT = 2.39
    private const val MIN_ASPECT = 1.0 / MAX_ASPECT

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

  private var textureView: TextureView? = null
  private var mpvSurface: Surface? = null
  private var surfaceW: Int = 0
  private var surfaceH: Int = 0

  private var mpvService: MpvPlaybackService? = null
  private var exoService: ExoPlaybackService? = null
  private var bound: Boolean = false

  private var videoW: Int = 0
  private var videoH: Int = 0
  private var isPlaying: Boolean = false

  private var resizeMode: String? = null

  private var lastProgressEmitMs: Long = 0L

  private var wasInPip: Boolean = false
  private var activityStopped: Boolean = false

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

    installTextureBehindReact()
    bindPlaybackService()
    updatePipParams()
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
      ENGINE_MPV -> ENGINE_MPV
      ENGINE_EXO -> ENGINE_EXO
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
    val reactRoot = content.getChildAt(0)
    try {
      reactRoot?.setBackgroundColor(Color.TRANSPARENT)
    } catch (_: Throwable) {
      // ignore
    }

    val tv = TextureView(this)
    tv.layoutParams = FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
    tv.surfaceTextureListener = surfaceListener
    textureView = tv
    content.addView(tv, 0)
  }

  private val surfaceListener = object : TextureView.SurfaceTextureListener {
    override fun onSurfaceTextureAvailable(surfaceTexture: android.graphics.SurfaceTexture, width: Int, height: Int) {
      surfaceW = width
      surfaceH = height
      attachSurfaceIfReady()
      applyResizeTransform()
      updatePipParams()
    }

    override fun onSurfaceTextureSizeChanged(surfaceTexture: android.graphics.SurfaceTexture, width: Int, height: Int) {
      surfaceW = width
      surfaceH = height
      if (engine == ENGINE_MPV) {
        mpvService?.setSurfaceSize(width, height)
      }
      applyResizeTransform()
      updatePipParams()
    }

    override fun onSurfaceTextureDestroyed(surfaceTexture: android.graphics.SurfaceTexture): Boolean {
      detachSurface()
      return true
    }

    override fun onSurfaceTextureUpdated(surfaceTexture: android.graphics.SurfaceTexture) {
      // no-op
    }
  }

  private fun bindPlaybackService() {
    if (bound) return

    val serviceIntent = if (engine == ENGINE_MPV) {
      Intent(this, MpvPlaybackService::class.java)
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
      if (engine == ENGINE_MPV) {
        val binder = service as MpvPlaybackService.LocalBinder
        mpvService = binder.getService()
        mpvService?.registerClient()
        mpvService?.addListener(mpvListener)

        applyPendingLoadIfReady()
        attachSurfaceIfReady()
        updatePipParams()
        return
      }

      val binder = service as ExoPlaybackService.LocalBinder
      exoService = binder.getService()
      exoService?.registerClient()
      exoService?.addListener(exoListener)

      applyPendingLoadIfReady()
      attachSurfaceIfReady()
      updatePipParams()
    }

    override fun onServiceDisconnected(name: android.content.ComponentName) {
      mpvService = null
      exoService = null
    }
  }

  private val mpvListener = object : MpvEngine.Listener {
    override fun onLoad(duration: Double, width: Int, height: Int) {
      if (width > 0 && height > 0) {
        videoW = width
        videoH = height
        applyResizeTransform()
        updatePipParams()
      }

      emitNativePlayerEvent(
        "load",
        mapOf(
          "duration" to duration,
          "width" to width,
          "height" to height
        )
      )
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
      Log.w(TAG, "MPV error: $error")
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
      if (width > 0 && height > 0) {
        videoW = width
        videoH = height
        applyResizeTransform()
        updatePipParams()
      }

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

    if (engine == ENGINE_MPV) {
      val svc = mpvService ?: return
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

  private fun attachSurfaceIfReady() {
    val tv = textureView ?: return
    if (!tv.isAvailable) return

    if (engine == ENGINE_MPV) {
      val st = tv.surfaceTexture ?: return
      val surface = mpvSurface ?: Surface(st).also { mpvSurface = it }
      val w = if (surfaceW > 0) surfaceW else tv.width
      val h = if (surfaceH > 0) surfaceH else tv.height
      mpvService?.attachSurface(surface, w, h)
      mpvService?.setSurfaceSize(w, h)
      return
    }

    val player = exoService?.getPlayer() ?: return
    try {
      player.setVideoTextureView(tv)
    } catch (t: Throwable) {
      Log.w(TAG, "Failed to attach Exo texture view", t)
    }
  }

  private fun detachSurface() {
    if (engine == ENGINE_MPV) {
      try {
        mpvService?.detachSurface()
      } catch (_: Throwable) {
        // ignore
      }
      try {
        mpvSurface?.release()
      } catch (_: Throwable) {
        // ignore
      }
      mpvSurface = null
      return
    }

    val tv = textureView ?: return
    val player = exoService?.getPlayer() ?: return
    try {
      player.clearVideoTextureView(tv)
    } catch (_: Throwable) {
      // ignore
    }
  }

  fun setPausedFromJs(paused: Boolean) {
    startPaused = paused
    isPlaying = !paused
    if (engine == ENGINE_MPV) mpvService?.setPaused(paused) else exoService?.setPaused(paused)
    updatePipParams()
  }

  fun seekFromJs(positionSec: Double) {
    if (engine == ENGINE_MPV) mpvService?.seek(positionSec) else exoService?.seek(positionSec)
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
    }
  }

  override fun onBackPressed() {
    stopPlaybackAndFinish()
  }

  private fun stopPlaybackAndFinish() {
    try {
      if (engine == ENGINE_MPV) {
        startService(Intent(this, MpvPlaybackService::class.java).setAction(MpvPlaybackService.ACTION_STOP))
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

    try {
      if (engine == ENGINE_MPV) {
        mpvService?.removeListener(mpvListener)
        mpvService?.unregisterClient()
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

    mpvService = null
    exoService = null
    textureView = null

    val active = activeRef?.get()
    if (active === this) {
      activeRef = null
    }

    super.onDestroy()
  }

  fun setRateFromJs(rate: Double) {
    if (engine == ENGINE_MPV) mpvService?.setRate(rate) else exoService?.setRate(rate)
  }

  fun setVolumeFromJs(volume: Double) {
    if (engine == ENGINE_MPV) mpvService?.setVolume(volume) else exoService?.setVolume(volume)
  }

  fun setResizeModeFromJs(mode: String?) {
    resizeMode = mode
    try {
      // Keep mpv in sync for non-Activity view usage patterns.
      if (engine == ENGINE_MPV) mpvService?.setResizeMode(mode)
    } catch (_: Throwable) {
      // ignore
    }
    applyResizeTransform()
    updatePipParams()
  }

  fun setAudioTrackFromJs(trackId: Int) {
    if (engine == ENGINE_MPV) mpvService?.setAudioTrack(trackId) else exoService?.setAudioTrack(trackId)
  }

  fun setSubtitleTrackFromJs(trackId: Int) {
    if (engine == ENGINE_MPV) mpvService?.setSubtitleTrack(trackId) else exoService?.setSubtitleTrack(trackId)
  }

  fun setSubtitleDelayFromJs(delaySec: Double) {
    if (engine == ENGINE_MPV) mpvService?.setSubtitleDelay(delaySec)
  }

  fun setSubtitleSizeFromJs(size: Int) {
    if (engine == ENGINE_MPV) mpvService?.setSubtitleSize(size)
  }

  fun setSubtitleColorFromJs(color: String) {
    if (engine == ENGINE_MPV) mpvService?.setSubtitleColor(color)
  }

  fun setSubtitleBackgroundColorFromJs(color: String, opacity: Float) {
    if (engine == ENGINE_MPV) mpvService?.setSubtitleBackgroundColor(color, opacity)
  }

  fun setSubtitleBorderSizeFromJs(size: Int) {
    if (engine == ENGINE_MPV) mpvService?.setSubtitleBorderSize(size)
  }

  fun setSubtitleBorderColorFromJs(color: String) {
    if (engine == ENGINE_MPV) mpvService?.setSubtitleBorderColor(color)
  }

  fun setSubtitlePositionFromJs(pos: Int) {
    if (engine == ENGINE_MPV) mpvService?.setSubtitlePosition(pos)
  }

  fun setSubtitleBoldFromJs(bold: Boolean) {
    if (engine == ENGINE_MPV) mpvService?.setSubtitleBold(bold)
  }

  fun setSubtitleItalicFromJs(italic: Boolean) {
    if (engine == ENGINE_MPV) mpvService?.setSubtitleItalic(italic)
  }

  fun setDecoderModeFromJs(mode: String?) {
    if (engine == ENGINE_MPV) mpvService?.setDecoderMode(mode)
  }

  fun setGpuModeFromJs(mode: String?) {
    if (engine == ENGINE_MPV) mpvService?.setGpuMode(mode)
  }

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
      setSeamlessResizeEnabledCompat(builder, true)
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
    val tv = textureView ?: return
    if (!tv.isAvailable) return

    val viewW = if (surfaceW > 0) surfaceW else tv.width
    val viewH = if (surfaceH > 0) surfaceH else tv.height
    if (viewW <= 0 || viewH <= 0 || videoW <= 0 || videoH <= 0) {
      try {
        tv.setTransform(null)
      } catch (_: Throwable) {
        // ignore
      }
      return
    }

    val mode = (resizeMode ?: "contain").lowercase()
    val m = Matrix()

    val vw = viewW.toFloat()
    val vh = viewH.toFloat()
    val vidW = videoW.toFloat()
    val vidH = videoH.toFloat()

    if (mode == "stretch") {
      val sx = vw / vidW
      val sy = vh / vidH
      m.setScale(sx, sy)
    } else {
      val sx = vw / vidW
      val sy = vh / vidH
      val scale = if (mode == "cover") kotlin.math.max(sx, sy) else kotlin.math.min(sx, sy)
      val scaledW = vidW * scale
      val scaledH = vidH * scale
      val dx = (vw - scaledW) / 2f
      val dy = (vh - scaledH) / 2f
      m.setScale(scale, scale)
      m.postTranslate(dx, dy)
    }

    try {
      tv.setTransform(m)
      tv.invalidate()
    } catch (_: Throwable) {
      // ignore
    }
  }

  private fun computeSourceRectHint(): Rect? {
    val tv = textureView ?: return null
    if (!tv.isAttachedToWindow) return null
    val out = Rect()
    val ok = try {
      tv.getGlobalVisibleRect(out)
    } catch (_: Throwable) {
      false
    }
    if (!ok) return null

    // Letterbox-aware hint when in "contain".
    if (videoW <= 0 || videoH <= 0) return out
    val mode = (resizeMode ?: "contain").lowercase()
    if (mode != "contain") return out

    val viewW = out.width()
    val viewH = out.height()
    if (viewW <= 0 || viewH <= 0) return out

    val sx = viewW.toFloat() / videoW.toFloat()
    val sy = viewH.toFloat() / videoH.toFloat()
    val scale = kotlin.math.min(sx, sy)
    val contentW = (videoW.toFloat() * scale).roundToInt().coerceAtLeast(1)
    val contentH = (videoH.toFloat() * scale).roundToInt().coerceAtLeast(1)
    val left = out.left + ((viewW - contentW) / 2)
    val top = out.top + ((viewH - contentH) / 2)
    return Rect(left, top, left + contentW, top + contentH)
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
    val app = application as? ReactApplication ?: return null
    return app.reactNativeHost.reactInstanceManager.currentReactContext
  }

  private fun emit(eventName: String, payload: Any?) {
    val rc = getReactContextUnsafe() ?: return
    try {
      rc
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, payload)
    } catch (_: Throwable) {
      // ignore
    }
  }

  private fun emitNativePlayerEvent(eventType: String, extras: Map<String, Any>) {
    val rc = getReactContextUnsafe() ?: return

    val payload = HashMap<String, Any>()
    payload["sessionId"] = sessionId
    payload["engine"] = engine
    payload["type"] = eventType
    for ((k, v) in extras.entries) {
      payload[k] = v
    }

    try {
      val map = Arguments.makeNativeMap(payload as Map<String, Any>)
      rc
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("nativePlayerEvent", map)
    } catch (_: Throwable) {
      // ignore
    }
  }
}
