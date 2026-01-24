package aayush.crispy.core

import android.content.Context
import android.graphics.SurfaceTexture
import android.util.AttributeSet
import android.util.Log
import android.view.Surface
import android.view.TextureView
import dev.jdtech.mpv.MPVLib

import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactContext
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class CrispyVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext), TextureView.SurfaceTextureListener, MPVLib.EventObserver {

    companion object {
        private const val TAG = "CrispyVideoView"
    }

    private val surfaceView = TextureView(context)
    private var isMpvInitialized = false
    private var pendingDataSource: String? = null
    private var isPaused: Boolean = true
    private var surface: Surface? = null
    private var httpHeaders: Map<String, String>? = null

    // Media Session Handler
    private var mediaSessionHandler: MediaSessionHandler? = null
    
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
            mediaSessionHandler?.release()
        }
    }

    init {
        surfaceView.surfaceTextureListener = this
        surfaceView.isOpaque = false
        addView(surfaceView, android.view.ViewGroup.LayoutParams(
            android.view.ViewGroup.LayoutParams.MATCH_PARENT, 
            android.view.ViewGroup.LayoutParams.MATCH_PARENT
        ))
        
        // Keep screen on during playback
        setKeepScreenOn(true)

        // Register lifecycle listener properly
        (context as? ReactContext)?.addLifecycleEventListener(lifeCycleListener)
    }

    override fun onSurfaceTextureAvailable(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        Log.d(TAG, "Surface texture available: ${width}x${height}")
        try {
            surface = Surface(surfaceTexture)
            
            MPVLib.create(context.applicationContext)
            initOptions()
            MPVLib.init()
            MPVLib.attachSurface(surface!!)
            MPVLib.addObserver(this)
            
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
            
            MPVLib.setPropertyString("android-surface-size", "${width}x${height}")
            observeProperties()
            isMpvInitialized = true
            
            pendingDataSource?.let { url ->
                loadFile(url)
                pendingDataSource = null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize MPV", e)
            onError(mapOf("error" to "MPV initialization failed: ${e.message}"))
        }
    }

    override fun onSurfaceTextureSizeChanged(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        if (isMpvInitialized) {
            MPVLib.setPropertyString("android-surface-size", "${width}x${height}")
        }
    }

    override fun onSurfaceTextureDestroyed(surfaceTexture: SurfaceTexture): Boolean {
        Log.d(TAG, "Surface texture destroyed")
        (context as? ReactContext)?.removeLifecycleEventListener(lifeCycleListener)
        if (isMpvInitialized) {
            MPVLib.removeObserver(this)
            MPVLib.detachSurface()
            MPVLib.destroy()
            isMpvInitialized = false
        }
        surface?.release()
        surface = null
        return true
    }

    override fun onSurfaceTextureUpdated(surfaceTexture: SurfaceTexture) {}

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
        
        val cacheMegs = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) 64 else 32
        MPVLib.setOptionString("demuxer-max-bytes", "${cacheMegs * 1024 * 1024}")
        MPVLib.setOptionString("demuxer-max-back-bytes", "${cacheMegs * 1024 * 1024}")
        MPVLib.setOptionString("cache", "yes")
        MPVLib.setOptionString("cache-secs", "30")
        
        MPVLib.setOptionString("network-timeout", "60")
        MPVLib.setOptionString("http-reconnect", "yes")
        MPVLib.setOptionString("stream-reconnect", "yes")
        
        applyHttpHeadersAsOptions()
        
        MPVLib.setOptionString("sub-auto", "fuzzy")
        MPVLib.setOptionString("sub-visibility", "yes")
        MPVLib.setOptionString("embeddedfonts", "yes")
        MPVLib.setOptionString("sub-ass-override", "force")
        
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

    fun setMetadata(title: String, artist: String, artworkUrl: String?) {
        // Log.d(TAG, "Updating metadata: $title by $artist (artwork: $artworkUrl)")
        mediaSessionHandler?.updateMetadata(title, artist, artworkUrl)
    }

    fun setPaused(paused: Boolean) {
        this.isPaused = paused
        if (isMpvInitialized) {
            MPVLib.setPropertyBoolean("pause", paused)
            mediaSessionHandler?.updatePlaybackState(!paused)
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
        if (isMpvInitialized) {
            when (mode) {
                "cover" -> MPVLib.setPropertyDouble("panscan", 1.0)
                "stretch" -> {
                    MPVLib.setPropertyDouble("panscan", 0.0)
                    MPVLib.setPropertyString("keepaspect", "no")
                }
                else -> {
                    MPVLib.setPropertyDouble("panscan", 0.0)
                    MPVLib.setPropertyString("keepaspect", "yes")
                }
            }
        }
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
        if (property == "eof-reached" && value) onEnd(Unit)
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

                        // Update Activity PiP params proactively for auto-PiP
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                            val activity = appContext.currentActivity
                            val builder = android.app.PictureInPictureParams.Builder()
                            try {
                                builder.setAspectRatio(android.util.Rational(width, height))
                                activity?.setPictureInPictureParams(builder.build())
                            } catch (e: Exception) {}
                        }
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
