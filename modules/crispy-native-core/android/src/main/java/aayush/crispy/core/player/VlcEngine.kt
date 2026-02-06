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

  private var isPaused: Boolean = true
  private var hasLoadEventFired: Boolean = false
  
  private var lastEmittedIsPlaying: Boolean? = null
  private var lastEmittedBuffering: Boolean? = null
  private var firstFrameEmitted: Boolean = false
  
  private var cachedDuration: Long = 0L
  private var cachedWidth: Int = 0
  private var cachedHeight: Int = 0
  
  // Surface/container dimensions for resize calculations
  private var surfaceWidth: Int = 0
  private var surfaceHeight: Int = 0
  
  // Resize mode: contain (fit), cover (fill), stretch, original
  private var resizeMode: String = "contain"

  // Track mapping - kept for backward compatibility but now using VLC track IDs directly
  private data class TrackInfo(val id: Int, val name: String, val language: String)
  private var audioTrackMap: Map<Int, Int> = emptyMap() // Index -> VLC Track ID (deprecated)
  private var spuTrackMap: Map<Int, Int> = emptyMap()   // Index -> VLC Track ID (deprecated)

  private val progressRunnable = object : Runnable {
    override fun run() {
      val mp = mediaPlayer
      if (mp != null && !mp.isReleased) {
        try {
          val posMs = mp.time
          val durMs = mp.length
          
          // VLC might return -1 for live streams or unknown duration
          val safeDur = if (durMs > 0) durMs else cachedDuration
          if (safeDur > cachedDuration) cachedDuration = safeDur

          val posSec = if (posMs >= 0) posMs.toDouble() / 1000.0 else 0.0
          val durSec = if (safeDur > 0) safeDur.toDouble() / 1000.0 else 0.0

          listeners.forEach { it.onProgress(posSec, durSec) }
          mediaSessionHandler?.updatePosition(posSec)
          mediaSessionHandler?.updateDuration(durSec)
        } catch (e: Throwable) {
          Log.w(TAG, "Error in progressRunnable", e)
        }
      }
      mainHandler.postDelayed(this, PROGRESS_INTERVAL_MS)
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
      args.add("--network-caching=2000") // 2s buffer
      args.add("--android-display-chroma=RV32") // RV32 is generally safest for Android SurfaceView
      args.add("--no-drop-late-frames")
      args.add("--no-skip-frames")
      
      libVLC = LibVLC(appContext, args)
      mediaPlayer = MediaPlayer(libVLC)
      
      mediaPlayer?.setEventListener { event ->
        when (event.type) {
          MediaPlayer.Event.Playing -> {
            emitIsPlayingChangedIfNeeded(true)
            emitBufferingChangedIfNeeded(false)
          }
          MediaPlayer.Event.Paused -> {
            emitIsPlayingChangedIfNeeded(false)
          }
          MediaPlayer.Event.Stopped -> {
            emitIsPlayingChangedIfNeeded(false)
          }
          MediaPlayer.Event.EndReached -> {
             emitIsPlayingChangedIfNeeded(false)
             listeners.forEach { it.onEnd() }
          }
          MediaPlayer.Event.EncounteredError -> {
            listeners.forEach { it.onError("VLC encountered an error") }
          }
          MediaPlayer.Event.Buffering -> {
            // event.getBuffering() returns float 0-100
            val buffering = event.buffering < 100f
            emitBufferingChangedIfNeeded(buffering)
          }
          MediaPlayer.Event.Vout -> {
             // Vout count changed, surface attached/detached or resized
             mediaPlayer?.let { mp ->
                mp.updateVideoSurfaces() // Ensure layout
             }
             checkForLoadEvent()
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
  
  // Surface Management
  fun attachSurface(surface: Surface, width: Int, height: Int) {
      val mp = mediaPlayer ?: return
      val vout = mp.vlcVout
      if (!vout.areViewsAttached()) {
          vout.setVideoSurface(surface, null)
          vout.setWindowSize(width, height)
          vout.addCallback(this)
          vout.attachViews()
          Log.d(TAG, "Surface attached: ${width}x${height}")
      } else {
          // Update size if already attached
          vout.setWindowSize(width, height)
      }
  }

  fun setSurfaceSize(width: Int, height: Int) {
      val mp = mediaPlayer ?: return
      val vout = mp.vlcVout
      if (vout.areViewsAttached()) {
          vout.setWindowSize(width, height)
      }
      // Store dimensions for resize mode calculations
      surfaceWidth = width
      surfaceHeight = height
      applyResizeMode()
  }

  fun setResizeMode(mode: String) {
      resizeMode = mode.lowercase()
      applyResizeMode()
  }

  /**
   * Apply resize mode to VLC video output.
   * Maps resize modes to VLC's aspect ratio, crop, and scale settings.
   */
  private fun applyResizeMode() {
      val mp = mediaPlayer ?: return
      
      // Need both video and surface dimensions to calculate
      if (cachedWidth <= 0 || cachedHeight <= 0 || surfaceWidth <= 0 || surfaceHeight <= 0) {
          return
      }
      
      when (resizeMode) {
          "stretch" -> {
              // Stretch: Fill the surface regardless of aspect ratio
              // Use crop geometry to fill the entire surface
              mp.aspectRatio = null
              mp.setCropGeometry("${surfaceWidth}x${surfaceHeight}")
          }
          "cover" -> {
              // Cover: Fill surface while maintaining aspect ratio (may crop)
              mp.aspectRatio = null
              // Calculate crop to fill surface
              val videoRatio = cachedWidth.toFloat() / cachedHeight.toFloat()
              val surfaceRatio = surfaceWidth.toFloat() / surfaceHeight.toFloat()
              
              if (surfaceRatio > videoRatio) {
                  // Surface is wider than video - crop top/bottom
                  val targetHeight = (surfaceWidth / videoRatio).toInt()
                  val cropY = ((targetHeight - surfaceHeight) / 2).coerceAtLeast(0)
                  mp.setCropGeometry("${surfaceWidth}x${surfaceHeight}+0+${cropY}")
              } else {
                  // Surface is taller than video - crop left/right
                  val targetWidth = (surfaceHeight * videoRatio).toInt()
                  val cropX = ((targetWidth - surfaceWidth) / 2).coerceAtLeast(0)
                  mp.setCropGeometry("${surfaceWidth}x${surfaceHeight}+${cropX}+0")
              }
          }
          "original" -> {
              // Original: Use video's native dimensions (1:1 pixel mapping)
              mp.aspectRatio = "${cachedWidth}:${cachedHeight}"
              mp.setCropGeometry(null)
          }
          else -> {
              // Contain: Fit within surface while maintaining aspect ratio (default)
              // This is VLC's default behavior with proper aspect ratio
              val gcd = greatestCommonDivisor(cachedWidth, cachedHeight)
              val aspectW = cachedWidth / gcd
              val aspectH = cachedHeight / gcd
              mp.aspectRatio = "${aspectW}:${aspectH}"
              mp.setCropGeometry(null)
          }
      }
  }

  private fun greatestCommonDivisor(a: Int, b: Int): Int {
      return if (b == 0) a else greatestCommonDivisor(b, a % b)
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
    // Snapshot
    if (hasLoadEventFired) {
      val durSec = if (cachedDuration > 0) cachedDuration.toDouble() / 1000.0 else 0.0
      listener.onLoad(durSec, cachedWidth, cachedHeight)
    }
    // Initial tracks
    if (audioTrackMap.isNotEmpty() || spuTrackMap.isNotEmpty()) {
         // Re-parse to send current state to new listener
         parseAndSendTracks()
    }
  }

  fun removeListener(listener: Listener) {
    listeners.remove(listener)
  }

  fun setHeaders(headers: Map<String, String>?) {
    // VLC doesn't support setting headers globally easily like Exo's HttpDataSource.
    // We handle this per-media if needed, usually via :http-user-agent or :http-referrer options on the Media object.
    // For now, we'll store them and apply when setting source if feasible.
    // NOTE: LibVLC support for arbitrary headers is limited. We might need to use :http-referrer etc.
  }

  fun setSource(url: String?) {
    if (url.isNullOrBlank()) return
    hasLoadEventFired = false
    firstFrameEmitted = false
    lastEmittedBuffering = null
    lastEmittedIsPlaying = null
    cachedDuration = 0
    cachedWidth = 0
    cachedHeight = 0
    
    val mp = mediaPlayer ?: return
    val lib = libVLC ?: return

    // Encode the URL to handle spaces and special characters that VLC treats as file paths
    val encodedUrl = encodeUrlForVlc(url)

    try {
      mp.stop()
      val media = Media(lib, Uri.parse(encodedUrl))
      
      // Optimization: Hardware decoding
      media.setHWDecoderEnabled(true, false)
      
      mp.media = media
      media.release()
      
      mp.play()
      isPaused = false
      applyPlayPause() // Sync intended state
    } catch (e: Exception) {
      listeners.forEach { it.onError(e.message ?: "Failed to load media") }
    }
  }

  fun setPaused(paused: Boolean) {
    isPaused = paused
    applyPlayPause()
  }

  fun isPlaying(): Boolean = mediaPlayer?.isPlaying ?: false

  fun stopPlayback() {
    isPaused = true
    hasLoadEventFired = false
    try {
      mediaPlayer?.stop()
    } catch (_: Throwable) {}
    
    mediaSessionHandler?.updatePlaybackState(false)
    PipController.updateIsPlayingFromNative(false)
  }

  private fun applyPlayPause() {
    val mp = mediaPlayer ?: return
    try {
      if (isPaused) {
          if (mp.isPlaying) mp.pause()
      } else {
          if (!mp.isPlaying) mp.play()
      }
      mediaSessionHandler?.updatePlaybackState(!isPaused)
      PipController.updateIsPlayingFromNative(!isPaused)
    } catch (e: Exception) {
      Log.w(TAG, "Failed to apply play/pause", e)
    }
  }

  fun seek(positionSec: Double) {
    try {
      mediaPlayer?.time = (positionSec * 1000.0).toLong()
    } catch (_: Throwable) {}
  }

  fun setRate(rate: Double) {
    try {
      mediaPlayer?.rate = rate.toFloat()
    } catch (e: Exception) {
      Log.w(TAG, "Failed to set playback speed", e)
    }
  }

  fun setVolume(volume: Double) {
    try {
      mediaPlayer?.volume = (volume * 100).toInt().coerceIn(0, 100)
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
  
  // Track Selection
  // trackId is the VLC native track ID (not index), matching what we emit in parseAndSendTracks
  fun setAudioTrack(trackId: Int) {
      val mp = mediaPlayer ?: return
      if (trackId < 0) {
          // Disable audio by setting track to -1
          mp.setAudioTrack(-1)
          return
      }
      mp.setAudioTrack(trackId)
  }
  
  fun setSubtitleTrack(trackId: Int) {
      val mp = mediaPlayer ?: return
      if (trackId < 0) {
          mp.setSpuTrack(-1) // Disable subtitles
          return
      }
      mp.setSpuTrack(trackId)
  }

  // --- Internal Checks ---

  private fun checkForLoadEvent() {
      val mp = mediaPlayer ?: return
      if (hasLoadEventFired) return
      
      // Check tracks to ensure media is parsed
      val tracks = mp.media?.trackCount ?: 0
      if (tracks == 0 && mp.time <= 0) return

      // Video dimensions are set via IVLCVout.Callback.onNewVideoLayout
      // Check if we have valid cached dimensions
      if (cachedWidth <= 0 || cachedHeight <= 0) {
          // Not ready yet, dimensions will be set by onNewVideoLayout callback
          return
      }
      
      if (mp.length > 0) cachedDuration = mp.length
      val durSec = cachedDuration.toDouble() / 1000.0
      
      hasLoadEventFired = true
      listeners.forEach { it.onLoad(durSec, cachedWidth, cachedHeight) }
      
      if (!firstFrameEmitted) {
          firstFrameEmitted = true
          listeners.forEach { it.onFirstFrameRendered() }
      }
      
      PipController.updateVideoSizeFromNative(cachedWidth, cachedHeight)
  }
  
  // IVLCVout.Callback implementation
  override fun onSurfacesCreated(vlcVout: IVLCVout) {
      Log.d(TAG, "Surfaces created")
  }
  
  override fun onSurfacesDestroyed(vlcVout: IVLCVout) {
      Log.d(TAG, "Surfaces destroyed")
  }
  
  override fun onNewVideoLayout(
      vlcVout: IVLCVout,
      width: Int,
      height: Int,
      visibleWidth: Int,
      visibleHeight: Int,
      sarNum: Int,
      sarDen: Int
  ) {
      Log.d(TAG, "New video layout: ${width}x${height} (visible: ${visibleWidth}x${visibleHeight})")
      if (width > 0 && height > 0) {
          cachedWidth = width
          cachedHeight = height
          // Apply resize mode with new video dimensions
          applyResizeMode()
          // Try to fire load event now that we have dimensions
          checkForLoadEvent()
      }
  }

  private fun parseAndSendTracks() {
      val mp = mediaPlayer ?: return
      val media = mp.media ?: return
      
      // Get full track info from Media object (has language codes and descriptions)
      val allTracks = media.tracks
      if (allTracks == null || allTracks.isEmpty()) return
      
      // Audio Tracks
      val audioTracks = mutableListOf<Map<String, Any>>()
      val newAudioMap = mutableMapOf<Int, Int>()
      
      var audioIndex = 0
      for (track in allTracks) {
          if (track.type != Media.Track.Type.Audio) continue
          
          val vlcTrackId = track.id
          if (vlcTrackId < 0) continue
          
          val index = audioIndex
          newAudioMap[index] = vlcTrackId
          
          // Build track name from description and codec info
          val trackName = buildTrackName(track)
          val language = track.language ?: ""
          
          audioTracks.add(mapOf(
              "id" to vlcTrackId,  // Use VLC's native track ID for selection
              "name" to trackName,
              "language" to language,
              "selected" to (mp.audioTrack == vlcTrackId)
          ))
          audioIndex++
      }
      audioTrackMap = newAudioMap
      
      // Subtitle Tracks (Text)
      val subtitleTracks = mutableListOf<Map<String, Any>>()
      val newSpuMap = mutableMapOf<Int, Int>()
      
      var spuIndex = 0
      for (track in allTracks) {
          if (track.type != Media.Track.Type.Text) continue
          
          val vlcTrackId = track.id
          if (vlcTrackId < 0) continue
          
          val index = spuIndex
          newSpuMap[index] = vlcTrackId
          
          // Build track name from description and codec info
          val trackName = buildTrackName(track)
          val language = track.language ?: ""
          
          subtitleTracks.add(mapOf(
              "id" to vlcTrackId,  // Use VLC's native track ID for selection
              "name" to trackName,
              "language" to language,
              "selected" to (mp.spuTrack == vlcTrackId)
          ))
          spuIndex++
      }
      spuTrackMap = newSpuMap
      
      listeners.forEach { it.onTracksChanged(audioTracks, subtitleTracks) }
  }

  /**
   * Build a human-readable track name from Media.Track metadata.
   * Combines description, language, and codec information.
   */
  private fun buildTrackName(track: Media.Track): String {
      val description = track.description
      val language = track.language
      val codec = track.codec
      
      val parts = mutableListOf<String>()
      
      // Use description if available (usually contains quality/format info)
      if (!description.isNullOrBlank()) {
          parts.add(description)
      }
      
      // Add language if available and different from description
      if (!language.isNullOrBlank() && !description.equals(language, ignoreCase = true)) {
          val langDisplay = language.uppercase()
          if (!parts.any { it.contains(langDisplay, ignoreCase = true) }) {
              parts.add(langDisplay)
          }
      }
      
      // Add codec info if available and not already mentioned
      if (!codec.isNullOrBlank()) {
          val codecUpper = codec.uppercase()
          if (!parts.any { it.contains(codecUpper, ignoreCase = true) }) {
              parts.add(codecUpper)
          }
      }
      
      return if (parts.isNotEmpty()) {
          parts.joinToString(" - ")
      } else {
          when (track.type) {
              Media.Track.Type.Audio -> "Audio Track"
              Media.Track.Type.Text -> "Subtitle"
              else -> "Track"
          }
      }
  }

  private fun emitIsPlayingChangedIfNeeded(isPlaying: Boolean) {
    val prev = lastEmittedIsPlaying
    if (prev != null && prev == isPlaying) return
    lastEmittedIsPlaying = isPlaying
    listeners.forEach { it.onIsPlayingChanged(isPlaying) }
    PipController.updateIsPlayingFromNative(isPlaying)
    mediaSessionHandler?.updatePlaybackState(isPlaying)
  }

  private fun emitBufferingChangedIfNeeded(buffering: Boolean) {
    val prev = lastEmittedBuffering
    if (prev != null && prev == buffering) return
    lastEmittedBuffering = buffering
    listeners.forEach { it.onBufferingChanged(buffering) }
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
    try {
        mediaPlayer?.vlcVout?.removeCallback(this)
        mediaPlayer?.release()
        libVLC?.release()
    } catch (_: Throwable) {}
    try { mediaSessionHandler?.release() } catch (_: Throwable) {}
    mediaSessionHandler = null
    mediaPlayer = null
    libVLC = null
    latestMetadata = null
  }

  /**
   * Encodes a URL for VLC playback, ensuring special characters (especially spaces)
   * are properly percent-encoded. VLC's input_item_SetURI treats URLs with unencoded
   * spaces as local file paths, causing playback to fail.
   *
   * This function:
   * - Preserves already-encoded characters (no double-encoding)
   * - Only encodes the path component (scheme, host, port, query preserved)
   * - Handles edge cases like malformed URLs gracefully
   * - Falls back to the original URL if encoding fails
   */
  private fun encodeUrlForVlc(url: String): String {
    // Quick check: if no problematic characters, return as-is
    if (!url.contains(' ') && !url.contains('[') && !url.contains(']')) {
      return url
    }

    return try {
      // Parse the URL to extract components
      val uri = URI(url)
      val scheme = uri.scheme ?: return url
      val host = uri.host ?: return url
      val port = uri.port
      val path = uri.rawPath ?: ""
      val query = uri.rawQuery
      val fragment = uri.rawFragment

      // Encode the path: decode first to avoid double-encoding, then re-encode
      val encodedPath = if (path.isNotEmpty()) {
        path.split("/").joinToString("/") { segment ->
          if (segment.isEmpty()) {
            segment
          } else {
            // Decode first to normalize (handles already-encoded chars)
            val decoded = try {
              URLDecoder.decode(segment, "UTF-8")
            } catch (_: Throwable) {
              segment
            }
            // Re-encode with proper escaping
            URLEncoder.encode(decoded, "UTF-8")
              .replace("+", "%20")  // URLEncoder uses + for space, we need %20
              .replace("%2F", "/")  // Don't escape path separators (shouldn't happen after split)
              .replace("%3A", ":")  // Preserve colons in path (e.g., timestamps)
          }
        }
      } else {
        path
      }

      // Reconstruct the URL
      buildString {
        append(scheme)
        append("://")
        append(host)
        if (port != -1) {
          append(":")
          append(port)
        }
        append(encodedPath)
        if (!query.isNullOrEmpty()) {
          append("?")
          append(query)
        }
        if (!fragment.isNullOrEmpty()) {
          append("#")
          append(fragment)
        }
      }
    } catch (e: Throwable) {
      Log.w(TAG, "Failed to encode URL for VLC, using original: ${e.message}")
      // Fallback: simple space replacement (better than nothing)
      url.replace(" ", "%20")
    }
  }
}
