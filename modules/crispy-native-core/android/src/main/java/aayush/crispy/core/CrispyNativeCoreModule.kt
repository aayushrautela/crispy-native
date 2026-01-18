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

    // --- VIDEO PLAYER VIEW ---
    View(CrispyVideoView::class) {
      Prop("source") { view: CrispyVideoView, url: String? ->
        view.setSource(url)
      }

      Prop("paused") { view: CrispyVideoView, paused: Boolean ->
        view.setPaused(paused)
      }

      Events("onLoad", "onProgress", "onEnd")

      AsyncFunction("seek") { view: CrispyVideoView, positionMs: Long ->
        view.seek(positionMs)
      }
    }
  }
}
