package aayush.crispy.core

import android.graphics.Color
import android.graphics.PixelFormat
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.media3.ui.AspectRatioFrameLayout
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactContext

import aayush.crispy.core.pip.PipController
import aayush.crispy.core.player.VlcEngine
import aayush.crispy.core.player.VlcPlaybackService

/**
 * VLC Player View wrapper.
 */
class CrispyVlcVideoView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext), VlcEngine.Listener {

  companion object {
    private const val TAG = "CrispyVlcVideoView"
  }

  // --- Events ---
  val onLoad by EventDispatcher<Map<String, Any>>()
  val onProgress by EventDispatcher<Map<String, Any>>()
  val onEnd by EventDispatcher<Unit>()
  val onError by EventDispatcher<Map<String, String>>()
  val onTracksChanged by EventDispatcher<Map<String, Any>>()

  // Helper surface view for VLC output
  private val surfaceView = SurfaceView(context)
  private val subtitleSurfaceView = SurfaceView(context)
  
  private var videoW: Int = 0
  private var videoH: Int = 0

  private var playbackService: VlcPlaybackService? = null
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

  private val serviceConnection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
      val binder = service as? VlcPlaybackService.LocalBinder
      val svc = binder?.getService()
      if (svc == null) {
        Log.w(TAG, "Service connected with null binder")
        return
      }

      playbackService = svc
      isBound = true

      svc.registerClient()
      svc.addListener(this@CrispyVlcVideoView)
      
      // If surfaces are already ready, attach them
      tryAttachSurfaces(svc, "serviceConnected")

