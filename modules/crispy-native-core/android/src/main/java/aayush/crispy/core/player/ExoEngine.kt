package aayush.crispy.core.player

import android.app.Notification
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import aayush.crispy.core.MediaMetadataState
import aayush.crispy.core.MediaSessionHandler
import aayush.crispy.core.pip.PipController
import java.util.concurrent.CopyOnWriteArraySet

class ExoEngine(
  private val appContext: Context,
  private val notificationCallbacks: NotificationCallbacks? = null,
  private val serviceCallbacks: ServiceCallbacks? = null
) {

  companion object {
    private const val TAG = "ExoEngine"
    private const val PROGRESS_INTERVAL_MS = 500L
  }

  interface NotificationCallbacks {
    fun onNotificationUpdated(notification: Notification)
    fun onNotificationCancelled()
  }

  interface ServiceCallbacks {
    fun onStopRequested()
  }

  interface Listener {
    fun onLoad(duration: Double, width: Int, height: Int)
    fun onProgress(currentTime: Double, duration: Double)
    fun onEnd()
    fun onError(error: String)
    fun onTracksChanged(audioTracks: List<Map<String, Any>>, subtitleTracks: List<Map<String, Any>>)

    // Optional state callbacks (used by PlayerActivity overlay)
    fun onIsPlayingChanged(isPlaying: Boolean) {}
    fun onBufferingChanged(buffering: Boolean) {}
    fun onFirstFrameRendered() {}
  }

  private val listeners = CopyOnWriteArraySet<Listener>()
  private val mainHandler = Handler(Looper.getMainLooper())

  private val trackSelector = DefaultTrackSelector(appContext)
  private val httpDataSourceFactory = DefaultHttpDataSource.Factory()
    .setAllowCrossProtocolRedirects(true)

  private val player: ExoPlayer = ExoPlayer.Builder(appContext)
    .setTrackSelector(trackSelector)
    .setMediaSourceFactory(DefaultMediaSourceFactory(httpDataSourceFactory))
    .build()

  private var mediaSessionHandler: MediaSessionHandler? = null
  private var latestMetadata: MediaMetadataState? = null

  private var isPaused: Boolean = true
  private var hasLoadEventFired: Boolean = false
  private var lastVideoSize: VideoSize? = null

  private var lastEmittedIsPlaying: Boolean? = null
  private var lastEmittedBuffering: Boolean? = null
  private var firstFrameEmitted: Boolean = false

  // Track mapping for index-based selection from JS
  private data class TrackRef(
    val trackGroup: androidx.media3.common.TrackGroup,
    val trackIndexInGroup: Int,
    val type: Int
  )

  private var audioTrackRefs: List<TrackRef> = emptyList()
  private var textTrackRefs: List<TrackRef> = emptyList()

  private val progressRunnable = object : Runnable {
    override fun run() {
      try {
        val posMs = player.currentPosition
        val durMs = player.duration
        val posSec = posMs.toDouble() / 1000.0
        val durSec = if (durMs > 0) durMs.toDouble() / 1000.0 else 0.0

        listeners.forEach { it.onProgress(posSec, durSec) }
        mediaSessionHandler?.updatePosition(posSec)
        mediaSessionHandler?.updateDuration(durSec)
      } catch (e: Throwable) {
        Log.w(TAG, "Error in progressRunnable", e)
      } finally {
        mainHandler.postDelayed(this, PROGRESS_INTERVAL_MS)
      }
    }
  }

  init {
    ensureMediaSession()
    applyMetadataIfReady()

    player.addListener(object : Player.Listener {
      override fun onPlaybackStateChanged(playbackState: Int) {
        val buffering = playbackState == Player.STATE_BUFFERING
        emitBufferingChangedIfNeeded(buffering)

        if (playbackState == Player.STATE_READY) {
          emitLoadIfNeeded()
        } else if (playbackState == Player.STATE_ENDED) {
          listeners.forEach { it.onEnd() }
        }
      }

      override fun onPlayerError(error: PlaybackException) {
        val errorCodeName = error.errorCodeName
        val errorMessage = error.message ?: "ExoPlayer error"
        val causeMessage = error.cause?.message ?: ""
        val fullError = "$errorCodeName: $errorMessage | $causeMessage"
        listeners.forEach { it.onError(fullError) }
      }

      override fun onIsPlayingChanged(isPlaying: Boolean) {
        isPaused = !isPlaying
        PipController.updateIsPlayingFromNative(isPlaying)
        mediaSessionHandler?.updatePlaybackState(isPlaying)

        emitIsPlayingChangedIfNeeded(isPlaying)
      }

      override fun onRenderedFirstFrame() {
        if (firstFrameEmitted) return
        firstFrameEmitted = true
        listeners.forEach { it.onFirstFrameRendered() }
        emitBufferingChangedIfNeeded(false)
      }

      override fun onVideoSizeChanged(videoSize: VideoSize) {
        lastVideoSize = videoSize
        if (videoSize.width > 0 && videoSize.height > 0) {
          PipController.updateVideoSizeFromNative(videoSize.width, videoSize.height)
        }
        emitLoadIfNeeded()
      }

      override fun onTracksChanged(tracks: androidx.media3.common.Tracks) {
        parseAndSendTracks(tracks)
      }
    })

    mainHandler.post(progressRunnable)
  }

  fun getPlayer(): ExoPlayer = player

  fun addListener(listener: Listener) {
    listeners.add(listener)

    // Snapshot
    if (hasLoadEventFired) {
      val durMs = player.duration
      val durSec = if (durMs > 0) durMs.toDouble() / 1000.0 else 0.0
      val vs = lastVideoSize
      if (durSec > 0.0 && vs != null && vs.width > 0 && vs.height > 0) {
        listener.onLoad(durSec, vs.width, vs.height)
      }
    }
    try {
      val posSec = player.currentPosition.toDouble() / 1000.0
      val durSec = (player.duration.takeIf { it > 0 } ?: 0).toDouble() / 1000.0
      listener.onProgress(posSec, durSec)
    } catch (_: Throwable) {
      // ignore
    }
  }

  fun removeListener(listener: Listener) {
    listeners.remove(listener)
  }

  fun setHeaders(headers: Map<String, String>?) {
    httpDataSourceFactory.setDefaultRequestProperties(headers ?: emptyMap())
  }

  fun setSource(url: String?) {
    if (url.isNullOrBlank()) return
    hasLoadEventFired = false
    firstFrameEmitted = false
    lastEmittedBuffering = null
    lastEmittedIsPlaying = null

    try {
      player.setMediaItem(MediaItem.fromUri(url))
      player.prepare()
      applyPlayPause()
    } catch (e: Exception) {
      listeners.forEach { it.onError(e.message ?: "Failed to load media") }
    }
  }

  fun setPaused(paused: Boolean) {
    isPaused = paused
    applyPlayPause()
  }

  fun isPlaying(): Boolean = player.isPlaying

  fun stopPlayback() {
    isPaused = true
    hasLoadEventFired = false
    audioTrackRefs = emptyList()
    textTrackRefs = emptyList()

    try {
      player.stop()
      player.clearMediaItems()
    } catch (_: Throwable) {
      // ignore
    }
    mediaSessionHandler?.updatePlaybackState(false)
    PipController.updateIsPlayingFromNative(false)
  }

  private fun applyPlayPause() {
    try {
      if (isPaused) player.pause() else player.play()
      mediaSessionHandler?.updatePlaybackState(!isPaused)
      PipController.updateIsPlayingFromNative(!isPaused)
    } catch (e: Exception) {
      Log.w(TAG, "Failed to apply play/pause", e)
    }
  }

  fun seek(positionSec: Double) {
    try {
      player.seekTo((positionSec * 1000.0).toLong())
    } catch (_: Throwable) {
      // ignore
    }
  }

  fun setRate(rate: Double) {
    try {
      player.setPlaybackSpeed(rate.toFloat())
    } catch (e: Exception) {
      Log.w(TAG, "Failed to set playback speed", e)
    }
  }

  fun setVolume(volume: Double) {
    try {
      player.volume = volume.toFloat().coerceIn(0f, 1f)
    } catch (e: Exception) {
      Log.w(TAG, "Failed to set volume", e)
    }
  }

  private fun applyMetadataIfReady() {
    val metadata = latestMetadata ?: return
    mediaSessionHandler?.updateMetadata(metadata.title, metadata.artist, metadata.artworkUrl)
  }

  fun setMetadata(title: String, artist: String, artworkUrl: String?) {
    val next = MediaMetadataState(title, artist, artworkUrl)
    if (next == latestMetadata) return
    latestMetadata = next
    applyMetadataIfReady()
  }

  fun setAudioTrack(trackId: Int) {
    try {
      val builder = player.trackSelectionParameters.buildUpon()
      if (trackId < 0) {
        builder.setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, true)
        player.trackSelectionParameters = builder.build()
        return
      }

      val ref = audioTrackRefs.getOrNull(trackId) ?: return
      builder.setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, false)
      builder.setOverrideForType(
        androidx.media3.common.TrackSelectionOverride(ref.trackGroup, listOf(ref.trackIndexInGroup))
      )
      player.trackSelectionParameters = builder.build()
    } catch (e: Exception) {
      Log.w(TAG, "Failed to set audio track", e)
    }
  }

  fun setSubtitleTrack(trackId: Int) {
    try {
      val builder = player.trackSelectionParameters.buildUpon()
      if (trackId < 0) {
        builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
        player.trackSelectionParameters = builder.build()
        return
      }

      val ref = textTrackRefs.getOrNull(trackId) ?: return
      builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
      builder.setOverrideForType(
        androidx.media3.common.TrackSelectionOverride(ref.trackGroup, listOf(ref.trackIndexInGroup))
      )
      player.trackSelectionParameters = builder.build()
    } catch (e: Exception) {
      Log.w(TAG, "Failed to set subtitle track", e)
    }
  }

  private fun emitLoadIfNeeded() {
    if (hasLoadEventFired) return
    val durMs = player.duration
    if (durMs <= 0) return

    val vs = lastVideoSize
    if (vs == null || vs.width <= 0 || vs.height <= 0) return

    val durationSec = durMs.toDouble() / 1000.0
    hasLoadEventFired = true
    listeners.forEach { it.onLoad(durationSec, vs.width, vs.height) }
  }

  private fun emitIsPlayingChangedIfNeeded(isPlaying: Boolean) {
    val prev = lastEmittedIsPlaying
    if (prev != null && prev == isPlaying) return
    lastEmittedIsPlaying = isPlaying
    listeners.forEach { it.onIsPlayingChanged(isPlaying) }
  }

  private fun emitBufferingChangedIfNeeded(buffering: Boolean) {
    val prev = lastEmittedBuffering
    if (prev != null && prev == buffering) return
    lastEmittedBuffering = buffering
    listeners.forEach { it.onBufferingChanged(buffering) }
  }

  private fun parseAndSendTracks(tracks: androidx.media3.common.Tracks) {
    try {
      val audioTracks = mutableListOf<Map<String, Any>>()
      val subtitleTracks = mutableListOf<Map<String, Any>>()

      val audioRefs = mutableListOf<TrackRef>()
      val textRefs = mutableListOf<TrackRef>()

      for (group in tracks.groups) {
        val type = group.type
        val tg = group.mediaTrackGroup
        for (i in 0 until tg.length) {
          if (!group.isTrackSupported(i)) continue
          val fmt = tg.getFormat(i)
          val label = fmt.label ?: ""
          val lang = fmt.language ?: ""
          val name = if (label.isNotBlank()) label else if (lang.isNotBlank()) lang.uppercase() else "Track"

          when (type) {
            C.TRACK_TYPE_AUDIO -> {
              val id = audioRefs.size
              audioRefs.add(TrackRef(tg, i, type))
              audioTracks.add(mapOf("id" to id, "name" to name, "language" to lang, "selected" to group.isTrackSelected(i)))
            }
            C.TRACK_TYPE_TEXT -> {
              val id = textRefs.size
              textRefs.add(TrackRef(tg, i, type))
              subtitleTracks.add(mapOf("id" to id, "name" to name, "language" to lang, "selected" to group.isTrackSelected(i)))
            }
          }
        }
      }

      audioTrackRefs = audioRefs
      textTrackRefs = textRefs

      listeners.forEach { it.onTracksChanged(audioTracks, subtitleTracks) }
    } catch (e: Exception) {
      Log.w(TAG, "Failed to parse tracks", e)
    }
  }

  private fun ensureMediaSession() {
    if (mediaSessionHandler != null) return
    val nc = notificationCallbacks
    mediaSessionHandler = MediaSessionHandler(
      appContext,
      object : MediaSessionHandler.MediaSessionCallbacks {
        override fun onPlay() { setPaused(false) }
        override fun onPause() { setPaused(true) }
        override fun onStop() {
          val cb = serviceCallbacks
          if (cb != null) cb.onStopRequested() else stopPlayback()
        }
        override fun onSeekTo(pos: Long) { seek(pos / 1000.0) }
      },
      onNotificationUpdated = if (nc != null) ({ n -> nc.onNotificationUpdated(n) }) else null,
      onNotificationCancelled = if (nc != null) ({ nc.onNotificationCancelled() }) else null
    )
  }

  fun release() {
    listeners.clear()
    try { mainHandler.removeCallbacksAndMessages(null) } catch (_: Throwable) {}
    try { player.release() } catch (_: Throwable) {}
    try { mediaSessionHandler?.release() } catch (_: Throwable) {}
    mediaSessionHandler = null
    latestMetadata = null
  }
}
