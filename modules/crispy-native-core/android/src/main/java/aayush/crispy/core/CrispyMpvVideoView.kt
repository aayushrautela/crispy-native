package aayush.crispy.core

import android.content.Context
import android.util.Log
import android.view.Surface
import android.view.SurfaceHolder
import android.view.SurfaceView
import dev.jdtech.mpv.MPVLib

import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactContext
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class CrispyMpvVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext), SurfaceHolder.Callback, MPVLib.EventObserver, PipPlaybackTarget {

    private val surfaceView = SurfaceView(context)
    private var isMpvInitialized = false
    private var pendingDataSource: String? = null
    private var isPaused: Boolean = true
    private var surface: Surface? = null
    private var httpHeaders: Map<String, String>? = null

    private var lastAppliedSurfaceW: Int = 0
    private var lastAppliedSurfaceH: Int = 0

    private var requestedResizeMode: String? = null
    private var isInPipMode: Boolean = false

    private var isReleased: Boolean = false

    companion object {
        private const val TAG = "CrispyMpvVideoView"
    }

    // Media Session Handler
    private var mediaSessionHandler: MediaSessionHandler? = null
    private var latestMetadata: MediaMetadataState? = null
    
    // Decoder mode setting: 'auto', 'sw', 'hw', 'hw+' (default: auto)
    var decoderMode: String = "auto"
    
    // GPU mode setting: 'gpu', 'gpu-next' (default: gpu)
    var gpuMode: String = "gpu"
    
    // Flag to track if onLoad has been fired
    private var hasLoadEventFired: Boolean = false

    // Event dispatchers for Expo Module
    val onLoad by EventDispatcher<Map<String, Any>>()
    val onProgress by EventDispatcher<Map<String, Any>>()
    val onEnd by EventDispatcher<Unit>()
    val onError by EventDispatcher<Map<String, String>>()
    val onTracksChanged by EventDispatcher<Map<String, Any>>()

    private var playInBackground: Boolean = false

    fun setPlayInBackground(playInBackground: Boolean) {
        this.playInBackground = playInBackground
    }

    private var resumeOnForeground = false
    private val lifeCycleListener = object : LifecycleEventListener {
        override fun onHostPause() {
            val activity = appContext.currentActivity
            val isInPip = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                activity?.isInPictureInPictureMode == true
            } else {
                false
            }

            if (isInPip) {
                Log.d(TAG, "App backgrounded but in PiP — keeping MPV playing")
                return
            }

            // If background play is enabled, don't pause
            if (playInBackground) {
                 Log.d(TAG, "App backgrounded but playInBackground is true — keeping MPV playing")
                 return
            }

            resumeOnForeground = !isPaused
            if(resumeOnForeground) {
                Log.d(TAG, "App backgrounded — pausing MPV")
                setPaused(true)
            }
        }
        override fun onHostResume() {
            if(resumeOnForeground) {
                Log.d(TAG, "App foregrounded — resuming MPV")
                setPaused(false)
                resumeOnForeground = false
            }
        }
        override fun onHostDestroy() {
            // Host is being destroyed; ensure we release native resources.
            release()
        }
    }


    init {
        // Use SurfaceView for production-grade PiP resizing.
        // TextureView frequently fails to resize its internal buffer until the PiP window is moved
        // on some OEM builds. SurfaceView receives reliable surfaceChanged callbacks on PiP resize.
        surfaceView.holder.addCallback(this)
        surfaceView.holder.setSizeFromLayout()

        addView(surfaceView, android.view.ViewGroup.LayoutParams(
            android.view.ViewGroup.LayoutParams.MATCH_PARENT, 
            android.view.ViewGroup.LayoutParams.MATCH_PARENT
        ))
        
        // Keep screen on during playback
        setKeepScreenOn(true)

        // Register lifecycle listener properly
        (context as? ReactContext)?.addLifecycleEventListener(lifeCycleListener)

        PlaybackRegistry.register(this)
    }

    override fun surfaceCreated(holder: SurfaceHolder) {
        Log.d(TAG, "Surface created")
        if (isReleased) return

        surface = holder.surface
        lastAppliedSurfaceW = 0
        lastAppliedSurfaceH = 0

        try {
            if (!isMpvInitialized) {
                MPVLib.create(context.applicationContext)
                initOptions()
                MPVLib.init()
                MPVLib.attachSurface(surface!!)
                MPVLib.addObserver(this)
                isMpvInitialized = true

                // Initialize Media Session
                mediaSessionHandler = MediaSessionHandler(context, object : MediaSessionHandler.MediaSessionCallbacks {
                    override fun onPlay() { setPaused(false) }
                    override fun onPause() { setPaused(true) }
                    override fun onStop() {
                        setPaused(true)
                        seek(0.0)
                    }
                    override fun onSeekTo(pos: Long) {
                        seek(pos / 1000.0)
                    }
                })

                // Apply any metadata received before the session was ready
                applyMetadataIfReady()

                observeProperties()

                // Ensure media session + PiP gating reflect the actual initial state even if
                // the paused prop was applied before MPV finished initializing.
                syncPlaybackAndPip()
                applyResizeMode(requestedResizeMode)

                pendingDataSource?.let { url ->
                    loadFile(url)
                    pendingDataSource = null
                    syncPlaybackAndPip()
                }
            } else {
                // Surface recreated (e.g., activity relaunch / view reattach). Rebind without
                // destroying MPV to avoid losing playback state.
                MPVLib.attachSurface(surface!!)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize/attach MPV surface", e)
            onError(mapOf("error" to "MPV surface init failed: ${e.message}"))
        }
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        if (isReleased) return
        if (width <= 0 || height <= 0) return

        if (BuildConfig.DEBUG) {
            val frame = try { holder.surfaceFrame } catch (_: Exception) { null }
            val frameStr = if (frame != null) "${frame.width()}x${frame.height()}" else "n/a"
            Log.d(TAG, "Surface changed: ${width}x${height} frame=$frameStr view=${surfaceView.width}x${surfaceView.height} (isInPipMode=$isInPipMode)")
        } else {
            Log.d(TAG, "Surface changed: ${width}x${height} (isInPipMode=$isInPipMode)")
        }
        // This is our single source of truth for render sizing.
        // SurfaceView reliably triggers this callback on PiP resize.
        updateMpvSurfaceSize(width, height)
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        Log.d(TAG, "Surface destroyed")
        surface = null

        if (isMpvInitialized) {
            try {
                MPVLib.detachSurface()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to detach MPV surface", e)
            }
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        release()
    }

    private fun release() {
        if (isReleased) return
        isReleased = true

        (context as? ReactContext)?.removeLifecycleEventListener(lifeCycleListener)
        PlaybackRegistry.unregister(this)

        mediaSessionHandler?.release()
        mediaSessionHandler = null
        latestMetadata = null

        if (isMpvInitialized) {
            try {
                MPVLib.removeObserver(this)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to remove MPV observer", e)
            }
            try {
                MPVLib.detachSurface()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to detach MPV surface", e)
            }
            try {
                MPVLib.destroy()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to destroy MPV", e)
            } finally {
                isMpvInitialized = false
            }
        }

        surface = null
    }

    private fun initOptions() {
        MPVLib.setOptionString("profile", "fast")
        MPVLib.setOptionString("vo", gpuMode)
        MPVLib.setOptionString("gpu-context", "android")
        MPVLib.setOptionString("opengl-es", "yes")
        
        val hwdecValue = when (decoderMode) {
            "auto" -> "auto-copy"
            "sw" -> "no"
            "hw" -> "mediacodec-copy"
            "hw+" -> "mediacodec"
            else -> "auto-copy"
        }
        MPVLib.setOptionString("hwdec", hwdecValue)
        MPVLib.setOptionString("target-colorspace-hint", "yes")
        
        // HDR and Dolby Vision support (ported from Nuvio)
        MPVLib.setOptionString("target-prim", "auto")
        MPVLib.setOptionString("target-trc", "auto")
        MPVLib.setOptionString("tone-mapping", "auto")
        MPVLib.setOptionString("hdr-compute-peak", "auto")
        MPVLib.setOptionString("vd-lavc-o", "strict=-2")
        MPVLib.setOptionString("vd-lavc-film-grain", "cpu")
        
        MPVLib.setOptionString("ao", "audiotrack,opensles")
        
        val cacheMegs = 100
        MPVLib.setOptionString("demuxer-max-bytes", "${cacheMegs * 1024 * 1024}")
        MPVLib.setOptionString("demuxer-max-back-bytes", "${(cacheMegs / 2) * 1024 * 1024}")
        MPVLib.setOptionString("cache", "yes")
        MPVLib.setOptionString("cache-secs", "60")
        
        MPVLib.setOptionString("network-timeout", "60")
        MPVLib.setOptionString("ytdl", "no")
        MPVLib.setOptionString("http-reconnect", "yes")
        MPVLib.setOptionString("stream-reconnect", "yes")
        MPVLib.setOptionString("tls-verify", "no")
        
        MPVLib.setOptionString("demuxer-lavf-o", "live_start_index=0,prefer_x_start=1,http_persistent=0")
        MPVLib.setOptionString("demuxer-seekable-cache", "yes")
        MPVLib.setOptionString("force-seekable", "yes")

        MPVLib.setOptionString("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        applyHttpHeadersAsOptions()
        
        MPVLib.setOptionString("sub-auto", "fuzzy")
        MPVLib.setOptionString("sub-visibility", "yes")
        MPVLib.setOptionString("embeddedfonts", "yes")
        MPVLib.setOptionString("sub-ass-override", "force")
        MPVLib.setOptionString("blend-subtitles", "no")
        MPVLib.setOptionString("sub-use-margins", "yes")
        MPVLib.setOptionString("sub-scale", "1.0")
        MPVLib.setOptionString("sub-fix-timing", "yes")
        
        MPVLib.setOptionString("osc", "no")
        MPVLib.setOptionString("osd-level", "1")
        MPVLib.setOptionString("terminal", "no")
        MPVLib.setOptionString("input-default-bindings", "no")
    }

    private fun observeProperties() {
        // MPV format constants (manually defined to match MPVLib source)
        val MPV_FORMAT_NONE = 0
        val MPV_FORMAT_FLAG = 3
        val MPV_FORMAT_INT64 = 4
        val MPV_FORMAT_DOUBLE = 5

        MPVLib.observeProperty("time-pos", MPV_FORMAT_DOUBLE)
        MPVLib.observeProperty("duration", MPV_FORMAT_DOUBLE)
        MPVLib.observeProperty("eof-reached", MPV_FORMAT_FLAG)
        MPVLib.observeProperty("pause", MPV_FORMAT_FLAG)
        MPVLib.observeProperty("track-list", MPV_FORMAT_NONE)
        MPVLib.observeProperty("width", MPV_FORMAT_INT64)
        MPVLib.observeProperty("height", MPV_FORMAT_INT64)
    }

    private fun loadFile(url: String) {
        Log.d(TAG, "Loading file: $url")
        hasLoadEventFired = false
        MPVLib.command(arrayOf("loadfile", url))
        MPVLib.setPropertyBoolean("pause", isPaused)
    }

    // Public API for Expo Module
    fun setSource(url: String?) {
        if (url == null) return
        if (isMpvInitialized) {
            loadFile(url)
        } else {
            pendingDataSource = url
        }
    }

    fun setHeaders(headers: Map<String, String>?) {
        this.httpHeaders = headers
        if (isMpvInitialized) {
            applyHttpHeadersAsOptions()
        }
    }

    private fun applyHttpHeadersAsOptions() {
        httpHeaders?.let { headers: Map<String, String> ->
            val headerString = headers.entries.joinToString(",") { "${it.key}: ${it.value}" }
            MPVLib.setOptionString("http-header-fields", headerString)
        }
    }

    /**
     * Update MPV's understanding of the surface dimensions.
     * This is the single source of truth for surface sizing.
     * Called from SurfaceHolder callbacks (surfaceChanged).
     */
     private fun updateMpvSurfaceSize(width: Int, height: Int) {
         if (!isMpvInitialized) return
         if (width <= 0 || height <= 0) return
        if (width == lastAppliedSurfaceW && height == lastAppliedSurfaceH) return

        Log.d(TAG, "Updating MPV surface size: ${width}x${height}")
        lastAppliedSurfaceW = width
        lastAppliedSurfaceH = height

        try {
            MPVLib.setPropertyString("android-surface-size", "${width}x${height}")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to set android-surface-size", e)
        }
    }

    // Keep source rect hint updated for smooth PiP transition animation
    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        if (changed && !isInPipMode) {
            val rect = android.graphics.Rect()
            if (getGlobalVisibleRect(rect) && !rect.isEmpty) {
                PipState.setSourceRectHint(rect)
            }
        }
    }

    private fun syncPlaybackAndPip() {
        val playing = !isPaused
        mediaSessionHandler?.updatePlaybackState(playing)
        PipState.isPlaying = playing
    }

    private fun applyMetadataIfReady() {
        val metadata = latestMetadata ?: return
        mediaSessionHandler?.updateMetadata(metadata.title, metadata.artist, metadata.artworkUrl)
    }

    fun setMetadata(title: String, artist: String, artworkUrl: String?) {
        val next = MediaMetadataState(title, artist, artworkUrl)
        if (next == latestMetadata) return

        Log.d(TAG, "setMetadata called: $title by $artist (artwork: $artworkUrl)")
        latestMetadata = next
        applyMetadataIfReady()
    }

    fun setPaused(paused: Boolean) {
        this.isPaused = paused
        if (isMpvInitialized) {
            MPVLib.setPropertyBoolean("pause", paused)
            syncPlaybackAndPip()
        }
    }

    fun seek(positionSec: Double) {
        if (isMpvInitialized) {
            MPVLib.command(arrayOf("seek", positionSec.toString(), "absolute"))
        }
    }

    fun setAudioTrack(trackId: Int) {
        if (isMpvInitialized) {
            if (trackId == -1) MPVLib.setPropertyString("aid", "no")
            else MPVLib.setPropertyInt("aid", trackId)
        }
    }

    fun setSubtitleTrack(trackId: Int) {
        if (isMpvInitialized) {
            if (trackId == -1) {
                MPVLib.setPropertyString("sid", "no")
                MPVLib.setPropertyString("sub-visibility", "no")
            } else {
                MPVLib.setPropertyInt("sid", trackId)
                MPVLib.setPropertyString("sub-visibility", "yes")
            }
        }
    }

    fun setResizeMode(mode: String?) {
        requestedResizeMode = mode
        applyResizeMode(mode)
    }

    private fun applyResizeMode(mode: String?) {
        if (!isMpvInitialized) return

        Log.d(TAG, "Applying resize mode: $mode (isInPipMode=$isInPipMode)")
        try {
            when (mode) {
                "cover" -> {
                    // Fill the entire surface, crop edges if needed, preserve aspect ratio
                    MPVLib.setPropertyDouble("panscan", 1.0)
                    MPVLib.setPropertyString("keepaspect", "yes")
                }
                "stretch" -> {
                    // Fill the entire surface by stretching (distorts aspect ratio)
                    MPVLib.setPropertyDouble("panscan", 0.0)
                    MPVLib.setPropertyString("keepaspect", "no")
                }
                else -> {
                    // "contain" - show entire video with black bars if needed
                    MPVLib.setPropertyDouble("panscan", 0.0)
                    MPVLib.setPropertyString("keepaspect", "yes")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to set resize mode", e)
        }
    }

    override fun onPipModeChanged(isPip: Boolean) {
        Log.d(TAG, "PiP mode changed: isPip=$isPip")
        isInPipMode = isPip

        if (BuildConfig.DEBUG) {
            val frame = try { surfaceView.holder.surfaceFrame } catch (_: Exception) { null }
            val frameStr = if (frame != null) "${frame.width()}x${frame.height()}" else "n/a"
            Log.d(TAG, "PiP mode changed: view=${surfaceView.width}x${surfaceView.height} measured=${surfaceView.measuredWidth}x${surfaceView.measuredHeight} frame=$frameStr")
        }

        if (!isPip) {
            // Restore normal layout-driven sizing when leaving PiP.
            try {
                surfaceView.holder.setSizeFromLayout()
            } catch (_: Exception) {
                // ignore
            }

            try {
                surfaceView.layoutParams = android.view.ViewGroup.LayoutParams(
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT
                )
            } catch (_: Exception) {
                // ignore
            }

            surfaceView.requestLayout()
            surfaceView.invalidate()
        }
    }

    override fun onPipWindowSizeChanged(width: Int, height: Int) {
        if (BuildConfig.DEBUG) {
            val hasSurface = surface != null
            val frame = try { surfaceView.holder.surfaceFrame } catch (_: Exception) { null }
            val frameStr = if (frame != null) "${frame.width()}x${frame.height()}" else "n/a"
            Log.d(
                TAG,
                "onPipWindowSizeChanged requested=${width}x${height} isReleased=$isReleased isInPipMode=$isInPipMode isMpvInitialized=$isMpvInitialized hasSurface=$hasSurface view=${surfaceView.width}x${surfaceView.height} measured=${surfaceView.measuredWidth}x${surfaceView.measuredHeight} frame=$frameStr"
            )
        }

        if (isReleased) return
        if (!isInPipMode) return
        if (!isMpvInitialized) return
        if (surface == null) return
        if (width <= 0 || height <= 0) return

        try {
            // Force the Surface buffer size to match the PiP window bounds.
            surfaceView.holder.setFixedSize(width, height)

            if (BuildConfig.DEBUG) {
                val frame = try { surfaceView.holder.surfaceFrame } catch (_: Exception) { null }
                val frameStr = if (frame != null) "${frame.width()}x${frame.height()}" else "n/a"
                Log.d(TAG, "setFixedSize(${width}x${height}) applied; frame now=$frameStr")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to set fixed Surface size", e)
        }

        try {
            // Also pin the view size in PiP to avoid relying on delayed relayout.
            val lp = surfaceView.layoutParams
            if (lp != null && (lp.width != width || lp.height != height)) {
                lp.width = width
                lp.height = height
                surfaceView.layoutParams = lp

                if (BuildConfig.DEBUG) {
                    Log.d(TAG, "Pinned SurfaceView layoutParams to ${width}x${height}")
                }
            }
        } catch (_: Exception) {
            // ignore
        }

        surfaceView.requestLayout()
        surfaceView.invalidate()

        if (BuildConfig.DEBUG) {
            Log.d(TAG, "post-resize view=${surfaceView.width}x${surfaceView.height} measured=${surfaceView.measuredWidth}x${surfaceView.measuredHeight}")
        }
        updateMpvSurfaceSize(width, height)
    }

    override fun pauseFromPipDismissed() {
        setPaused(true)
    }

    // Subtitle Styling (Ported from Nuvio)
    fun setSubtitleSize(size: Int) {
        if (isMpvInitialized) MPVLib.setPropertyInt("sub-font-size", size)
    }

    fun setSubtitleColor(color: String) {
        if (isMpvInitialized) {
            val mpvColor = if (color.length == 7) "#FF${color.substring(1)}" else color
            MPVLib.setPropertyString("sub-color", mpvColor)
        }
    }

    fun setSubtitleBackgroundColor(color: String, opacity: Float) {
        if (isMpvInitialized) {
            val alphaHex = (opacity * 255).toInt().coerceIn(0, 255).let { String.format("%02X", it) }
            val baseColor = if (color.startsWith("#")) color.substring(1) else color
            val mpvColor = "#${alphaHex}${baseColor.takeLast(6)}"
            MPVLib.setPropertyString("sub-back-color", mpvColor)
        }
    }

    fun setSubtitleBorderSize(size: Int) {
        if (isMpvInitialized) MPVLib.setPropertyInt("sub-border-size", size)
    }

    fun setSubtitleBorderColor(color: String) {
        if (isMpvInitialized) {
            val mpvColor = if (color.length == 7) "#FF${color.substring(1)}" else color
            MPVLib.setPropertyString("sub-border-color", mpvColor)
        }
    }

    fun setSubtitlePosition(pos: Int) {
        if (isMpvInitialized) MPVLib.setPropertyInt("sub-pos", pos)
    }

    fun setSubtitleDelay(delaySec: Double) {
        if (isMpvInitialized) MPVLib.setPropertyDouble("sub-delay", delaySec)
    }

    fun setSubtitleBold(bold: Boolean) {
        if (isMpvInitialized) MPVLib.setPropertyString("sub-bold", if (bold) "yes" else "no")
    }

    fun setSubtitleItalic(italic: Boolean) {
        if (isMpvInitialized) MPVLib.setPropertyString("sub-italic", if (italic) "yes" else "no")
    }

    // MPVLib.EventObserver
    override fun eventProperty(property: String) {
        if (property == "track-list") parseAndSendTracks()
    }

    override fun eventProperty(property: String, value: Long) {}
    override fun eventProperty(property: String, value: Boolean) {
        when (property) {
            "eof-reached" -> {
                if (value) onEnd(Unit)
            }
            "pause" -> {
                // Keep state consistent even if pause changes from native controls.
                isPaused = value
                syncPlaybackAndPip()
            }
        }
    }
    override fun eventProperty(property: String, value: String) {}
    override fun eventProperty(property: String, value: Double) {
        when (property) {
            "time-pos" -> {
                val duration = MPVLib.getPropertyDouble("duration") ?: 0.0
                onProgress(mapOf("position" to value, "duration" to duration))
                
                mediaSessionHandler?.updatePosition(value)
                mediaSessionHandler?.updateDuration(duration)
            }
            "duration" -> {
                if (!hasLoadEventFired && value > 0) {
                    val width = MPVLib.getPropertyInt("width") ?: 0
                    val height = MPVLib.getPropertyInt("height") ?: 0
                     if (width > 0 && height > 0) {
                          hasLoadEventFired = true
                          onLoad(mapOf("duration" to value, "width" to width, "height" to height))

                           PipState.setAspectRatio(width.toDouble(), height.toDouble())
                       }
                  }
              }
        }
    }

    override fun event(eventId: Int) {
        // Handle core events like MPV_EVENT_FILE_LOADED if needed
        val MPV_EVENT_FILE_LOADED = 8
        val MPV_EVENT_END_FILE = 7
        
        if (eventId == MPV_EVENT_FILE_LOADED && !isPaused) {
             MPVLib.setPropertyBoolean("pause", false)
             val playing = !isPaused
             mediaSessionHandler?.updatePlaybackState(playing)
             PipState.isPlaying = playing
        }
    }

    private fun parseAndSendTracks() {
        try {
            val trackCount = MPVLib.getPropertyInt("track-list/count") ?: 0
            val audioTracks = mutableListOf<Map<String, Any>>()
            val subtitleTracks = mutableListOf<Map<String, Any>>()
            
            for (i in 0 until trackCount) {
                val type = MPVLib.getPropertyString("track-list/$i/type") ?: continue
                val id = MPVLib.getPropertyInt("track-list/$i/id") ?: continue
                val title = MPVLib.getPropertyString("track-list/$i/title") ?: ""
                val lang = MPVLib.getPropertyString("track-list/$i/lang") ?: ""
                
                val track = mapOf(
                    "id" to id,
                    "name" to if (title.isNotEmpty()) title else lang.uppercase(),
                    "language" to lang
                )
                
                when (type) {
                    "audio" -> audioTracks.add(track)
                    "sub" -> subtitleTracks.add(track)
                }
            }
            onTracksChanged(mapOf("audioTracks" to audioTracks, "subtitleTracks" to subtitleTracks))
        } catch (e: Exception) {}
    }
}
