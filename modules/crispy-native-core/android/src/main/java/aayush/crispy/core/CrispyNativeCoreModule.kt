package aayush.crispy.core

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.IBinder
import android.util.Log
import android.os.Looper
import android.os.Handler
import com.facebook.react.bridge.ReactContext
import aayush.crispy.core.pip.PipController
import aayush.crispy.core.player.PlayerActivity
import java.util.HashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class CrispyNativeCoreModule : Module() {
  // CrispyServer is owned exclusively by TorrentService and started on-demand.
  // This avoids EADDRINUSE when both Module and Service try to bind port 11470.
  private var torrentService: TorrentService? = null
  private var isBound = false
  private var serviceLatch = CountDownLatch(1)
  private var startupCleanupLatch = CountDownLatch(0)

  private val connection = object : ServiceConnection {
    override fun onServiceConnected(className: android.content.ComponentName, service: IBinder) {
      val binder = service as TorrentService.TorrentBinder
      torrentService = binder.getService()
      isBound = true
      serviceLatch.countDown()
      Log.d("CrispyModule", "TorrentService connected")
    }

    override fun onServiceDisconnected(arg0: android.content.ComponentName) {
      isBound = false
      torrentService = null
      serviceLatch = CountDownLatch(1)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("CrispyNativeCore")

    OnCreate {
      val context = appContext.reactContext ?: return@OnCreate
      startupCleanupLatch = CountDownLatch(1)

      val reactContext = context as? ReactContext
      if (reactContext != null) {
        // Centralized PiP controller (events + params updates).
        val app = reactContext.applicationContext as? android.app.Application
        if (app != null) PipController.start(app, reactContext)
      }

      Thread {
        try {
          TorrentService.cleanupTorrentStorage(context.applicationContext, "module_create")
        } catch (e: Exception) {
          Log.e("CrispyModule", "Startup torrent cleanup failed", e)
        } finally {
          startupCleanupLatch.countDown()
        }
      }.start()

      // TorrentService (with its CrispyServer) is started on-demand in ensureService()
    }

    OnDestroy {
      val context = appContext.reactContext ?: return@OnDestroy
      
      // Stop everything aggressively
      if (isBound) {
        try {
          torrentService?.stopAll(clearStorage = true)
          context.unbindService(connection)
        } catch (e: Exception) {
          Log.e("CrispyModule", "Error during OnDestroy unbind", e)
        }
        isBound = false
      }
      
      PipController.stop()
    }

    AsyncFunction("startStream") { infoHash: String, fileIdx: Int, sessionId: String ->
      Log.d("CrispyModule", "[JS] startStream: $infoHash, index: $fileIdx, session: $sessionId")

      waitForStartupCleanup()
      
      val service = ensureService()
      if (service == null) {
          Log.e("CrispyModule", "Failed to start stream: Service not bound (timeout)")
          return@AsyncFunction null
      }

      if (!service.awaitServerReady()) {
          Log.e("CrispyModule", "Failed to start stream: local server not ready")
          return@AsyncFunction null
      }
      
      // Start torrent download (non-blocking) with Session ID
      if (!service.startInfoHash(infoHash, sessionId)) {
          Log.e("CrispyModule", "Failed to start torrent: $infoHash")
          return@AsyncFunction null
      }
      
      // Return URL immediately - Native Server handles waiting for metadata if player connects early
      val idx = if (fileIdx >= 0) fileIdx else service.getLargestFileIndex(infoHash)
      val url = service.getStreamUrl(infoHash, idx)
      Log.d("CrispyModule", "[JS] -> resolved URL immediately: $url")
      return@AsyncFunction url
    }

    AsyncFunction("destroyStream") { sessionId: String ->
      Log.d("CrispyModule", "[JS] destroyStream: $sessionId")
      val service = torrentService ?: ensureService()
      if (service != null) {
          service.stopAll(sessionId, clearStorage = true)
      } else {
          val context = appContext.reactContext
          if (context != null) {
              TorrentService.cleanupTorrentStorage(context.applicationContext, "destroy_stream_unbound")
          }
      }
      
      // PRODUCTION: If no more active torrents, unbind to allow service to stop
      if (torrentService?.hasActiveTorrents() != true) {
          Log.d("CrispyModule", "No active torrents, unbinding service...")
          if (isBound) {
              val context = appContext.reactContext
              context?.unbindService(connection)
              isBound = false
              torrentService = null
              serviceLatch = CountDownLatch(1)
          }
      }
    }

    AsyncFunction("stopTorrent") { infoHash: String ->
      torrentService?.stopTorrent(infoHash)
    }

    AsyncFunction("destroyTorrent") { infoHash: String ->
      torrentService?.deleteTorrentData(infoHash)
    }

    AsyncFunction("clearCache") {
      val context = appContext.reactContext ?: return@AsyncFunction
      val service = torrentService
      if (service != null) {
        service.stopAll(clearStorage = true)
      } else {
        TorrentService.cleanupTorrentStorage(context.applicationContext, "clear_cache")
      }
    }

    AsyncFunction("handleSeek") { infoHash: String, fileIdx: Int, position: Long ->
      Log.d("CrispyModule", "[JS] handleSeek: $infoHash, index: $fileIdx, pos: $position")
      torrentService?.handleSeek(infoHash, fileIdx, position)
    }

    AsyncFunction("enterPiP") { width: Double?, height: Double? ->
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      return@AsyncFunction PipController.enterPiP(activity, width, height)
    }

    /**
     * Updates PiP configuration without necessarily entering PiP.
     *
     * JS should call this from the player screen whenever:
     * - playback starts/pauses
     * - video dimensions become known
     * - player screen mounts/unmounts (enabled flag)
     */
    AsyncFunction("setPiPConfig") { enabled: Boolean, isPlaying: Boolean, width: Double?, height: Double? ->
      PipController.setConfigFromJs(enabled, isPlaying, width, height)
      return@AsyncFunction true
    }

    AsyncFunction("isInPiPMode") {
      val activity = appContext.currentActivity
      if (activity == null) return@AsyncFunction false
      return@AsyncFunction PipController.isInPiPMode(activity)
    }

    // --- NATIVE PLAYER ACTIVITY (Android) ---
    AsyncFunction("openPlayerActivity") { sessionId: String, url: String, headers: Map<String, String>?, engine: String?, paused: Boolean, title: String?, artist: String?, artworkUrl: String? ->
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      val activity = appContext.currentActivity

      val intent = Intent(activity ?: ctx, PlayerActivity::class.java)
      if (activity == null) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

      intent.putExtra(PlayerActivity.EXTRA_SESSION_ID, sessionId)
      intent.putExtra(PlayerActivity.EXTRA_URL, url)
      intent.putExtra(PlayerActivity.EXTRA_ENGINE, engine ?: PlayerActivity.ENGINE_EXO)
      intent.putExtra(PlayerActivity.EXTRA_PAUSED, paused)
      intent.putExtra(PlayerActivity.EXTRA_TITLE, title ?: "")
      intent.putExtra(PlayerActivity.EXTRA_ARTIST, artist ?: "")
      intent.putExtra(PlayerActivity.EXTRA_ARTWORK_URL, artworkUrl)
      if (headers != null) {
        intent.putExtra(PlayerActivity.EXTRA_HEADERS, HashMap(headers))
      }

      return@AsyncFunction try {
        val starter = (activity ?: ctx)
        if (Looper.myLooper() == Looper.getMainLooper()) {
          starter.startActivity(intent)
        } else {
          Handler(Looper.getMainLooper()).post {
            try {
              starter.startActivity(intent)
            } catch (t: Throwable) {
              Log.e("CrispyModule", "openPlayerActivity failed", t)
            }
          }
        }
        true
      } catch (t: Throwable) {
        Log.e("CrispyModule", "openPlayerActivity failed", t)
        false
      }
    }

    AsyncFunction("closePlayerActivity") {
      Log.i("CrispyModule", "closePlayerActivity")
      return@AsyncFunction withPlayerActivityUi("closePlayerActivity") { it.stopPlaybackAndFinishFromJs("closePlayerActivity") }
    }

    AsyncFunction("nativePlayerSetPaused") { paused: Boolean ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerSetPaused") { it.setPausedFromJs(paused) }
    }

    AsyncFunction("nativePlayerSeek") { positionSec: Double ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerSeek") { it.seekFromJs(positionSec) }
    }

    AsyncFunction("nativePlayerLoad") { url: String?, headers: Map<String, String>?, paused: Boolean, title: String?, artist: String?, artworkUrl: String? ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerLoad") { it.loadFromJs(url, headers, paused, title, artist, artworkUrl) }
    }

    AsyncFunction("nativePlayerSetRate") { rate: Double ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerSetRate") { it.setRateFromJs(rate) }
    }

    AsyncFunction("nativePlayerSetVolume") { volume: Double ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerSetVolume") { it.setVolumeFromJs(volume) }
    }

    AsyncFunction("nativePlayerSetResizeMode") { mode: String? ->
      Log.i("CrispyModule", "nativePlayerSetResizeMode mode=$mode")
      return@AsyncFunction withPlayerActivityUi("nativePlayerSetResizeMode") { it.setResizeModeFromJs(mode) }
    }

    AsyncFunction("nativePlayerSetAudioTrack") { trackId: Int ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerSetAudioTrack") { it.setAudioTrackFromJs(trackId) }
    }

    AsyncFunction("nativePlayerSetSubtitleTrack") { trackId: Int ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerSetSubtitleTrack") { it.setSubtitleTrackFromJs(trackId) }
    }

    AsyncFunction("nativePlayerSetSubtitleDelay") { delaySec: Double ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerSetSubtitleDelay") { it.setSubtitleDelayFromJs(delaySec) }
    }

    // VLC/MPV compatibility stubs
    AsyncFunction("nativePlayerSetSubtitleSize") { size: Int ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerSetSubtitleSize") { it.setSubtitleSizeFromJs(size) }
    }

    AsyncFunction("nativePlayerSetSubtitleColor") { color: String ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerSetSubtitleColor") { it.setSubtitleColorFromJs(color) }
    }

    AsyncFunction("nativePlayerSetSubtitleBackgroundColor") { color: String, opacity: Float ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerSetSubtitleBackgroundColor") { it.setSubtitleBackgroundColorFromJs(color, opacity) }
    }

    AsyncFunction("nativePlayerSetSubtitleBorderSize") { size: Int ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerSetSubtitleBorderSize") { it.setSubtitleBorderSizeFromJs(size) }
    }

    AsyncFunction("nativePlayerSetSubtitleBorderColor") { color: String ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerSetSubtitleBorderColor") { it.setSubtitleBorderColorFromJs(color) }
    }

    AsyncFunction("nativePlayerSetSubtitlePosition") { pos: Int ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerSetSubtitlePosition") { it.setSubtitlePositionFromJs(pos) }
    }

    AsyncFunction("nativePlayerSetSubtitleBold") { bold: Boolean ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerSetSubtitleBold") { it.setSubtitleBoldFromJs(bold) }
    }

    AsyncFunction("nativePlayerSetSubtitleItalic") { italic: Boolean ->
      return@AsyncFunction withPlayerActivityUi("nativePlayerSetSubtitleItalic") { it.setSubtitleItalicFromJs(italic) }
    }

    // --- VIDEO PLAYER VIEW ---
    View(CrispyVlcVideoView::class) {
      Prop("source") { view: CrispyVlcVideoView, url: String? ->
        view.setSource(url)
      }

      Prop("headers") { view: CrispyVlcVideoView, headers: Map<String, String>? ->
        view.setHeaders(headers)
      }

      Prop("paused") { view: CrispyVlcVideoView, paused: Boolean ->
        view.setPaused(paused)
      }

      Prop("resizeMode") { view: CrispyVlcVideoView, mode: String? ->
        view.setResizeMode(mode)
      }
      
      Prop("playInBackground") { view: CrispyVlcVideoView, playInBackground: Boolean ->
        view.setPlayInBackground(playInBackground)
      }

      Events("onLoad", "onProgress", "onEnd", "onError", "onTracksChanged")

      AsyncFunction("seek") { view: CrispyVlcVideoView, positionSec: Double ->
        view.seek(positionSec)
      }

      AsyncFunction("enterPiP") { _: CrispyVlcVideoView ->
        val activity = appContext.currentActivity ?: return@AsyncFunction false
        return@AsyncFunction PipController.enterPiP(activity, null, null)
      }

      AsyncFunction("setAudioTrack") { view: CrispyVlcVideoView, trackId: Int ->
        view.setAudioTrack(trackId)
      }

      AsyncFunction("setSubtitleTrack") { view: CrispyVlcVideoView, trackId: Int ->
        view.setSubtitleTrack(trackId)
      }

      AsyncFunction("setSubtitleDelay") { view: CrispyVlcVideoView, delay: Double ->
        view.setSubtitleDelay(delay)
      }
      
      AsyncFunction("setMetadata") { view: CrispyVlcVideoView, title: String, artist: String, artworkUrl: String? ->
        view.setMetadata(title, artist, artworkUrl)
      }

      // Compat Stubs
      AsyncFunction("setSubtitleSize") { view: CrispyVlcVideoView, size: Int -> view.setSubtitleSize(size) }
      AsyncFunction("setSubtitleColor") { view: CrispyVlcVideoView, color: String -> view.setSubtitleColor(color) }
      AsyncFunction("setSubtitleBackgroundColor") { view: CrispyVlcVideoView, color: String, opacity: Float -> view.setSubtitleBackgroundColor(color, opacity) }
      AsyncFunction("setSubtitleBorderSize") { view: CrispyVlcVideoView, size: Int -> view.setSubtitleBorderSize(size) }
      AsyncFunction("setSubtitleBorderColor") { view: CrispyVlcVideoView, color: String -> view.setSubtitleBorderColor(color) }
      AsyncFunction("setSubtitlePosition") { view: CrispyVlcVideoView, pos: Int -> view.setSubtitlePosition(pos) }
      AsyncFunction("setSubtitleBold") { view: CrispyVlcVideoView, bold: Boolean -> view.setSubtitleBold(bold) }
      AsyncFunction("setSubtitleItalic") { view: CrispyVlcVideoView, italic: Boolean -> view.setSubtitleItalic(italic) }

      Prop("metadata") { view: CrispyVlcVideoView, metadata: Map<String, Any>? ->
        metadata?.let {
          val title = it["title"] as? String ?: ""
          val artist = (it["artist"] as? String) ?: (it["subtitle"] as? String) ?: ""
          val artworkUrl = it["artworkUrl"] as? String
          view.setMetadata(title, artist, artworkUrl)
        }
      }
    }
  }


  private fun ensureService(): TorrentService? {
      if (torrentService != null) return torrentService
      
      // Start and bind if not already bound
      if (!isBound) {
          val context = appContext.reactContext ?: return null
          Log.d("CrispyModule", "Starting TorrentService lazily...")
          val intent = Intent(context, TorrentService::class.java)
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
              context.startForegroundService(intent)
          } else {
              context.startService(intent)
          }
          context.bindService(intent, connection, Context.BIND_AUTO_CREATE)
      }
      
      return if (waitForService()) torrentService else null
  }

  private fun waitForService(): Boolean {
      if (torrentService != null) return true
      
      Log.d("CrispyModule", "Waiting for TorrentService...")
      try {
          // Wait up to 5 seconds for the service to bind
          val connected = serviceLatch.await(5, TimeUnit.SECONDS)
          if (connected) {
              Log.d("CrispyModule", "Service connected after wait")
          } else {
              Log.w("CrispyModule", "Service connection timed out")
          }
          return connected
      } catch (e: InterruptedException) {
          Log.e("CrispyModule", "Interrupted while waiting for service", e)
          return false
      }
  }

  private fun waitForStartupCleanup(timeoutMs: Long = 60_000L) {
      try {
          val completed = startupCleanupLatch.await(timeoutMs, TimeUnit.MILLISECONDS)
          if (!completed) {
              Log.w("CrispyModule", "Startup torrent cleanup timed out after ${timeoutMs}ms; continuing")
          }
      } catch (e: InterruptedException) {
          Log.e("CrispyModule", "Interrupted while waiting for startup cleanup", e)
      }
  }

  private fun withPlayerActivityUi(action: String, fn: (PlayerActivity) -> Unit): Boolean {
    val current = appContext.currentActivity
    val activity = (current as? PlayerActivity) ?: PlayerActivity.getActive()
    if (activity == null) {
      Log.w("CrispyModule", "$action: no PlayerActivity (current=${current?.javaClass?.simpleName})")
      return false
    }
    activity.runOnUiThread {
      try {
        fn(activity)
      } catch (t: Throwable) {
        Log.e("CrispyModule", "$action failed", t)
      }
    }
    return true
  }
}
