package aayush.crispy.core.player

import android.app.Notification
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Binder
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import android.view.Surface
import aayush.crispy.core.MediaSessionHandler

/**
 * Playback service that owns VLC lifecycle.
 */
class VlcPlaybackService : Service(), VlcEngine.NotificationCallbacks, VlcEngine.ServiceCallbacks {

  companion object {
    private const val TAG = "VlcPlaybackService"
    private const val STOP_DELAY_MS = 30_000L

    const val ACTION_STOP = "aayush.crispy.core.player.action.STOP_VLC"
  }

  inner class LocalBinder : Binder() {
    fun getService(): VlcPlaybackService = this@VlcPlaybackService
  }

  private val binder = LocalBinder()

  private val mainHandler = Handler(Looper.getMainLooper())
  private val notificationManager by lazy {
    getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  }

  private lateinit var engine: VlcEngine
  private var isForeground = false
  private var clientCount = 0

  private val stopRunnable = Runnable {
    maybeStopSelf()
  }

  override fun onCreate() {
    super.onCreate()
    engine = VlcEngine(applicationContext, notificationCallbacks = this, serviceCallbacks = this)
    Log.i(TAG, "onCreate")
  }

  override fun onBind(intent: Intent?): IBinder {
    return binder
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      Log.i(TAG, "onStartCommand ACTION_STOP")
      onStopRequested()
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    Log.i(TAG, "onDestroy")
    mainHandler.removeCallbacks(stopRunnable)
    try {
      engine.release()
    } catch (_: Throwable) {
      // ignore
    }

    try {
      stopForegroundCompat(true)
    } catch (_: Throwable) {
      // ignore
    }
    super.onDestroy()
  }

  fun addListener(listener: VlcEngine.Listener) {
    engine.addListener(listener)
  }

  fun removeListener(listener: VlcEngine.Listener) {
    engine.removeListener(listener)
  }
  
  // Surface Management for VLC
  fun attachSurface(surface: Surface, width: Int, height: Int) {
      engine.attachSurface(surface, width, height)
  }
  
  fun detachSurface() {
      engine.detachSurface()
  }
  
  fun setSurfaceSize(width: Int, height: Int) {
      engine.setSurfaceSize(width, height)
  }

  fun registerClient() {
    clientCount += 1
    cancelStop()
  }

  fun unregisterClient() {
    clientCount = (clientCount - 1).coerceAtLeast(0)
    scheduleStopIfIdle()
  }

  fun setHeaders(headers: Map<String, String>?) {
    engine.setHeaders(headers)
  }

  fun setSource(url: String?) {
    engine.setSource(url)
  }

  fun setPaused(paused: Boolean) {
    engine.setPaused(paused)
  }

  fun seek(positionSec: Double) {
    engine.seek(positionSec)
  }

  fun setRate(rate: Double) {
    engine.setRate(rate)
  }

  fun setVolume(volume: Double) {
    engine.setVolume(volume)
  }

  fun setAudioTrack(trackId: Int) {
    engine.setAudioTrack(trackId)
  }

  fun setSubtitleTrack(trackId: Int) {
    engine.setSubtitleTrack(trackId)
  }

  fun setMetadata(title: String, artist: String, artworkUrl: String?) {
    engine.setMetadata(title, artist, artworkUrl)
  }
  
  // Subtitle styling stubs for compatibility (VLC limited support via LibVLC-Android)
  fun setSubtitleDelay(delaySec: Double) {
     // TODO: Implement via setSpuDelay if LibVLC exposes it, or ignore.
     // LibVLC-Android Java binding might allow mediaPlayer.setSpuDelay(long delay)
     // Use reflection or check API if available.
  }

  fun setResizeMode(mode: String?) {
    if (!mode.isNullOrBlank()) {
      Log.i(TAG, "setResizeMode mode=$mode clients=$clientCount")
      engine.setResizeMode(mode)
    }
  }

  fun stopPlayback() {
    onStopRequested()
  }

  override fun onNotificationUpdated(notification: Notification) {
    val playing = engine.isPlaying()
    if (playing) {
      cancelStop()
    }

    if (playing) {
      if (!isForeground) {
        try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(MediaSessionHandler.NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
          } else {
            startForeground(MediaSessionHandler.NOTIFICATION_ID, notification)
          }
          isForeground = true
        } catch (t: Throwable) {
          Log.w(TAG, "startForeground failed", t)
          try { notificationManager.notify(MediaSessionHandler.NOTIFICATION_ID, notification) } catch (_: Throwable) {}
        }
      } else {
        try { notificationManager.notify(MediaSessionHandler.NOTIFICATION_ID, notification) } catch (_: Throwable) {}
      }
      return
    }

    if (isForeground) {
      try { stopForegroundCompat(false) } catch (_: Throwable) {}
      isForeground = false
    }
    try { notificationManager.notify(MediaSessionHandler.NOTIFICATION_ID, notification) } catch (_: Throwable) {}
    scheduleStopIfIdle()
  }

  override fun onNotificationCancelled() {
    try { notificationManager.cancel(MediaSessionHandler.NOTIFICATION_ID) } catch (_: Throwable) {}
    if (isForeground) {
      try { stopForegroundCompat(true) } catch (_: Throwable) {}
      isForeground = false
    }
  }

  override fun onStopRequested() {
    Log.i(TAG, "onStopRequested")
    engine.stopPlayback()

    if (isForeground) {
      try { stopForegroundCompat(true) } catch (_: Throwable) {}
      isForeground = false
    }
    try { notificationManager.cancel(MediaSessionHandler.NOTIFICATION_ID) } catch (_: Throwable) {}

    scheduleStopIfIdle(250)
  }

  private fun cancelStop() {
    mainHandler.removeCallbacks(stopRunnable)
  }

  private fun scheduleStopIfIdle(delayMs: Long = STOP_DELAY_MS) {
    if (clientCount > 0) return
    if (engine.isPlaying()) return

    mainHandler.removeCallbacks(stopRunnable)
    mainHandler.postDelayed(stopRunnable, delayMs)
  }

  private fun maybeStopSelf() {
    if (clientCount > 0) return
    if (engine.isPlaying()) return
    stopSelf()
  }

  private fun stopForegroundCompat(removeNotification: Boolean) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      val flags = if (removeNotification) Service.STOP_FOREGROUND_REMOVE else Service.STOP_FOREGROUND_DETACH
      stopForeground(flags)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(removeNotification)
    }
  }
}
