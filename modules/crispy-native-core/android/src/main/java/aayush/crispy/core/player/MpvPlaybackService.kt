package aayush.crispy.core.player

import android.app.Service
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import android.view.Surface

import aayush.crispy.core.MediaSessionHandler

/**
 * Process-local playback service that owns MPV lifecycle.
 *
 * The goal is to decouple MPVLib from the React Native view lifecycle:
 * - View attach/detach should only attach/detach surfaces.
 * - Player state must survive PiP transitions and temporary view re-creation.
 */
class MpvPlaybackService : Service(), MpvEngine.NotificationCallbacks, MpvEngine.ServiceCallbacks {

  companion object {
    private const val TAG = "MpvPlaybackService"
    private const val STOP_DELAY_MS = 30_000L

    const val ACTION_STOP = "aayush.crispy.core.player.action.STOP"
  }

  inner class LocalBinder : Binder() {
    fun getService(): MpvPlaybackService = this@MpvPlaybackService
  }

  private val binder = LocalBinder()

  private val mainHandler = Handler(Looper.getMainLooper())
  private val notificationManager by lazy {
    getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  }

  private lateinit var engine: MpvEngine

  private var isForeground = false
  private var clientCount = 0

  private val stopRunnable = Runnable {
    maybeStopSelf()
  }

  override fun onCreate() {
    super.onCreate()
    engine = MpvEngine(applicationContext, notificationCallbacks = this, serviceCallbacks = this)
    Log.d(TAG, "onCreate")
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      onStopRequested()
    }
    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder {
    return binder
  }

  override fun onDestroy() {
    Log.d(TAG, "onDestroy")
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

  fun registerClient() {
    clientCount += 1
    cancelStop()
  }

  fun unregisterClient() {
    clientCount = (clientCount - 1).coerceAtLeast(0)
    scheduleStopIfIdle()
  }

  fun addListener(listener: MpvEngine.Listener) {
    engine.addListener(listener)
  }

  fun removeListener(listener: MpvEngine.Listener) {
    engine.removeListener(listener)
  }

  fun attachSurface(surface: Surface, width: Int, height: Int) {
    engine.attachSurface(surface, width, height)
  }

  fun detachSurface() {
    engine.detachSurface()
  }

  fun setSurfaceSize(width: Int, height: Int) {
    engine.setSurfaceSize(width, height)
  }

  fun setSource(url: String?) {
    engine.setSource(url)
  }

  fun setHeaders(headers: Map<String, String>?) {
    engine.setHeaders(headers)
  }

  fun setPaused(paused: Boolean) {
    engine.setPaused(paused)
  }

  fun setRate(rate: Double) {
    engine.setRate(rate)
  }

  fun setVolume(volume: Double) {
    engine.setVolume(volume)
  }

  override fun onNotificationUpdated(notification: Notification) {
    // Called from MediaSessionHandler whenever it rebuilds the media notification.
    val playing = engine.isPlaying()
    if (playing) {
      cancelStop()
    }

    // Foreground only while actively playing (keeps process priority while backgrounded).
    if (playing) {
      if (!isForeground) {
        try {
          startForeground(MediaSessionHandler.NOTIFICATION_ID, notification)
          isForeground = true
        } catch (t: Throwable) {
          Log.w(TAG, "startForeground failed", t)
          // Fall back to a normal notification.
          try { notificationManager.notify(MediaSessionHandler.NOTIFICATION_ID, notification) } catch (_: Throwable) {}
        }
      } else {
        try { notificationManager.notify(MediaSessionHandler.NOTIFICATION_ID, notification) } catch (_: Throwable) {}
      }
      return
    }

    // Not playing: drop out of foreground but keep notification visible.
    if (isForeground) {
      try {
        stopForegroundCompat(false)
      } catch (_: Throwable) {
        // ignore
      }
      isForeground = false
    }
    try { notificationManager.notify(MediaSessionHandler.NOTIFICATION_ID, notification) } catch (_: Throwable) {}
    scheduleStopIfIdle()
  }

  override fun onNotificationCancelled() {
    try {
      notificationManager.cancel(MediaSessionHandler.NOTIFICATION_ID)
    } catch (_: Throwable) {
      // ignore
    }
    if (isForeground) {
      try { stopForegroundCompat(true) } catch (_: Throwable) {}
      isForeground = false
    }
  }

  override fun onStopRequested() {
    engine.stopPlayback()

    // Remove notification + foreground status immediately.
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

  fun seek(positionSec: Double) {
    engine.seek(positionSec)
  }

  fun setAudioTrack(trackId: Int) {
    engine.setAudioTrack(trackId)
  }

  fun setSubtitleTrack(trackId: Int) {
    engine.setSubtitleTrack(trackId)
  }

  fun setResizeMode(mode: String?) {
    engine.setResizeMode(mode)
  }

  fun setDecoderMode(mode: String?) {
    engine.setDecoderMode(mode)
  }

  fun setGpuMode(mode: String?) {
    engine.setGpuMode(mode)
  }

  fun setMetadata(title: String, artist: String, artworkUrl: String?) {
    engine.setMetadata(title, artist, artworkUrl)
  }

  fun setSubtitleSize(size: Int) {
    engine.setSubtitleSize(size)
  }

  fun setSubtitleColor(color: String) {
    engine.setSubtitleColor(color)
  }

  fun setSubtitleBackgroundColor(color: String, opacity: Float) {
    engine.setSubtitleBackgroundColor(color, opacity)
  }

  fun setSubtitleBorderSize(size: Int) {
    engine.setSubtitleBorderSize(size)
  }

  fun setSubtitleBorderColor(color: String) {
    engine.setSubtitleBorderColor(color)
  }

  fun setSubtitlePosition(pos: Int) {
    engine.setSubtitlePosition(pos)
  }

  fun setSubtitleDelay(delaySec: Double) {
    engine.setSubtitleDelay(delaySec)
  }

  fun setSubtitleBold(bold: Boolean) {
    engine.setSubtitleBold(bold)
  }

  fun setSubtitleItalic(italic: Boolean) {
    engine.setSubtitleItalic(italic)
  }
}
