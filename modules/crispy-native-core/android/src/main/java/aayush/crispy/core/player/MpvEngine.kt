package aayush.crispy.core.player

import android.app.Notification
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Surface
import dev.jdtech.mpv.MPVLib
import java.lang.ref.WeakReference
import java.util.concurrent.CopyOnWriteArraySet

import aayush.crispy.core.pip.PipController

class MpvEngine(
  private val appContext: Context,
  private val notificationCallbacks: NotificationCallbacks? = null,
  private val serviceCallbacks: ServiceCallbacks? = null
) : MPVLib.EventObserver {

  companion object {
    private const val TAG = "MpvEngine"
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
    fun onProgress(position: Double, duration: Double)
    fun onEnd()
    fun onError(error: String)
    fun onTracksChanged(audioTracks: List<Map<String, Any>>, subtitleTracks: List<Map<String, Any>>)

    // Optional state callbacks (used by PlayerActivity overlay)
    fun onIsPlayingChanged(isPlaying: Boolean) {}
    fun onBufferingChanged(buffering: Boolean) {}
    fun onFirstFrameRendered() {}
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private val listeners = CopyOnWriteArraySet<Listener>()

  private var isCreated = false
  private var isInitialized = false

  private var currentSurfaceRef: WeakReference<Surface>? = null
  private var lastSurfaceW: Int = 0
  private var lastSurfaceH: Int = 0

  private var pendingSource: String? = null
  private var pendingHeaders: Map<String, String>? = null

  private var decoderMode: String = "auto"
  private var gpuMode: String = "gpu"

  private var requestedResizeMode: String? = null
  private var isPaused: Boolean = true

  private var pendingRate: Double? = null
  private var pendingVolume: Double? = null

  private var lastEmittedIsPlaying: Boolean? = null
  private var lastEmittedBuffering: Boolean? = null
  private var firstFrameEmitted: Boolean = false

  private var durationSec: Double = 0.0
  private var lastPositionSec: Double = 0.0
  private var videoW: Int = 0
  private var videoH: Int = 0
  private var hasLoadEventFired = false

  private var latestTitle: String = ""
  private var latestArtist: String = ""
  private var latestArtworkUrl: String? = null

  // Media session + notification lives in-process; reuse existing handler.
  private var mediaSessionHandler: aayush.crispy.core.MediaSessionHandler? = null

  fun addListener(listener: Listener) {
    listeners.add(listener)
    // Push a minimal snapshot so UI doesn't wait for the next property tick.
    if (hasLoadEventFired && durationSec > 0.0 && videoW > 0 && videoH > 0) {
      safeEmit { listener.onLoad(durationSec, videoW, videoH) }
    }
    // IMPORTANT: don't call into MPVLib here. MPV may not be initialized yet and calling
    // getProperty* can crash the process (native mutex teardown races).
    safeEmit { listener.onProgress(lastPositionSec, durationSec) }
  }

  fun removeListener(listener: Listener) {
    listeners.remove(listener)
  }

  fun setDecoderMode(mode: String?) {
    decoderMode = (mode ?: "auto")
  }

  fun setGpuMode(mode: String?) {
    gpuMode = (mode ?: "gpu")
  }

  fun setHeaders(headers: Map<String, String>?) {
    pendingHeaders = headers
    // NOTE: MPV options are applied at init time; changing headers while initialized is
    // not guaranteed to affect the current playback.
  }

  fun attachSurface(surface: Surface, width: Int, height: Int) {
    currentSurfaceRef = WeakReference(surface)
    lastSurfaceW = width
    lastSurfaceH = height

    // Do not force initialization here; init is triggered by setSource() so that decoder/gpu
    // options set from props are applied before MPVLib.init().
    if (!isInitialized) return

    try {
      MPVLib.attachSurface(surface)
    } catch (t: Throwable) {
      Log.w(TAG, "attachSurface failed", t)
    }
    setSurfaceSize(width, height)
  }

  fun detachSurface() {
    currentSurfaceRef = null
    try {
      MPVLib.detachSurface()
    } catch (_: Throwable) {
      // ignore
    }
  }

  fun setSurfaceSize(width: Int, height: Int) {
    if (width <= 0 || height <= 0) return
    lastSurfaceW = width
    lastSurfaceH = height
    if (!isInitialized) return

    try {
      MPVLib.setPropertyString("android-surface-size", "${width}x${height}")
    } catch (t: Throwable) {
      Log.w(TAG, "Failed to set android-surface-size", t)
    }
  }

  fun setSource(url: String?) {
    if (url.isNullOrBlank()) return
    pendingSource = url
    hasLoadEventFired = false
    durationSec = 0.0
    videoW = 0
    videoH = 0
    firstFrameEmitted = false
    lastEmittedBuffering = null
    lastEmittedIsPlaying = null

    ensureInitialized()
    try {
      MPVLib.command(arrayOf("loadfile", url))

      // Apply the latest pause state immediately (setPaused() may have been called before init).
      try { MPVLib.setPropertyBoolean("pause", isPaused) } catch (_: Throwable) {}
      ensureMediaSession()
      mediaSessionHandler?.updatePlaybackState(!isPaused)
      PipController.updateIsPlayingFromNative(!isPaused)

      emitIsPlayingChangedIfNeeded(!isPaused)
      emitBufferingChangedIfNeeded(false)
    } catch (t: Throwable) {
      emitError("Failed to load media")
    }
  }

  fun setPaused(paused: Boolean) {
    isPaused = paused
    if (!isInitialized) return

    try {
      MPVLib.setPropertyBoolean("pause", paused)
      mediaSessionHandler?.updatePlaybackState(!paused)
      PipController.updateIsPlayingFromNative(!paused)
      emitIsPlayingChangedIfNeeded(!paused)
    } catch (t: Throwable) {
      Log.w(TAG, "Failed to set pause", t)
    }
  }

  fun setRate(rate: Double) {
    val safe = rate.coerceIn(0.25, 4.0)
    pendingRate = safe
    if (!isInitialized) return
    try {
      MPVLib.setPropertyDouble("speed", safe)
    } catch (_: Throwable) {
      // ignore
    }
  }

  fun setVolume(volume: Double) {
    val safe = volume.coerceIn(0.0, 1.0)
    pendingVolume = safe
    if (!isInitialized) return
    try {
      // mpv volume is 0-100
      MPVLib.setPropertyDouble("volume", safe * 100.0)
    } catch (_: Throwable) {
      // ignore
    }
  }

  fun seek(positionSec: Double) {
    if (!isInitialized) return
    try {
      MPVLib.command(arrayOf("seek", positionSec.toString(), "absolute"))
    } catch (_: Throwable) {
      // ignore
    }
  }

  fun setAudioTrack(trackId: Int) {
    if (!isInitialized) return
    try {
      if (trackId == -1) MPVLib.setPropertyString("aid", "no")
      else MPVLib.setPropertyInt("aid", trackId)
    } catch (_: Throwable) {
      // ignore
    }
  }

  fun setSubtitleTrack(trackId: Int) {
    if (!isInitialized) return
    try {
      if (trackId == -1) MPVLib.setPropertyString("sid", "no")
      else MPVLib.setPropertyInt("sid", trackId)
    } catch (_: Throwable) {
      // ignore
    }
  }

  fun setResizeMode(mode: String?) {
    requestedResizeMode = mode
    applyResizeMode(mode)
  }

  fun setMetadata(title: String, artist: String, artworkUrl: String?) {
    latestTitle = title
    latestArtist = artist
    latestArtworkUrl = artworkUrl
    ensureMediaSession()
    mediaSessionHandler?.updateMetadata(title, artist, artworkUrl)
  }

  fun setSubtitleSize(size: Int) = setPropInt("sub-font-size", size)
  fun setSubtitleColor(color: String) = setPropString("sub-color", color)
  fun setSubtitleBackgroundColor(color: String, opacity: Float) {
    // mpv expects RRGGBBAA
    val safeOpacity = opacity.coerceIn(0f, 1f)
    val alpha = (safeOpacity * 255f).toInt().coerceIn(0, 255)
    val alphaHex = alpha.toString(16).padStart(2, '0')
    setPropString("sub-back-color", color + alphaHex)
  }
  fun setSubtitleBorderSize(size: Int) = setPropInt("sub-border-size", size)
  fun setSubtitleBorderColor(color: String) = setPropString("sub-border-color", color)
  fun setSubtitlePosition(pos: Int) = setPropInt("sub-pos", pos)
  fun setSubtitleDelay(delaySec: Double) = setPropDouble("sub-delay", delaySec)
  fun setSubtitleBold(bold: Boolean) = setPropBoolean("sub-bold", bold)
  fun setSubtitleItalic(italic: Boolean) = setPropBoolean("sub-italic", italic)

  fun release() {
    listeners.clear()
    try {
      mediaSessionHandler?.release()
    } catch (_: Throwable) {
      // ignore
    }
    mediaSessionHandler = null

    if (!isCreated) return
    // Mark inactive before tearing down mpv to avoid races calling into a destroyed instance.
    isInitialized = false
    isCreated = false
    try {
      MPVLib.removeObserver(this)
    } catch (_: Throwable) {
      // ignore
    }
    try {
      MPVLib.detachSurface()
    } catch (_: Throwable) {
      // ignore
    }
    try {
      MPVLib.destroy()
    } catch (_: Throwable) {
      // ignore
    }
    isCreated = false
    isInitialized = false
  }

  private fun ensureMediaSession() {
    if (mediaSessionHandler != null) return
    val nc = notificationCallbacks
    mediaSessionHandler = aayush.crispy.core.MediaSessionHandler(
      appContext,
      object : aayush.crispy.core.MediaSessionHandler.MediaSessionCallbacks {
        override fun onPlay() { setPaused(false) }
        override fun onPause() { setPaused(true) }
        override fun onStop() {
          val svcCb = serviceCallbacks
          if (svcCb != null) {
            svcCb.onStopRequested()
          } else {
            stopPlayback()
          }
        }
        override fun onSeekTo(pos: Long) { seek(pos / 1000.0) }
      },
      onNotificationUpdated = if (nc != null) ({ n -> nc.onNotificationUpdated(n) }) else null,
      onNotificationCancelled = if (nc != null) ({ nc.onNotificationCancelled() }) else null
    )
    mediaSessionHandler?.updateMetadata(latestTitle, latestArtist, latestArtworkUrl)
    mediaSessionHandler?.updatePlaybackState(!isPaused)
  }

  fun isPlaying(): Boolean = isInitialized && !isPaused

  fun stopPlayback() {
    pendingSource = null
    durationSec = 0.0
    videoW = 0
    videoH = 0
    hasLoadEventFired = false

    if (!isInitialized) {
      isPaused = true
      PipController.updateIsPlayingFromNative(false)
      return
    }

    try {
      MPVLib.command(arrayOf("stop"))
    } catch (_: Throwable) {
      // ignore
    }
    setPaused(true)
  }

  private fun ensureInitialized() {
    ensureCreated() ?: return
    if (isInitialized) return

    try {
      initOptions()
      MPVLib.init()
      isInitialized = true

      MPVLib.addObserver(this)
      observeProperties()
      ensureMediaSession()

      // If a surface arrived before init completed.
      val surface = currentSurfaceRef?.get()
      if (surface != null) {
        try { MPVLib.attachSurface(surface) } catch (_: Throwable) {}
        if (lastSurfaceW > 0 && lastSurfaceH > 0) setSurfaceSize(lastSurfaceW, lastSurfaceH)
      }

      // If source was set before init.
      pendingSource?.let {
        try { MPVLib.command(arrayOf("loadfile", it)) } catch (_: Throwable) {}
      }

      // Ensure pause state is applied after init/load.
      try { MPVLib.setPropertyBoolean("pause", isPaused) } catch (_: Throwable) {}

      // Apply any JS-driven knobs that may have been set pre-init.
      pendingRate?.let { r ->
        try { MPVLib.setPropertyDouble("speed", r) } catch (_: Throwable) {}
      }
      pendingVolume?.let { v ->
        try { MPVLib.setPropertyDouble("volume", v * 100.0) } catch (_: Throwable) {}
      }

      mediaSessionHandler?.updatePlaybackState(!isPaused)
      PipController.updateIsPlayingFromNative(!isPaused)
      emitIsPlayingChangedIfNeeded(!isPaused)
    } catch (t: Throwable) {
      emitError("Failed to initialize player")
    }
  }

  private fun ensureCreated(): Unit? {
    if (isCreated) return Unit
    return try {
      MPVLib.create(appContext)
      isCreated = true
      Unit
    } catch (t: Throwable) {
      emitError("Failed to create player")
      null
    }
  }

  private fun initOptions() {
    // Keep these in sync with the previous view-owned implementation.
    MPVLib.setOptionString("profile", "fast")

    MPVLib.setOptionString("vo", gpuMode)
    MPVLib.setOptionString("gpu-context", "android")
    MPVLib.setOptionString("opengl-es", "yes")

    when (decoderMode.lowercase()) {
      "sw" -> MPVLib.setOptionString("hwdec", "no")
      "hw" -> MPVLib.setOptionString("hwdec", "mediacodec-copy")
      "hw+" -> MPVLib.setOptionString("hwdec", "mediacodec")
      else -> MPVLib.setOptionString("hwdec", "auto-copy")
    }

    // HDR / rendering options
    MPVLib.setOptionString("target-peak", "0")
    MPVLib.setOptionString("tone-mapping", "auto")
    MPVLib.setOptionString("tone-mapping-mode", "auto")

    // Audio
    MPVLib.setOptionString("ao", "audiotrack,opensles")

    // Network / caching
    MPVLib.setOptionString("cache", "yes")
    MPVLib.setOptionString("cache-secs", "60")
    MPVLib.setOptionString("demuxer-max-bytes", "500M")
    MPVLib.setOptionString("demuxer-readahead-secs", "10")

    // Defaults / UX
    MPVLib.setOptionString("osc", "no")
    MPVLib.setOptionString("osd-level", "0")
    MPVLib.setOptionString("input-default-bindings", "no")

    // User agent
    MPVLib.setOptionString(
      "user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    applyHttpHeadersAsOptions(pendingHeaders)

    // Subtitles
    MPVLib.setOptionString("sub-auto", "fuzzy")
    MPVLib.setOptionString("sub-font", "sans")
    MPVLib.setOptionString("sub-font-size", "40")
    MPVLib.setOptionString("sub-color", "#FFFFFF")
    MPVLib.setOptionString("sub-border-color", "#000000")
    MPVLib.setOptionString("sub-border-size", "2")

    // Resize mode should be applied after init via properties.
  }

  private fun applyHttpHeadersAsOptions(headers: Map<String, String>?) {
    if (headers == null) return
    if (headers.isEmpty()) return

    try {
      val headerString = headers.entries.joinToString("\r\n") { (k, v) -> "$k: $v" }
      MPVLib.setOptionString("http-header-fields", headerString)
    } catch (_: Throwable) {
      // ignore
    }
  }

  private fun observeProperties() {
    try {
      // Format constants from MPVLib.MpvFormat
      val MPV_FORMAT_DOUBLE = 5
      val MPV_FORMAT_FLAG = 3
      val MPV_FORMAT_INT64 = 4
      val MPV_FORMAT_NONE = 0

      MPVLib.observeProperty("time-pos", MPV_FORMAT_DOUBLE)
      MPVLib.observeProperty("duration", MPV_FORMAT_DOUBLE)
      MPVLib.observeProperty("eof-reached", MPV_FORMAT_FLAG)
      MPVLib.observeProperty("pause", MPV_FORMAT_FLAG)
      MPVLib.observeProperty("paused-for-cache", MPV_FORMAT_FLAG)
      MPVLib.observeProperty("track-list", MPV_FORMAT_NONE)
      MPVLib.observeProperty("width", MPV_FORMAT_INT64)
      MPVLib.observeProperty("height", MPV_FORMAT_INT64)

      // First-frame-ish signal.
      MPVLib.observeProperty("vo-configured", MPV_FORMAT_FLAG)
    } catch (_: Throwable) {
      // ignore
    }
  }

  private fun emitIsPlayingChangedIfNeeded(isPlaying: Boolean) {
    val prev = lastEmittedIsPlaying
    if (prev != null && prev == isPlaying) return
    lastEmittedIsPlaying = isPlaying
    safeEmit { listeners.forEach { it.onIsPlayingChanged(isPlaying) } }
  }

  private fun emitBufferingChangedIfNeeded(buffering: Boolean) {
    val prev = lastEmittedBuffering
    if (prev != null && prev == buffering) return
    lastEmittedBuffering = buffering
    safeEmit { listeners.forEach { it.onBufferingChanged(buffering) } }
  }

  private fun emitFirstFrameRenderedIfNeeded() {
    if (firstFrameEmitted) return
    firstFrameEmitted = true
    safeEmit { listeners.forEach { it.onFirstFrameRendered() } }
  }

  private fun applyResizeMode(mode: String?) {
    if (!isInitialized) return
    try {
      when (mode) {
        "cover" -> {
          MPVLib.setPropertyDouble("panscan", 1.0)
          MPVLib.setPropertyBoolean("keepaspect", true)
        }
        "stretch" -> {
          MPVLib.setPropertyDouble("panscan", 0.0)
          MPVLib.setPropertyBoolean("keepaspect", false)
        }
        else -> {
          MPVLib.setPropertyDouble("panscan", 0.0)
          MPVLib.setPropertyBoolean("keepaspect", true)
        }
      }
    } catch (_: Throwable) {
      // ignore
    }
  }

  private fun setPropString(name: String, value: String) {
    if (!isInitialized) return
    try { MPVLib.setPropertyString(name, value) } catch (_: Throwable) {}
  }
  private fun setPropInt(name: String, value: Int) {
    if (!isInitialized) return
    try { MPVLib.setPropertyInt(name, value) } catch (_: Throwable) {}
  }
  private fun setPropDouble(name: String, value: Double) {
    if (!isInitialized) return
    try { MPVLib.setPropertyDouble(name, value) } catch (_: Throwable) {}
  }
  private fun setPropBoolean(name: String, value: Boolean) {
    if (!isInitialized) return
    try { MPVLib.setPropertyBoolean(name, value) } catch (_: Throwable) {}
  }

  private fun emitError(message: String) {
    safeEmit {
      listeners.forEach { it.onError(message) }
    }
  }

  private fun safeEmit(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      try { block() } catch (_: Throwable) {}
      return
    }
    mainHandler.post {
      try { block() } catch (_: Throwable) {}
    }
  }

  private fun getTimePosUnsafe(): Double {
    if (!isInitialized) return lastPositionSec
    return try {
      MPVLib.getPropertyDouble("time-pos") ?: lastPositionSec
    } catch (_: Throwable) {
      lastPositionSec
    }
  }

  private fun parseAndSendTracks() {
    val audioTracks = mutableListOf<Map<String, Any>>()
    val subtitleTracks = mutableListOf<Map<String, Any>>()

    try {
      val count = MPVLib.getPropertyInt("track-list/count") ?: 0
      for (i in 0 until count) {
        val type = MPVLib.getPropertyString("track-list/$i/type") ?: continue
        val id = MPVLib.getPropertyInt("track-list/$i/id") ?: continue
        val title = MPVLib.getPropertyString("track-list/$i/title")
        val lang = MPVLib.getPropertyString("track-list/$i/lang")

        val selected: Boolean = try {
          val vInt = MPVLib.getPropertyInt("track-list/$i/selected")
          if (vInt != null) {
            vInt != 0
          } else {
            val vStr = MPVLib.getPropertyString("track-list/$i/selected")
            vStr == "yes" || vStr == "true" || vStr == "1"
          }
        } catch (_: Throwable) {
          false
        }

        val name = when {
          !title.isNullOrBlank() -> title
          !lang.isNullOrBlank() -> lang
          else -> "Track $id"
        }
        val safeLang = lang ?: ""

        val entry: Map<String, Any> = mapOf(
          "id" to id,
          "name" to name,
          "language" to safeLang,
          "selected" to selected
        )

        if (type == "audio") audioTracks.add(entry)
        if (type == "sub") subtitleTracks.add(entry)
      }
    } catch (_: Throwable) {
      // ignore
    }

    safeEmit {
      listeners.forEach { it.onTracksChanged(audioTracks, subtitleTracks) }
    }
  }

  // --- MPV observer callbacks ---
  override fun eventProperty(property: String) {
    if (property == "track-list") {
      parseAndSendTracks()
    }
  }

  override fun eventProperty(property: String, value: Long) {
    when (property) {
      "width" -> {
        if (value > 0) {
          videoW = value.toInt()
          maybeEmitLoad()
        }
      }
      "height" -> {
        if (value > 0) {
          videoH = value.toInt()
          maybeEmitLoad()
        }
      }
    }
  }

  override fun eventProperty(property: String, value: Boolean) {
    when (property) {
      "pause" -> {
        isPaused = value
        ensureMediaSession()
        mediaSessionHandler?.updatePlaybackState(!value)
        PipController.updateIsPlayingFromNative(!value)
        emitIsPlayingChangedIfNeeded(!value)
      }
      "paused-for-cache" -> {
        emitBufferingChangedIfNeeded(value)
      }
      "vo-configured" -> {
        if (value) emitFirstFrameRenderedIfNeeded()
      }
      "eof-reached" -> {
        if (value) {
          safeEmit { listeners.forEach { it.onEnd() } }
        }
      }
    }
  }

  override fun eventProperty(property: String, value: String) {
    // unused
  }

  override fun eventProperty(property: String, value: Double) {
    when (property) {
      "duration" -> {
        if (value > 0.0) {
          durationSec = value
          ensureMediaSession()
          mediaSessionHandler?.updateDuration(value)
          maybeEmitLoad()
        }
      }
      "time-pos" -> {
        val pos = value
        lastPositionSec = pos
        val dur = durationSec
        safeEmit { listeners.forEach { it.onProgress(pos, dur) } }
        ensureMediaSession()
        mediaSessionHandler?.updatePosition(pos)
      }
    }
  }

  override fun event(eventId: Int) {
    // Best-effort: apply requested resize mode after file load.
    // MPV_EVENT_FILE_LOADED = 8 (from MPVLib.MpvEvent)
    if (eventId == 8) {
      applyResizeMode(requestedResizeMode)
      // Keep pause state authoritative.
      try { MPVLib.setPropertyBoolean("pause", isPaused) } catch (_: Throwable) {}
      ensureMediaSession()
      mediaSessionHandler?.updatePlaybackState(!isPaused)
    }
  }

  private fun maybeEmitLoad() {
    if (hasLoadEventFired) return
    val dur = durationSec
    if (dur <= 0.0) return

    if (videoW <= 0 || videoH <= 0) return

    hasLoadEventFired = true
    safeEmit { listeners.forEach { it.onLoad(dur, videoW, videoH) } }
    PipController.updateVideoSizeFromNative(videoW, videoH)
  }
}
