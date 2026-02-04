package aayush.crispy.core

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.IBinder
import android.util.Log
import com.facebook.react.bridge.ReactContext
import aayush.crispy.core.pip.PipController
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class CrispyNativeCoreModule : Module() {
  private var crispyServer: CrispyServer? = null
  private var torrentService: TorrentService? = null
  private var isBound = false
  private var serviceLatch = CountDownLatch(1)

  private val connection = object : ServiceConnection {
    override fun onServiceConnected(className: android.content.ComponentName, service: IBinder) {
      val binder = service as TorrentService.TorrentBinder
      torrentService = binder.getService()
      torrentService?.performStartupCleanup()
      crispyServer?.setTorrentService(torrentService!!)
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
      val downloadDir = context.getExternalFilesDir(null) ?: context.filesDir

      val reactContext = context as? ReactContext
      if (reactContext != null) {
        // Centralized PiP controller (events + params updates).
        val app = reactContext.applicationContext as? android.app.Application
        if (app != null) PipController.start(app, reactContext)
      }
      
      // 1. Start Local Server
      crispyServer = CrispyServer(11470, downloadDir)
      crispyServer?.safeStart()
      
      // TorrentService will be started lazily when needed
    }

    OnDestroy {
      val context = appContext.reactContext ?: return@OnDestroy
      if (isBound) {
        context.unbindService(connection)
        isBound = false
      }
      crispyServer?.stop()

      PipController.stop()
    }

    AsyncFunction("startStream") { infoHash: String, fileIdx: Int, sessionId: String ->
      Log.d("CrispyModule", "[JS] startStream: $infoHash, index: $fileIdx, session: $sessionId")
      
      val service = ensureService()
      if (service == null) {
          Log.e("CrispyModule", "Failed to start stream: Service not bound (timeout)")
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
      torrentService?.stopAll(sessionId)
    }

    AsyncFunction("stopTorrent") { infoHash: String ->
      torrentService?.stopTorrent(infoHash)
    }

    AsyncFunction("destroyTorrent") { infoHash: String ->
      torrentService?.deleteTorrentData(infoHash)
    }

    AsyncFunction("clearCache") {
      torrentService?.performStartupCleanup()
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

    // --- VIDEO PLAYER VIEW ---
    View(CrispyMpvVideoView::class) {
      Prop("source") { view: CrispyMpvVideoView, url: String? ->
        view.setSource(url)
      }

      Prop("headers") { view: CrispyMpvVideoView, headers: Map<String, String>? ->
        view.setHeaders(headers)
      }

      Prop("paused") { view: CrispyMpvVideoView, paused: Boolean ->
        view.setPaused(paused)
      }

      Prop("resizeMode") { view: CrispyMpvVideoView, mode: String? ->
        view.setResizeMode(mode)
      }

      Prop("decoderMode") { view: CrispyMpvVideoView, mode: String ->
        view.decoderMode = mode
      }

      Prop("gpuMode") { view: CrispyMpvVideoView, mode: String ->
        view.gpuMode = mode
      }

      Events("onLoad", "onProgress", "onEnd", "onError", "onTracksChanged")

      AsyncFunction("seek") { view: CrispyMpvVideoView, positionSec: Double ->
        view.seek(positionSec)
      }

      // Convenience for the player screen ref API.
      // (There is also a module-level enterPiP(width,height) for aspect-ratio overrides.)
      AsyncFunction("enterPiP") { _: CrispyMpvVideoView ->
        val activity = appContext.currentActivity ?: return@AsyncFunction false
        return@AsyncFunction PipController.enterPiP(activity, null, null)
      }

      AsyncFunction("setAudioTrack") { view: CrispyMpvVideoView, trackId: Int ->
        view.setAudioTrack(trackId)
      }

      AsyncFunction("setSubtitleTrack") { view: CrispyMpvVideoView, trackId: Int ->
        view.setSubtitleTrack(trackId)
      }

      AsyncFunction("setSubtitleSize") { view: CrispyMpvVideoView, size: Int ->
        view.setSubtitleSize(size)
      }

      AsyncFunction("setSubtitleColor") { view: CrispyMpvVideoView, color: String ->
        view.setSubtitleColor(color)
      }

      AsyncFunction("setSubtitleBackgroundColor") { view: CrispyMpvVideoView, color: String, opacity: Float ->
        view.setSubtitleBackgroundColor(color, opacity)
      }

      AsyncFunction("setSubtitleBorderSize") { view: CrispyMpvVideoView, size: Int ->
        view.setSubtitleBorderSize(size)
      }

      AsyncFunction("setSubtitleBorderColor") { view: CrispyMpvVideoView, color: String ->
        view.setSubtitleBorderColor(color)
      }

      AsyncFunction("setSubtitlePosition") { view: CrispyMpvVideoView, pos: Int ->
        view.setSubtitlePosition(pos)
      }

      AsyncFunction("setSubtitleDelay") { view: CrispyMpvVideoView, delay: Double ->
        view.setSubtitleDelay(delay)
      }

      AsyncFunction("setSubtitleBold") { view: CrispyMpvVideoView, bold: Boolean ->
        view.setSubtitleBold(bold)
      }

      AsyncFunction("setSubtitleItalic") { view: CrispyMpvVideoView, italic: Boolean ->
        view.setSubtitleItalic(italic)
      }

      Prop("metadata") { view: CrispyMpvVideoView, metadata: Map<String, Any>? ->
        metadata?.let {
          val title = it["title"] as? String ?: ""
          val artist = (it["artist"] as? String) ?: (it["subtitle"] as? String) ?: ""
          val artworkUrl = it["artworkUrl"] as? String
          view.setMetadata(title, artist, artworkUrl)
        }
      }

      Prop("playInBackground") { view: CrispyMpvVideoView, playInBackground: Boolean ->
        view.setPlayInBackground(playInBackground)
      }

      AsyncFunction("setMetadata") { view: CrispyMpvVideoView, title: String, artist: String, artworkUrl: String? ->
        view.setMetadata(title, artist, artworkUrl)
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
          context.startService(intent)
          context.bindService(intent, connection, Context.BIND_AUTO_CREATE)
      }
      
      return if (waitForService()) {
          // Pass service to server once connected
          if (torrentService != null) {
              crispyServer?.setTorrentService(torrentService!!)
          }
          torrentService
      } else null
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
}
