package aayush.crispy.core.player

import android.app.Notification
import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Surface
import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.Media
import org.videolan.libvlc.MediaPlayer
import org.videolan.libvlc.interfaces.IVLCVout
import aayush.crispy.core.MediaMetadataState
import aayush.crispy.core.MediaSessionHandler
import aayush.crispy.core.pip.PipController
import java.util.ArrayList
import java.util.concurrent.CopyOnWriteArraySet

class VlcEngine(
  private val appContext: Context,
  private val notificationCallbacks: NotificationCallbacks? = null,
  private val serviceCallbacks: ServiceCallbacks? = null
) : IVLCVout.Callback, IVLCVout.OnNewVideoLayoutListener {

  companion object {
    private const val TAG = "VlcEngine"
    private const val PROGRESS_INTERVAL_MS = 500L
    private const val READY_POLL_INTERVAL_MS = 250L
  }

  enum class PlayerState {
    IDLE,
    PREPARING,
    READY,
    PLAYING,
    PAUSED,
    ERROR,
    ENDED
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
    fun onIsPlayingChanged(isPlaying: Boolean) {}
    fun onBufferingChanged(buffering: Boolean) {}
    fun onFirstFrameRendered() {}
  }

  private val listeners = CopyOnWriteArraySet<Listener>()
  private val mainHandler = Handler(Looper.getMainLooper())

  private var libVLC: LibVLC? = null
  private var mediaPlayer: MediaPlayer? = null
  private var mediaSessionHandler: MediaSessionHandler? = null
  private var latestMetadata: MediaMetadataState? = null

  private var currentState = PlayerState.IDLE
  private var isPaused: Boolean = true
  private var hasSentLoadEvent: Boolean = false
  private var firstFrameEmitted: Boolean = false

  private var cachedDuration: Long = 0L
  private var cachedWidth: Int = 0
  private var cachedHeight: Int = 0
  private var surfaceWidth: Int = 0
  private var surfaceHeight: Int = 0
  private var resizeMode: String = "contain"

  private var pendingSeekPositionSec: Double? = null
  private var isSeekable: Boolean = false
  private var lastSeekRequestTime: Long = 0
  private var seekTargetTime: Long? = null

  private var audioTrackMap: Map<Int, Int> = emptyMap()
  private var spuTrackMap: Map<Int, Int> = emptyMap()

  private val progressRunnable = object : Runnable {
    override fun run() {
      val mp = mediaPlayer
      if (mp != null && !mp.isReleased && currentState != PlayerState.IDLE) {
        try {
          if (currentState == PlayerState.READY || currentState == PlayerState.PLAYING || currentState == PlayerState.PAUSED) {
            val posMs = mp.time
            
            if (seekTargetTime != null) {
              val diff = Math.abs(posMs - seekTargetTime!!)
              val timeSinceSeek = System.currentTimeMillis() - lastSeekRequestTime
              if (diff < 2000 || timeSinceSeek > 2500) {
                seekTargetTime = null
              } else {
                mainHandler.postDelayed(this, PROGRESS_INTERVAL_MS)
                return
              }
            }

            val durMs = mp.length
            val safeDur = if (durMs > 0) durMs else cachedDuration
            if (safeDur > cachedDuration) cachedDuration = safeDur

            val posSec = if (posMs >= 0) posMs.toDouble() / 1000.0 else 0.0
            val durSec = if (safeDur > 0) safeDur.toDouble() / 1000.0 else 0.0

            dispatch { it.onProgress(posSec, durSec) }
            mediaSessionHandler?.updatePosition(posSec)
            mediaSessionHandler?.updateDuration(durSec)
          }
        } catch (e: Throwable) {
          Log.w(TAG, "Error in progressRunnable", e)
        }
      }
      mainHandler.postDelayed(this, PROGRESS_INTERVAL_MS)
    }
  }

  private val readyPollRunnable = object : Runnable {
    override fun run() {
      if (currentState == PlayerState.PREPARING) {
        checkReadyState()
        mainHandler.postDelayed(this, READY_POLL_INTERVAL_MS)
      }
    }
  }

  init {
    initVlc()
    ensureMediaSession()
    applyMetadataIfReady()
    mainHandler.post(progressRunnable)
  }

  private fun initVlc() {
    try {
      val args = ArrayList<String>()
      args.add("--no-stats")
      args.add("--network-caching=2000")
      args.add("--no-osd")
      args.add("--no-drop-late-frames")
      args.add("--no-skip-frames")
      
      libVLC = LibVLC(appContext, args)
      mediaPlayer = MediaPlayer(libVLC)
      
      mediaPlayer?.setEventListener { event ->
        when (event.type) {
          MediaPlayer.Event.Playing -> {
            currentState = PlayerState.PLAYING
            dispatchIsPlayingChanged(true)
            dispatchBufferingChanged(false)
            checkReadyState()
          }
          MediaPlayer.Event.Paused -> {
            currentState = PlayerState.PAUSED
            dispatchIsPlayingChanged(false)
          }
          MediaPlayer.Event.Stopped -> {
            currentState = PlayerState.IDLE
            dispatchIsPlayingChanged(false)
            isSeekable = false
          }
          MediaPlayer.Event.EndReached -> {
            currentState = PlayerState.ENDED
            dispatchIsPlayingChanged(false)
            dispatch { it.onEnd() }
          }
          MediaPlayer.Event.EncounteredError -> {
            currentState = PlayerState.ERROR
            dispatch { it.onError("VLC encountered an error") }
          }
          MediaPlayer.Event.Buffering -> {
            val buffering = event.buffering < 100f
            dispatchBufferingChanged(buffering)
            if (!buffering) checkReadyState()
          }
          MediaPlayer.Event.SeekableChanged -> {
            isSeekable = event.seekable
            if (isSeekable) checkReadyState()
          }
          MediaPlayer.Event.Vout -> {
            mediaPlayer?.updateVideoSurfaces()
            checkReadyState()
          }
          MediaPlayer.Event.ESAdded, MediaPlayer.Event.ESDeleted, MediaPlayer.Event.ESSelected -> {
            parseAndSendTracks()
          }
        }
      }
    } catch (e: Exception) {
      Log.e(TAG, "Failed to init VLC", e)
    }
  }

  private fun checkReadyState() {
    val mp = mediaPlayer ?: return
    
    // Decoupled Ready Check: duration > 0 OR isSeekable is enough to start features
    val hasMetadata = mp.length > 0 || isSeekable
    val hasTracks = (mp.media?.trackCount ?: 0) > 0
    
    if (hasMetadata || hasTracks) {
      if (currentState == PlayerState.PREPARING) {
        currentState = PlayerState.READY
        mainHandler.removeCallbacks(readyPollRunnable)
      }
      
      if (!hasSentLoadEvent) {
        if (mp.length > 0) cachedDuration = mp.length
        val durSec = cachedDuration.toDouble() / 1000.0
        
        // We fire onLoad even if dimensions are 0, UI will update when they arrive
        hasSentLoadEvent = true
        dispatch { it.onLoad(durSec, cachedWidth, cachedHeight) }
        
        if (!firstFrameEmitted && mp.isPlaying) {
          firstFrameEmitted = true
          dispatch { it.onFirstFrameRendered() }
        }
        
        applyPendingSeekIfReady()
      }
    }
  }

  fun attachSurface(surface: Surface, width: Int, height: Int) {
    val mp = mediaPlayer ?: return
    val vout = mp.vlcVout
    surfaceWidth = width
    surfaceHeight = height

    if (!vout.areViewsAttached()) {
      vout.setVideoSurface(surface, null)
      vout.setWindowSize(width, height)
      vout.addCallback(this)
      vout.attachViews()
      Log.d(TAG, "Surface attached: ${width}x${height}")
    } else {
      vout.setWindowSize(width, height)
    }
    applyResizeMode()
  }

  fun setSurfaceSize(width: Int, height: Int) {
    val mp = mediaPlayer ?: return
    val vout = mp.vlcVout
    if (vout.areViewsAttached()) {
      vout.setWindowSize(width, height)
    }
    surfaceWidth = width
    surfaceHeight = height
    applyResizeMode()
  }

  fun setResizeMode(mode: String) {
    resizeMode = mode.lowercase()
    applyResizeMode()
  }

  private fun applyResizeMode() {
    val mp = mediaPlayer ?: return
    if (surfaceWidth <= 0 || surfaceHeight <= 0) return
    
    try {
      when (resizeMode) {
        "stretch", "cover" -> {
          mp.aspectRatio = "${surfaceWidth}:${surfaceHeight}"
        }
        else -> {
          if (cachedWidth > 0 && cachedHeight > 0) {
            mp.aspectRatio = "${cachedWidth}:${cachedHeight}"
          } else {
            mp.aspectRatio = null // Reset to default
          }
        }
      }
    } catch (e: Exception) {
      Log.w(TAG, "Failed to apply aspect ratio: ${e.message}")
    }
  }

  fun detachSurface() {
    val mp = mediaPlayer ?: return
    val vout = mp.vlcVout
    if (vout.areViewsAttached()) {
      vout.removeCallback(this)
      vout.detachViews()
      Log.d(TAG, "Surface detached")
    }
  }

  fun addListener(listener: Listener) {
    listeners.add(listener)
    if (hasSentLoadEvent) {
      val durSec = if (cachedDuration > 0) cachedDuration.toDouble() / 1000.0 else 0.0
      listener.onLoad(durSec, cachedWidth, cachedHeight)
    }
    if (audioTrackMap.isNotEmpty() || spuTrackMap.isNotEmpty()) {
      parseAndSendTracks()
    }
  }

  fun removeListener(listener: Listener) {
    listeners.remove(listener)
  }

  fun setSource(url: String?) {
    if (url.isNullOrBlank()) return
    
    currentState = PlayerState.PREPARING
    hasSentLoadEvent = false
    firstFrameEmitted = false
    cachedDuration = 0
    cachedWidth = 0
    cachedHeight = 0
    pendingSeekPositionSec = null
    seekTargetTime = null
    isSeekable = false
    
    val mp = mediaPlayer ?: return
    val lib = libVLC ?: return

    val encodedUrl = encodeUrlForVlc(url)

    try {
      mp.stop()
      val media = Media(lib, Uri.parse(encodedUrl))
      media.setHWDecoderEnabled(true, false)
      mp.media = media
      media.release()
      
      mp.play()
      isPaused = false
      
      mainHandler.removeCallbacks(readyPollRunnable)
      mainHandler.postDelayed(readyPollRunnable, READY_POLL_INTERVAL_MS)
    } catch (e: Exception) {
      currentState = PlayerState.ERROR
      dispatch { it.onError(e.message ?: "Failed to load media") }
    }
  }

  fun setPaused(paused: Boolean) {
    isPaused = paused
    val mp = mediaPlayer ?: return
    try {
      if (paused) {
        if (mp.isPlaying) mp.pause()
      } else {
        if (!mp.isPlaying) mp.play()
      }
      mediaSessionHandler?.updatePlaybackState(!paused)
      PipController.updateIsPlayingFromNative(!paused)
    } catch (e: Exception) {
      Log.w(TAG, "Failed to apply play/pause", e)
    }
  }

  fun isPlaying(): Boolean = mediaPlayer?.isPlaying ?: false

  fun stopPlayback() {
    isPaused = true
    currentState = PlayerState.IDLE
    hasSentLoadEvent = false
    try {
      mediaPlayer?.stop()
    } catch (_: Throwable) {}
    
    mediaSessionHandler?.updatePlaybackState(false)
    PipController.updateIsPlayingFromNative(false)
  }

  fun seek(positionSec: Double) {
    val mp = mediaPlayer ?: return
    
    if (positionSec <= 0.5) {
      try { mp.time = (positionSec * 1000.0).toLong() } catch (_: Throwable) {}
      return
    }
    
    val canSeekNow = isSeekable && (currentState == PlayerState.READY || currentState == PlayerState.PLAYING || currentState == PlayerState.PAUSED)
    
    if (canSeekNow) {
      applySeek(positionSec)
    } else {
      pendingSeekPositionSec = positionSec
      Log.d(TAG, "Seek queued: ${positionSec}s")
    }
  }
  
  private fun applySeek(positionSec: Double) {
    val mp = mediaPlayer ?: return
    try {
      val targetTime = (positionSec * 1000.0).toLong()
      mp.time = targetTime
      lastSeekRequestTime = System.currentTimeMillis()
      seekTargetTime = targetTime
      Log.d(TAG, "Seek applied to ${positionSec}s")
    } catch (_: Throwable) {}
  }

  private fun applyPendingSeekIfReady() {
    val seekPos = pendingSeekPositionSec ?: return
    if (isSeekable) {
      pendingSeekPositionSec = null
      applySeek(seekPos)
    }
  }

  fun setRate(rate: Double) {
    try { mediaPlayer?.rate = rate.toFloat() } catch (_: Throwable) {}
  }

  fun setVolume(volume: Double) {
    try { mediaPlayer?.volume = (volume * 100).toInt().coerceIn(0, 100) } catch (_: Throwable) {}
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
    mediaPlayer?.setAudioTrack(trackId)
  }
  
  fun setSubtitleTrack(trackId: Int) {
    mediaPlayer?.setSpuTrack(trackId)
  }

  override fun onSurfacesCreated(vlcVout: IVLCVout) {}
  override fun onSurfacesDestroyed(vlcVout: IVLCVout) {}
  
  override fun onNewVideoLayout(
    vlcVout: IVLCVout,
    width: Int,
    height: Int,
    visibleWidth: Int,
    visibleHeight: Int,
    sarNum: Int,
    sarDen: Int
  ) {
    Log.d(TAG, "New layout: ${width}x${height}")
    if (width > 0 && height > 0) {
      val darWidth = if (sarNum > 0 && sarDen > 0 && sarNum != sarDen) {
        (width.toDouble() * sarNum / sarDen).toInt()
      } else {
        width
      }
      cachedWidth = darWidth
      cachedHeight = height
      applyResizeMode()
      checkReadyState()
      PipController.updateVideoSizeFromNative(cachedWidth, cachedHeight)
    }
  }

  private fun parseAndSendTracks() {
    val mp = mediaPlayer ?: return
    val audioTracks = mutableListOf<Map<String, Any>>()
    val newAudioMap = mutableMapOf<Int, Int>()
    
    mp.audioTracks?.forEachIndexed { index, track ->
      if (track.id >= 0) {
        newAudioMap[index] = track.id
        audioTracks.add(mapOf(
          "id" to track.id,
          "name" to (track.name ?: "Audio $index"),
          "selected" to (mp.audioTrack == track.id)
        ))
      }
    }
    audioTrackMap = newAudioMap
    
    val subtitleTracks = mutableListOf<Map<String, Any>>()
    val newSpuMap = mutableMapOf<Int, Int>()
    
    mp.spuTracks?.forEachIndexed { index, track ->
      if (track.id >= 0) {
        newSpuMap[index] = track.id
        subtitleTracks.add(mapOf(
          "id" to track.id,
          "name" to (track.name ?: "Subtitle $index"),
          "selected" to (mp.spuTrack == track.id)
        ))
      }
    }
    spuTrackMap = newSpuMap
    
    dispatch { it.onTracksChanged(audioTracks, subtitleTracks) }
  }

  private fun dispatch(action: (Listener) -> Unit) {
    mainHandler.post {
      listeners.forEach { action(it) }
    }
  }

  private fun dispatchIsPlayingChanged(isPlaying: Boolean) {
    dispatch { 
      it.onIsPlayingChanged(isPlaying)
    }
    mainHandler.post {
      PipController.updateIsPlayingFromNative(isPlaying)
      mediaSessionHandler?.updatePlaybackState(isPlaying)
    }
  }

  private fun dispatchBufferingChanged(buffering: Boolean) {
    dispatch { it.onBufferingChanged(buffering) }
  }

  private fun ensureMediaSession() {
    if (mediaSessionHandler != null) return
    val nc = notificationCallbacks
    mediaSessionHandler = MediaSessionHandler(
      appContext,
      object : MediaSessionHandler.MediaSessionCallbacks {
        override fun onPlay() { setPaused(false) }
        override fun onPause() { setPaused(true) }
        override fun onStop() { serviceCallbacks?.onStopRequested() ?: stopPlayback() }
        override fun onSeekTo(pos: Long) { seek(pos / 1000.0) }
      },
      onNotificationUpdated = nc?.let { { n -> it.onNotificationUpdated(n) } },
      onNotificationCancelled = nc?.let { { it.onNotificationCancelled() } }
    )
  }

  fun release() {
    listeners.clear()
    mainHandler.removeCallbacksAndMessages(null)
    try {
      mediaPlayer?.vlcVout?.removeCallback(this)
      mediaPlayer?.release()
      libVLC?.release()
      mediaSessionHandler?.release()
    } catch (_: Throwable) {}
    mediaSessionHandler = null
    mediaPlayer = null
    libVLC = null
  }

  private fun encodeUrlForVlc(url: String): String {
    if (!url.contains(' ') && !url.contains('[') && !url.contains(']')) return url
    return try {
      val uri = URI(url)
      val scheme = uri.scheme ?: return url
      val host = uri.host ?: return url
      val port = uri.port
      val path = uri.rawPath ?: ""
      val query = uri.rawQuery
      val fragment = uri.rawFragment

      val encodedPath = if (path.isNotEmpty()) {
        path.split("/").joinToString("/") { segment ->
          if (segment.isEmpty()) segment else {
            val decoded = try { URLDecoder.decode(segment, "UTF-8") } catch (_: Throwable) { segment }
            URLEncoder.encode(decoded, "UTF-8").replace("+", "%20")
          }
        }
      } else path

      buildString {
        append(scheme).append("://").append(host)
        if (port != -1) append(":").append(port)
        append(encodedPath)
        if (!query.isNullOrEmpty()) append("?").append(query)
        if (!fragment.isNullOrEmpty()) append("#").append(fragment)
      }
    } catch (e: Throwable) {
      url.replace(" ", "%20")
    }
  }
}
