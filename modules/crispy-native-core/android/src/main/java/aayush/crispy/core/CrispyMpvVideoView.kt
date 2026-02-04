package aayush.crispy.core

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
import android.view.Surface
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.ViewGroup
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactContext
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import aayush.crispy.core.pip.PipController
import aayush.crispy.core.player.MpvEngine
import aayush.crispy.core.player.MpvPlaybackService

/**
 * SurfaceView-based MPV renderer.
 *
 * This view is intentionally "dumb": it does not own MPVLib lifecycle.
 * All playback state lives inside [MpvPlaybackService].
 */
class CrispyMpvVideoView(
  context: Context,
  private val appContext: AppContext
) : ExpoView(context, appContext), SurfaceHolder.Callback, MpvEngine.Listener {

  companion object {
    private const val TAG = "CrispyMpvVideoView"
  }

  // --- Events ---
  val onLoad by EventDispatcher<Map<String, Any>>()
  val onProgress by EventDispatcher<Map<String, Any>>()
  val onEnd by EventDispatcher<Unit>()
  val onError by EventDispatcher<Map<String, String>>()
  val onTracksChanged by EventDispatcher<Map<String, Any>>()

  // --- Surface ---
  private val surfaceView: SurfaceView = SurfaceView(context)
  private var lastSurface: Surface? = null
  private var lastSurfaceW: Int = 0
  private var lastSurfaceH: Int = 0

  private var lastLayoutW: Int = 0
  private var lastLayoutH: Int = 0
  private var lastWasInPipMode: Boolean = false

  // --- Service binding ---
  private var playbackService: MpvPlaybackService? = null
  private var isBound: Boolean = false
  private var isReleased: Boolean = false

  private val serviceConnection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
      val binder = service as? MpvPlaybackService.LocalBinder
      val svc = binder?.getService()
      if (svc == null) {
        Log.w(TAG, "Service connected with null binder")
        return
      }

      playbackService = svc
      isBound = true

      svc.registerClient()

      // Register listener first to get immediate snapshot events.
      svc.addListener(this@CrispyMpvVideoView)

      // Apply the latest props/state.
      applyAllStateToService(svc)

      // Attach surface if it already exists.
      val surface = lastSurface
      if (surface != null) {
        svc.attachSurface(surface, lastSurfaceW, lastSurfaceH)
      }
    }

    override fun onServiceDisconnected(name: ComponentName?) {
      playbackService = null
      isBound = false
    }
  }

  // --- Props/state from JS ---
  private var pendingSource: String? = null
  private var pendingHeaders: Map<String, String>? = null
  private var pendingPaused: Boolean = true
  private var requestedResizeMode: String? = null
  private var playInBackground: Boolean = false

  var decoderMode: String = "auto"
    set(value) {
      field = value
      playbackService?.setDecoderMode(value)
    }

  var gpuMode: String = "gpu"
    set(value) {
      field = value
      playbackService?.setGpuMode(value)
    }

  private var latestTitle: String = ""
  private var latestArtist: String = ""
  private var latestArtworkUrl: String? = null

  // Background pause/resume behavior (mirrors old behavior, but delegates to the service).
  private var resumeOnForeground: Boolean = false
  private val lifecycleListener = object : LifecycleEventListener {
    override fun onHostResume() {
      if (resumeOnForeground) {
        resumeOnForeground = false
        setPaused(false)
      }

      // Some OEMs do not re-trigger surface callbacks on PiP expand; re-attach if needed.
      val svc = playbackService
      val surface = lastSurface
      if (svc != null && surface != null) {
        svc.attachSurface(surface, lastSurfaceW, lastSurfaceH)
      }
    }

    override fun onHostPause() {
      if (PipController.isInPiPMode()) return
      if (playInBackground) return

      // Only pause if we were actively playing.
      if (!pendingPaused) {
        resumeOnForeground = true
        setPaused(true)
      }
    }

    override fun onHostDestroy() {
      release()
    }
  }

  init {
    surfaceView.layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
    surfaceView.holder.addCallback(this)
    surfaceView.holder.setSizeFromLayout()
    surfaceView.keepScreenOn = true
    addView(surfaceView)

    (context as? ReactContext)?.addLifecycleEventListener(lifecycleListener)
    PipController.registerPlayerView(surfaceView)

    bindPlaybackService()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    PipController.registerPlayerView(surfaceView)
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    if (isReleased) return

    // If we're actively in PiP, tolerate detaches without tearing down playback.
    if (PipController.isInPiPMode()) return

    release()
  }

  override fun surfaceCreated(holder: SurfaceHolder) {
    if (isReleased) return

    val surface = holder.surface
    lastSurface = surface
    lastSurfaceW = width.coerceAtLeast(0)
    lastSurfaceH = height.coerceAtLeast(0)

    playbackService?.attachSurface(surface, lastSurfaceW, lastSurfaceH)
  }

  override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
    if (isReleased) return
    if (width <= 0 || height <= 0) return

    lastSurfaceW = width
    lastSurfaceH = height
    playbackService?.setSurfaceSize(width, height)
  }

  override fun surfaceDestroyed(holder: SurfaceHolder) {
    lastSurface = null
    playbackService?.detachSurface()
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)

    val pipNow = PipController.isInPiPMode()

    // Fallback for OEMs that resize the view without dispatching surfaceChanged promptly.
    val w = width
    val h = height
    if (w > 0 && h > 0 && (w != lastLayoutW || h != lastLayoutH)) {
      lastLayoutW = w
      lastLayoutH = h
      playbackService?.setSurfaceSize(w, h)
    }

    // PiP expand -> fullscreen can skip React lifecycle callbacks on some devices.
    if (lastWasInPipMode && !pipNow) {
      val svc = playbackService
      val surface = lastSurface
      if (svc != null && surface != null) {
        svc.attachSurface(surface, lastSurfaceW, lastSurfaceH)
      }
    }
    lastWasInPipMode = pipNow

    if (changed && !pipNow) {
      PipController.registerPlayerView(surfaceView)
    }
  }

  // --- Public API called from Expo module ---
  fun setSource(url: String?) {
    pendingSource = url
    playbackService?.let { applyAllStateToService(it) }
  }

  fun setHeaders(headers: Map<String, String>?) {
    pendingHeaders = headers
    playbackService?.setHeaders(headers)
  }

  fun setPaused(paused: Boolean) {
    pendingPaused = paused
    playbackService?.setPaused(paused)
  }

  fun setResizeMode(mode: String?) {
    requestedResizeMode = mode
    playbackService?.setResizeMode(mode)
  }

  fun setPlayInBackground(enabled: Boolean) {
    playInBackground = enabled
  }

  fun seek(positionSec: Double) {
    playbackService?.seek(positionSec)
  }

  fun setAudioTrack(trackId: Int) {
    playbackService?.setAudioTrack(trackId)
  }

  fun setSubtitleTrack(trackId: Int) {
    playbackService?.setSubtitleTrack(trackId)
  }

  fun setMetadata(title: String, artist: String, artworkUrl: String?) {
    latestTitle = title
    latestArtist = artist
    latestArtworkUrl = artworkUrl
    playbackService?.setMetadata(title, artist, artworkUrl)
  }

  fun setSubtitleSize(size: Int) {
    playbackService?.setSubtitleSize(size)
  }

  fun setSubtitleColor(color: String) {
    playbackService?.setSubtitleColor(color)
  }

  fun setSubtitleBackgroundColor(color: String, opacity: Float) {
    playbackService?.setSubtitleBackgroundColor(color, opacity)
  }

  fun setSubtitleBorderSize(size: Int) {
    playbackService?.setSubtitleBorderSize(size)
  }

  fun setSubtitleBorderColor(color: String) {
    playbackService?.setSubtitleBorderColor(color)
  }

  fun setSubtitlePosition(pos: Int) {
    playbackService?.setSubtitlePosition(pos)
  }

  fun setSubtitleDelay(delay: Double) {
    playbackService?.setSubtitleDelay(delay)
  }

  fun setSubtitleBold(bold: Boolean) {
    playbackService?.setSubtitleBold(bold)
  }

  fun setSubtitleItalic(italic: Boolean) {
    playbackService?.setSubtitleItalic(italic)
  }

  // --- MpvEngine.Listener ---
  override fun onLoad(duration: Double, width: Int, height: Int) {
    onLoad(mapOf("duration" to duration, "width" to width, "height" to height))
  }

  override fun onProgress(position: Double, duration: Double) {
    onProgress(mapOf("position" to position, "duration" to duration))
  }

  override fun onEnd() {
    onEnd(Unit)
  }

  override fun onError(error: String) {
    onError(mapOf("error" to error))
  }

  override fun onTracksChanged(audioTracks: List<Map<String, Any>>, subtitleTracks: List<Map<String, Any>>) {
    onTracksChanged(mapOf("audioTracks" to audioTracks, "subtitleTracks" to subtitleTracks))
  }

  // --- Internals ---
  private fun bindPlaybackService() {
    val appCtx = context.applicationContext
    val intent = Intent(appCtx, MpvPlaybackService::class.java)

    try {
      appCtx.startService(intent)
    } catch (_: Throwable) {
      // Best-effort; binding is enough for in-app playback.
    }

    try {
      appCtx.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    } catch (t: Throwable) {
      Log.e(TAG, "bindService failed", t)
    }
  }

  private fun applyAllStateToService(service: MpvPlaybackService) {
    service.setDecoderMode(decoderMode)
    service.setGpuMode(gpuMode)
    service.setHeaders(pendingHeaders)
    service.setResizeMode(requestedResizeMode)
    service.setPaused(pendingPaused)
    service.setMetadata(latestTitle, latestArtist, latestArtworkUrl)

    pendingSource?.let { service.setSource(it) }
  }

  private fun release() {
    if (isReleased) return
    isReleased = true

    val reactContext = context as? ReactContext
    reactContext?.removeLifecycleEventListener(lifecycleListener)

    PipController.unregisterPlayerView(surfaceView)

    val appCtx = context.applicationContext
    val svc = playbackService
    if (svc != null) {
      try { svc.removeListener(this) } catch (_: Throwable) {}
      try { svc.detachSurface() } catch (_: Throwable) {}
      try { svc.unregisterClient() } catch (_: Throwable) {}
    }

    if (isBound) {
      try { appCtx.unbindService(serviceConnection) } catch (_: Throwable) {}
    }

    playbackService = null
    isBound = false
  }
}
