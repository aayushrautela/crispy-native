package aayush.crispy.core

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
import java.io.File

class CrispyNativeCoreModule : Module() {
  private var crispyServer: CrispyServer? = null
  private var torrentService: TorrentService? = null
  private var isBound = false

  private val connection = object : ServiceConnection {
    override fun onServiceConnected(className: android.content.ComponentName, service: IBinder) {
      val binder = service as TorrentService.TorrentBinder
      torrentService = binder.getService()
      crispyServer?.setTorrentService(torrentService!!)
      isBound = true
      Log.d("CrispyModule", "TorrentService connected")
    }

    override fun onServiceDisconnected(arg0: android.content.ComponentName) {
      isBound = false
      torrentService = null
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

      // 2. Bind to Torrent Service
      val intent = Intent(context, TorrentService::class.java)
      context.startService(intent) // Ensure it's started as foreground
      context.bindService(intent, connection, Context.BIND_AUTO_CREATE)
    }

    OnDestroy {
      val context = appContext.reactContext ?: return@OnDestroy
      if (isBound) {
        context.unbindService(connection)
        isBound = false
      }
      crispyServer?.stop()
    }

    AsyncFunction("resolveStream") { infoHash: String, fileIdx: Int ->
      val service = torrentService ?: return@AsyncFunction null
      
      // Auto-start torrent if not active
      service.startInfoHash(infoHash)
      
      val idx = if (fileIdx >= 0) fileIdx else service.getLargestFileIndex(infoHash)
      return@AsyncFunction service.getStreamUrl(infoHash, idx)
    }

    AsyncFunction("stopTorrent") { infoHash: String ->
      torrentService?.deleteTorrentData(infoHash)
    }

    AsyncFunction("handleSeek") { infoHash: String, fileIdx: Int, position: Long ->
      torrentService?.handleSeek(infoHash, fileIdx, position)
    }

    AsyncFunction("enterPiP") {
      val activity = appContext.currentActivity ?: return@AsyncFunction
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
          val params = android.app.PictureInPictureParams.Builder().build()
          activity.enterPictureInPictureMode(params)
      }
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

      Prop("metadata") { view: CrispyVideoView, metadata: CrispyMediaMetadata? ->
        view.setMetadata(metadata)
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

      AsyncFunction("addExternalSubtitle") { view: CrispyVideoView, url: String, title: String?, lang: String? ->
        view.addExternalSubtitle(url, title, lang)
      }

      AsyncFunction("setSubtitleDelay") { view: CrispyVideoView, delay: Double ->
        view.setSubtitleDelay(delay)
      }
    }

    // --- LOADING INDICATOR VIEW ---
    View(LoadingIndicatorView::class) {
      Prop("color") { view: LoadingIndicatorView, color: Int ->
        view.setIndicatorColor(color)
      }

      Prop("containerColor") { view: LoadingIndicatorView, color: Int? ->
        view.setContainerColor(color)
      }

      Prop("size") { view: LoadingIndicatorView, size: Int ->
        view.setIndicatorSize(size)
      }

      Prop("containerSize") { view: LoadingIndicatorView, size: Int ->
        view.setContainerSize(size)
      }
    }
  }
}
