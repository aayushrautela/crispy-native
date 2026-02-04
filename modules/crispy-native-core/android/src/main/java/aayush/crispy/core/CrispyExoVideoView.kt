package aayush.crispy.core

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
import android.view.ViewGroup
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactContext
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

import aayush.crispy.core.pip.PipController
import aayush.crispy.core.player.ExoEngine
import aayush.crispy.core.player.ExoPlaybackService

/**
 * Exo PlayerView wrapper.
 *
 * This view does not own ExoPlayer lifecycle. The player is owned by [ExoPlaybackService].
 */
class CrispyExoVideoView(
  context: Context,
  private val appContext: AppContext
) : ExpoView(context, appContext), ExoEngine.Listener {

  companion object {
    private const val TAG = "CrispyExoVideoView"
  }

  // --- Events ---
  val onLoad by EventDispatcher<Map<String, Any>>()
  val onProgress by EventDispatcher<Map<String, Any>>()
  val onEnd by EventDispatcher<Unit>()
  val onError by EventDispatcher<Map<String, String>>()
  val onTracksChanged by EventDispatcher<Map<String, Any>>()

  private val playerView = PlayerView(context)

  private var playbackService: ExoPlaybackService? = null
  private var isBound: Boolean = false
  private var isReleased: Boolean = false

  private var pendingSource: String? = null
  private var pendingHeaders: Map<String, String>? = null
  private var pendingPaused: Boolean = true
  private var pendingRate: Double = 1.0
  private var pendingVolume: Double = 1.0
  private var latestMetadata: MediaMetadataState? = null
  private var playInBackground: Boolean = false
  private var requestedResizeMode: String? = null

  private var resumeOnForeground: Boolean = false
  private var lastWasInPipMode: Boolean = false

  private val serviceConnection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
      val binder = service as? ExoPlaybackService.LocalBinder
      val svc = binder?.getService()
      if (svc == null) {
        Log.w(TAG, "Service connected with null binder")
        return
      }

      playbackService = svc
      isBound = true

      svc.registerClient()
      svc.addListener(this@CrispyExoVideoView)

      try {
        playerView.player = svc.getPlayer()
      } catch (t: Throwable) {
        Log.w(TAG, "Failed to bind PlayerView to player", t)
      }

      applyAllStateToService(svc)
    }

    override fun onServiceDisconnected(name: ComponentName?) {
      playbackService = null
      isBound = false
      try {
        playerView.player = null
      } catch (_: Throwable) {
        // ignore
      }
    }
  }

  private val lifecycleListener = object : LifecycleEventListener {
    override fun onHostPause() {
      if (PipController.isInPiPMode()) return
      if (playInBackground) return

      resumeOnForeground = !pendingPaused
      if (resumeOnForeground) {
        setPaused(true)
      }
    }

    override fun onHostResume() {
      if (resumeOnForeground) {
        setPaused(false)
        resumeOnForeground = false
      }

      // Rebind surface after PiP expansion if needed.
      rebindPlayerView("onHostResume")
    }

    override fun onHostDestroy() {
      release()
    }
  }

  init {
    playerView.layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
    playerView.useController = false
    addView(playerView)

    PipController.registerPlayerView(playerView)
    (context as? ReactContext)?.addLifecycleEventListener(lifecycleListener)

    bindPlaybackService()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    PipController.registerPlayerView(playerView)
    rebindPlayerView("onAttachedToWindow")
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    if (isReleased) return

    // If we're actively in PiP, tolerate detaches without tearing down playback.
    if (PipController.isInPiPMode()) return

    release()
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)

    val pipNow = PipController.isInPiPMode()
    if (lastWasInPipMode && !pipNow) {
      // Leaving PiP: force a surface rebind to avoid black video on return.
      playerView.post { rebindPlayerView("exitPiP") }
    }
    lastWasInPipMode = pipNow

    if (changed && !pipNow) {
      // Keep source rect hint current for the next PiP transition.
      PipController.registerPlayerView(playerView)
    }
  }

  // --- Props / commands from JS ---
  fun setPlayInBackground(enabled: Boolean) {
    playInBackground = enabled
  }

  fun setHeaders(headers: Map<String, String>?) {
    pendingHeaders = headers
    playbackService?.setHeaders(headers)
  }

  fun setResizeMode(mode: String?) {
    requestedResizeMode = mode
    applyResizeMode(mode)
  }

  private fun applyResizeMode(mode: String?) {
    playerView.resizeMode = when (mode) {
      "cover" -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
      "stretch" -> AspectRatioFrameLayout.RESIZE_MODE_FILL
      else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
    }
  }

  fun setRate(rate: Double) {
    pendingRate = rate
    playbackService?.setRate(rate)
  }

  fun setVolume(volume: Double) {
    pendingVolume = volume
    playbackService?.setVolume(volume)
  }

  fun setSource(url: String?) {
    if (url.isNullOrBlank()) return
    pendingSource = url
    playbackService?.setSource(url)
  }

  fun setPaused(paused: Boolean) {
    pendingPaused = paused
    playbackService?.setPaused(paused)
  }

  fun seek(positionSec: Double) {
    playbackService?.seek(positionSec)
  }

  fun setMetadata(title: String, artist: String, artworkUrl: String?) {
    val next = MediaMetadataState(title, artist, artworkUrl)
    if (next == latestMetadata) return
    latestMetadata = next
    playbackService?.setMetadata(title, artist, artworkUrl)
  }

  fun setAudioTrack(trackId: Int) {
    playbackService?.setAudioTrack(trackId)
  }

  fun setSubtitleTrack(trackId: Int) {
    playbackService?.setSubtitleTrack(trackId)
  }

  // --- ExoEngine.Listener ---
  override fun onLoad(duration: Double, width: Int, height: Int) {
    onLoad(mapOf("duration" to duration, "width" to width, "height" to height))
  }

  override fun onProgress(currentTime: Double, duration: Double) {
    onProgress(mapOf("currentTime" to currentTime, "duration" to duration))
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
    val intent = Intent(appCtx, ExoPlaybackService::class.java)
    try {
      appCtx.startService(intent)
    } catch (_: Throwable) {
      // Best-effort
    }
    try {
      appCtx.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    } catch (t: Throwable) {
      Log.e(TAG, "bindService failed", t)
    }
  }

  private fun applyAllStateToService(service: ExoPlaybackService) {
    service.setHeaders(pendingHeaders)
    service.setRate(pendingRate)
    service.setVolume(pendingVolume)
    service.setPaused(pendingPaused)

    val md = latestMetadata
    if (md != null) {
      service.setMetadata(md.title, md.artist, md.artworkUrl)
    }

    pendingSource?.let { service.setSource(it) }
  }

  private fun rebindPlayerView(reason: String) {
    if (isReleased) return
    val svc = playbackService ?: return
    try {
      // Toggling the binding forces Media3 to recreate/reattach the video surface.
      val player = svc.getPlayer()
      playerView.player = null
      playerView.player = player
    } catch (t: Throwable) {
      Log.w(TAG, "Failed to rebind PlayerView reason=$reason", t)
    }
  }

  private fun release() {
    if (isReleased) return
    isReleased = true

    (context as? ReactContext)?.removeLifecycleEventListener(lifecycleListener)
    PipController.unregisterPlayerView(playerView)

    val appCtx = context.applicationContext
    val svc = playbackService
    if (svc != null) {
      try { svc.removeListener(this) } catch (_: Throwable) {}
      try { svc.unregisterClient() } catch (_: Throwable) {}
    }

    try {
      playerView.player = null
    } catch (_: Throwable) {
      // ignore
    }

    if (isBound) {
      try { appCtx.unbindService(serviceConnection) } catch (_: Throwable) {}
    }

    playbackService = null
    isBound = false
  }
}