      applyAllStateToService(svc)
    }

    override fun onServiceDisconnected(name: ComponentName?) {
      playbackService = null
      isBound = false
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
      // Re-attach surface if needed? Usually surfaceDestroyed/Created handles this.
    }

    override fun onHostDestroy() {
      release()
    }
  }

  init {
    surfaceView.layoutParams = FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
    surfaceView.holder.addCallback(object : SurfaceHolder.Callback {
        override fun surfaceCreated(holder: SurfaceHolder) {
            Log.i(TAG, "surfaceCreated(video) surface=${surfaceView.width}x${surfaceView.height} subtitle=${subtitleSurfaceView.width}x${subtitleSurfaceView.height} view=${width}x${height} mode=${requestedResizeMode ?: "contain"}")
            tryAttachSurfaces("surfaceCreated(video)")
        }
        override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
            Log.i(TAG, "surfaceChanged(video) format=$format surface=${width}x${height} view=${this@CrispyVlcVideoView.width}x${this@CrispyVlcVideoView.height} video=${videoW}x${videoH} mode=${requestedResizeMode ?: "contain"}")
            playbackService?.setSurfaceSize(width, height)
            tryAttachSurfaces("surfaceChanged(video)")
        }
        override fun surfaceDestroyed(holder: SurfaceHolder) {
            Log.i(TAG, "surfaceDestroyed(video) video=${videoW}x${videoH} mode=${requestedResizeMode ?: "contain"}")
            playbackService?.detachSurface()
        }
    })

    subtitleSurfaceView.layoutParams = FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
    subtitleSurfaceView.setZOrderOnTop(false)
    subtitleSurfaceView.setZOrderMediaOverlay(true)
    try {
      subtitleSurfaceView.holder.setFormat(PixelFormat.TRANSLUCENT)
    } catch (_: Throwable) {
      // ignore
    }
    try {
      subtitleSurfaceView.setBackgroundColor(Color.TRANSPARENT)
    } catch (_: Throwable) {
      // ignore
    }
    subtitleSurfaceView.holder.addCallback(object : SurfaceHolder.Callback {
      override fun surfaceCreated(holder: SurfaceHolder) {
        Log.i(TAG, "surfaceCreated(subtitle) surface=${subtitleSurfaceView.width}x${subtitleSurfaceView.height} view=${width}x${height} mode=${requestedResizeMode ?: "contain"}")
        tryAttachSurfaces("surfaceCreated(subtitle)")
      }

      override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        Log.i(TAG, "surfaceChanged(subtitle) format=$format surface=${width}x${height} view=${this@CrispyVlcVideoView.width}x${this@CrispyVlcVideoView.height} video=${videoW}x${videoH} mode=${requestedResizeMode ?: "contain"}")
        playbackService?.setSurfaceSize(width, height)
        tryAttachSurfaces("surfaceChanged(subtitle)")
      }

      override fun surfaceDestroyed(holder: SurfaceHolder) {
        Log.i(TAG, "surfaceDestroyed(subtitle) video=${videoW}x${videoH} mode=${requestedResizeMode ?: "contain"}")
        playbackService?.detachSurface()
      }
    })
    
    addView(surfaceView)
    addView(subtitleSurfaceView)

    PipController.registerPlayerView(surfaceView)
    (context as? ReactContext)?.addLifecycleEventListener(lifecycleListener)

    bindPlaybackService()
  }
  
  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
      super.onLayout(changed, left, top, right, bottom)
      if (changed) {
          post {
              applyResizeTransform()
          }
      }
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    if (isReleased) return
    if (PipController.isInPiPMode()) return
    release()
  }
  
  // --- Props ---

  fun setSource(url: String?) {
      if (url.isNullOrBlank()) return
      pendingSource = url
      playbackService?.setSource(url)
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
      Log.i(TAG, "setResizeMode mode=${mode ?: "contain"} view=${width}x${height} video=${videoW}x${videoH} surface=${surfaceView.width}x${surfaceView.height}")
      playbackService?.setResizeMode(mode)
      applyResizeTransform()
  }

  fun setPlayInBackground(enabled: Boolean) {
      playInBackground = enabled
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
  
  // Audio/Subtitles
  fun setAudioTrack(trackId: Int) {
      playbackService?.setAudioTrack(trackId)
  }
  
  fun setSubtitleTrack(trackId: Int) {
      playbackService?.setSubtitleTrack(trackId)
  }

  // --- No-ops or Stubs for MPV compatibility ---
  fun setSubtitleSize(size: Int) {}
  fun setSubtitleColor(color: String) {}
  fun setSubtitleBackgroundColor(color: String, opacity: Float) {}
  fun setSubtitleBorderSize(size: Int) {}
  fun setSubtitleBorderColor(color: String) {}
  fun setSubtitlePosition(pos: Int) {}
  fun setSubtitleDelay(delay: Double) { playbackService?.setSubtitleDelay(delay) }
  fun setSubtitleBold(bold: Boolean) {}
  fun setSubtitleItalic(italic: Boolean) {}

  // --- Listener Impl ---
  
  override fun onLoad(duration: Double, width: Int, height: Int) {
      updateVideoSize(width, height)
      onLoad(mapOf("duration" to duration, "width" to width, "height" to height))
  }

  override fun onVideoSizeChanged(width: Int, height: Int) {
      updateVideoSize(width, height)
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
    val intent = Intent(appCtx, VlcPlaybackService::class.java)
    try {
      appCtx.startService(intent)
    } catch (_: Throwable) {}
    try {
      appCtx.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    } catch (t: Throwable) {
      Log.e(TAG, "bindService failed", t)
    }
  }
  
  private fun applyAllStateToService(service: VlcPlaybackService) {
    service.setHeaders(pendingHeaders)
    service.setRate(pendingRate)
    service.setVolume(pendingVolume)
    service.setPaused(pendingPaused)
    service.setAudioTrack(-1) // Reset or keep? Usually we don't auto-set track on bind unless stored.
    service.setResizeMode(requestedResizeMode)

    val md = latestMetadata
    if (md != null) {
      service.setMetadata(md.title, md.artist, md.artworkUrl)
    }

    pendingSource?.let { service.setSource(it) }
  }

  private fun tryAttachSurfaces(reason: String) {
    val svc = playbackService ?: return
    tryAttachSurfaces(svc, reason)
  }

  private fun tryAttachSurfaces(service: VlcPlaybackService, reason: String) {
    val videoHolder = surfaceView.holder
    val subtitleHolder = subtitleSurfaceView.holder

    val videoValid = try {
      videoHolder.surface.isValid
    } catch (_: Throwable) {
      false
    }
    val subtitleValid = try {
      subtitleHolder.surface.isValid
    } catch (_: Throwable) {
      false
    }

    if (!videoValid || !subtitleValid) {
      Log.i(
        TAG,
        "tryAttachSurfaces skipped reason=$reason videoValid=$videoValid subtitleValid=$subtitleValid video=${surfaceView.width}x${surfaceView.height} subtitle=${subtitleSurfaceView.width}x${subtitleSurfaceView.height}"
      )
      return
    }

    val frame = videoHolder.surfaceFrame
    val w = when {
      frame.width() > 0 -> frame.width()
      surfaceView.width > 0 -> surfaceView.width
      width > 0 -> width
      else -> 1920
    }
    val h = when {
      frame.height() > 0 -> frame.height()
      surfaceView.height > 0 -> surfaceView.height
      height > 0 -> height
      else -> 1080
    }

    try {
      service.attachSurfaces(videoHolder, subtitleHolder, w, h)
      Log.i(TAG, "attachSurfaces ok reason=$reason attach=${w}x${h} mode=${requestedResizeMode ?: "contain"}")
    } catch (t: Throwable) {
      Log.w(TAG, "attachSurfaces failed reason=$reason", t)
    }
  }

  private fun release() {
    if (isReleased) return
    isReleased = true
    
    (context as? ReactContext)?.removeLifecycleEventListener(lifecycleListener)
    PipController.unregisterPlayerView(surfaceView)

    val appCtx = context.applicationContext
    val svc = playbackService
    if (svc != null) {
        try { svc.removeListener(this) } catch (_: Throwable) {}
        try { svc.unregisterClient() } catch (_: Throwable) {}
    }
    
    if (isBound) {
        try { appCtx.unbindService(serviceConnection) } catch (_: Throwable) {}
    }
    playbackService = null
    isBound = false
  }

  private fun updateVideoSize(width: Int, height: Int) {
    if (width <= 0 || height <= 0) return
    if (videoW == width && videoH == height) return

    videoW = width
    videoH = height
    Log.i(TAG, "updateVideoSize video=${videoW}x${videoH} view=${this.width}x${this.height} mode=${requestedResizeMode ?: "contain"}")
    applyResizeTransform()
  }

  private fun applyResizeTransform() {
    if (width <= 0 || height <= 0 || videoW <= 0 || videoH <= 0) {
      Log.i(TAG, "applyResizeTransform skipped view=${width}x${height} video=${videoW}x${videoH} mode=${requestedResizeMode ?: "contain"}")
      return
    }

    val mode = (requestedResizeMode ?: "contain").lowercase()
    val containerW = width
    val containerH = height

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

    var changed = false

    val params = surfaceView.layoutParams as? FrameLayout.LayoutParams
      ?: FrameLayout.LayoutParams(targetW, targetH)

    if (params.width != targetW || params.height != targetH) {
      params.width = targetW
      params.height = targetH
      params.gravity = android.view.Gravity.CENTER
      surfaceView.layoutParams = params
      changed = true
    }

    val subParams = subtitleSurfaceView.layoutParams as? FrameLayout.LayoutParams
      ?: FrameLayout.LayoutParams(targetW, targetH)
    if (subParams.width != targetW || subParams.height != targetH) {
      subParams.width = targetW
      subParams.height = targetH
      subParams.gravity = android.view.Gravity.CENTER
      subtitleSurfaceView.layoutParams = subParams
      changed = true
    }

    if (changed) {
      Log.i(TAG, "applyResizeTransform mode=$mode view=${containerW}x${containerH} video=${videoW}x${videoH} -> ${targetW}x${targetH}")
    } else {
      Log.i(TAG, "applyResizeTransform no-op mode=$mode view=${containerW}x${containerH} video=${videoW}x${videoH} target=${targetW}x${targetH}")
    }
  }
}
