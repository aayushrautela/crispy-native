package aayush.crispy.core

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
      
      // If surface is already ready, attach it
      if (surfaceView.holder.surface.isValid) {
          svc.attachSurface(surfaceView.holder.surface, surfaceView.width, surfaceView.height)
      }

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
            playbackService?.attachSurface(holder.surface, surfaceView.width, surfaceView.height)
        }
        override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
            playbackService?.setSurfaceSize(width, height)
        }
        override fun surfaceDestroyed(holder: SurfaceHolder) {
            playbackService?.detachSurface()
        }
    })
    
    addView(surfaceView)

    PipController.registerPlayerView(surfaceView)
    (context as? ReactContext)?.addLifecycleEventListener(lifecycleListener)

    bindPlaybackService()
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
      // Unlike PlayerView which handles resize mode internally, SurfaceView needs LayoutParams tweaks.
      // But here we are inside a ReactViewGroup (ExpoView) which layout is managed by RN/Flexbox.
      // Usually the "View" itself is resized by RN style. 
      // If we need internal aspect ratio, we can adjust SurfaceView size. 
      // For now, assume MATCH_PARENT.
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

    val md = latestMetadata
    if (md != null) {
      service.setMetadata(md.title, md.artist, md.artworkUrl)
    }

    pendingSource?.let { service.setSource(it) }
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
}
