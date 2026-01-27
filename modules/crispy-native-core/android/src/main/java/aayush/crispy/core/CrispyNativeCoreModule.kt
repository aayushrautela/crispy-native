package aayush.crispy.core

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
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
    }

    AsyncFunction("startStream") { infoHash: String, fileIdx: Int ->
      Log.d("CrispyModule", "[JS] startStream: $infoHash, index: $fileIdx")
      
      val service = ensureService()
      if (service == null) {
          Log.e("CrispyModule", "Failed to start stream: Service not bound (timeout)")
          return@AsyncFunction null
      }
      
      // CRITICAL: Clean up previous torrents to prevent storage bloat
      service.stopAll()
      
      // Start torrent download (creates latch internally)
      if (!service.startInfoHash(infoHash)) {
          Log.e("CrispyModule", "Failed to start torrent: $infoHash")
          return@AsyncFunction null
      }
      
      // Block until metadata is received (up to 60 seconds)
      if (!service.awaitMetadata(infoHash)) {
          Log.e("CrispyModule", "Metadata timeout for torrent: $infoHash")
          return@AsyncFunction null
      }
      
      val idx = if (fileIdx >= 0) fileIdx else service.getLargestFileIndex(infoHash)
      val url = service.getStreamUrl(infoHash, idx)
      Log.d("CrispyModule", "[JS] -> resolved URL: $url")
      return@AsyncFunction url
    }

    AsyncFunction("destroyStream") {
      torrentService?.stopAll()
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
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
          val builder = android.app.PictureInPictureParams.Builder()
          if (width != null && height != null && height > 0) {
              val rational = android.util.Rational(width.toInt(), height.toInt())
              // Android PiP has limits on aspect ratio (max 2.39:1, min 1:2.39)
              try {
                  builder.setAspectRatio(rational)
              } catch (e: Exception) {
                  Log.w("CrispyModule", "Failed to set aspect ratio: ${e.message}")
              }
          }
          activity.enterPictureInPictureMode(builder.build())
          return@AsyncFunction true
      }
      return@AsyncFunction false
    }

    // --- VIDEO PLAYER VIEW ---
    View(CrispyVideoView::class) {
      Prop("source") { view: CrispyVideoView, url: String? ->
        view.setSource(url)
      }

      Prop("headers") { view: CrispyVideoView, headers: Map<String, String>? ->
        view.setHeaders(headers)
      }

      Prop("paused") { view: CrispyVideoView, paused: Boolean ->
        view.setPaused(paused)
      }

      Prop("resizeMode") { view: CrispyVideoView, mode: String? ->
        view.setResizeMode(mode)
      }

      Prop("decoderMode") { view: CrispyVideoView, mode: String ->
        view.decoderMode = mode
      }

      Prop("gpuMode") { view: CrispyVideoView, mode: String ->
        view.gpuMode = mode
      }

      Events("onLoad", "onProgress", "onEnd", "onError", "onTracksChanged")

      AsyncFunction("seek") { view: CrispyVideoView, positionSec: Double ->
        view.seek(positionSec)
      }

      AsyncFunction("setAudioTrack") { view: CrispyVideoView, trackId: Int ->
        view.setAudioTrack(trackId)
      }

      AsyncFunction("setSubtitleTrack") { view: CrispyVideoView, trackId: Int ->
        view.setSubtitleTrack(trackId)
      }

      AsyncFunction("setSubtitleSize") { view: CrispyVideoView, size: Int ->
        view.setSubtitleSize(size)
      }

      AsyncFunction("setSubtitleColor") { view: CrispyVideoView, color: String ->
        view.setSubtitleColor(color)
      }

      AsyncFunction("setSubtitleBackgroundColor") { view: CrispyVideoView, color: String, opacity: Float ->
        view.setSubtitleBackgroundColor(color, opacity)
      }

      AsyncFunction("setSubtitleBorderSize") { view: CrispyVideoView, size: Int ->
        view.setSubtitleBorderSize(size)
      }

      AsyncFunction("setSubtitleBorderColor") { view: CrispyVideoView, color: String ->
        view.setSubtitleBorderColor(color)
      }

      AsyncFunction("setSubtitlePosition") { view: CrispyVideoView, pos: Int ->
        view.setSubtitlePosition(pos)
      }

      AsyncFunction("setSubtitleDelay") { view: CrispyVideoView, delay: Double ->
        view.setSubtitleDelay(delay)
      }

      AsyncFunction("setSubtitleBold") { view: CrispyVideoView, bold: Boolean ->
        view.setSubtitleBold(bold)
      }

      AsyncFunction("setSubtitleItalic") { view: CrispyVideoView, italic: Boolean ->
        view.setSubtitleItalic(italic)
      }

      Prop("metadata") { view: CrispyVideoView, metadata: Map<String, Any>? ->
        metadata?.let {
          val title = it["title"] as? String ?: ""
          val artist = (it["artist"] as? String) ?: (it["subtitle"] as? String) ?: ""
          val artworkUrl = it["artworkUrl"] as? String
          view.setMetadata(title, artist, artworkUrl)
        }
      }

      Prop("playInBackground") { view: CrispyVideoView, playInBackground: Boolean ->
        view.setPlayInBackground(playInBackground)
      }

      AsyncFunction("setMetadata") { view: CrispyVideoView, title: String, artist: String, artworkUrl: String? ->
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
