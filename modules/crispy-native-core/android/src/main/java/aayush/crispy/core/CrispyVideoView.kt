package aayush.crispy.core

import android.content.Context
import android.graphics.SurfaceTexture
import android.util.Log
import android.view.Surface
import android.view.TextureView
import android.view.View
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import `is`.xyz.mpv.MPVLib
import kotlin.math.abs

class CrispyVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext), TextureView.SurfaceTextureListener, MPVLib.EventObserver {
    companion object {
        private const val TAG = "CrispyVideoView"
    }

    private val surfaceView = TextureView(context)
    private var isMpvInitialized = false
    private var pendingSource: String? = null
    private var pendingPosition: Long = -1
    
    // Track info
    private var duration: Long = 0
    private var position: Long = 0
    private var isSeeking = false

    // Event dispatchers
    val onLoad by EventDispatcher<Map<String, Any>>()
    val onProgress by EventDispatcher<Map<String, Any>>()
    val onEnd by EventDispatcher<Unit>()
    val onError by EventDispatcher<Map<String, String>>()
    val onTracksChanged by EventDispatcher<Map<String, Any>>()

    init {
        surfaceView.surfaceTextureListener = this
        addView(surfaceView, android.view.ViewGroup.LayoutParams(
            android.view.ViewGroup.LayoutParams.MATCH_PARENT, 
            android.view.ViewGroup.LayoutParams.MATCH_PARENT
        ))
    }

    // --- TextureView.SurfaceTextureListener ---

    override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {
        Log.d(TAG, "Surface available: ${width}x${height}")
        initMpv(Surface(surface))
    }

    override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) {
        Log.d(TAG, "Surface size changed: ${width}x${height}")
        if (isMpvInitialized) {
            MPVLib.setPropertyString("android-surface-size", "${width}x${height}")
        }
    }

    override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {
        Log.d(TAG, "Surface destroyed")
        destroyMpv()
        return true
    }

    override fun onSurfaceTextureUpdated(surface: SurfaceTexture) {
        // No-op
    }

    // --- MPV Initialization ---

    private fun initMpv(surface: Surface) {
        try {
            MPVLib.create(context.applicationContext)
            initOptions()
            MPVLib.init()
            MPVLib.attachSurface(surface)
            MPVLib.addObserver(this)
            
            // Observe properties for events
            MPVLib.observeProperty("time-pos", MPVLib.MpvFormat.MPV_FORMAT_DOUBLE)
            MPVLib.observeProperty("duration", MPVLib.MpvFormat.MPV_FORMAT_DOUBLE)
            MPVLib.observeProperty("track-list", MPVLib.MpvFormat.MPV_FORMAT_NONE)
            MPVLib.observeProperty("eof-reached", MPVLib.MpvFormat.MPV_FORMAT_FLAG)
            
            isMpvInitialized = true
            Log.d(TAG, "MPV initialized successfully")

            // Restore state if needed
            pendingSource?.let { 
                loadFile(it)
                pendingSource = null 
            }
            if (pendingPosition >= 0) {
                seek(pendingPosition)
                pendingPosition = -1
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize MPV", e)
            onError(mapOf("error" to (e.message ?: "Initialization failed")))
        }
    }
    
    private fun initOptions() {
        // Hardware decoding
        MPVLib.setOptionString("hwdec", "auto")
        MPVLib.setOptionString("hwdec-codecs", "all")
        
        // Video output
        MPVLib.setOptionString("vo", "gpu")
        MPVLib.setOptionString("gpu-context", "android")
        MPVLib.setOptionString("opengl-es", "yes")
        
        // Audio output - standard android
        MPVLib.setOptionString("ao", "audiotrack,opensles")
        
        // Network behavior
        MPVLib.setOptionString("network-timeout", "60")
        MPVLib.setOptionString("tls-verify", "no")
        MPVLib.setOptionString("http-reconnect", "yes")
        // Improve buffer for streaming
        MPVLib.setOptionString("cache", "yes")
        MPVLib.setOptionString("demuxer-max-bytes", "${64 * 1024 * 1024}")
        MPVLib.setOptionString("demuxer-max-back-bytes", "${64 * 1024 * 1024}")

        // Subtitles
        MPVLib.setOptionString("sub-auto", "fuzzy")
        MPVLib.setOptionString("sub-visibility", "yes")
        MPVLib.setOptionString("embeddedfonts", "yes")
        
        // Android-specific
        MPVLib.setOptionString("android-surface-size", "${surfaceView.width}x${surfaceView.height}")

        // UI
        MPVLib.setOptionString("osc", "no")
        MPVLib.setOptionString("osd-level", "1") // Show basic OSD
        MPVLib.setOptionString("input-default-bindings", "no")
    }

    private fun destroyMpv() {
        if (isMpvInitialized) {
            MPVLib.removeObserver(this)
            MPVLib.detachSurface()
            MPVLib.destroy()
            isMpvInitialized = false
        }
    }

    // --- MPVLib.EventObserver ---

    override fun eventProperty(property: String) { }
    override fun eventProperty(property: String, value: Long) { }
    override fun eventProperty(property: String, value: Boolean) { 
        if (property == "eof-reached" && value) {
            onEnd(Unit)
        }
    }
    override fun eventProperty(property: String, value: String) { }

    override fun eventProperty(property: String, value: Double) {
        if (property == "time-pos") {
            position = (value * 1000).toLong()
            if (!isSeeking && duration > 0) {
                onProgress(mapOf("position" to position, "duration" to duration))
            }
        } else if (property == "duration") {
            duration = (value * 1000).toLong()
            onLoad(mapOf("duration" to duration, "width" to 0, "height" to 0))
        }
    }

    override fun event(eventId: Int) {
        when (eventId) {
           MPVLib.MpvEvent.MPV_EVENT_END_FILE -> onEnd(Unit)
           // Add track change detection if needed via MPV_EVENT_PROPERTY_CHANGE logic on 'track-list'
        }
    }

    // --- Public API ---

    private fun loadFile(url: String) {
        Log.d(TAG, "Loading file: $url")
        MPVLib.command(arrayOf("loadfile", url))
        MPVLib.setPropertyString("pause", "no")
    }

    fun setSource(url: String?) {
        if (url == null) return
        if (isMpvInitialized) {
            loadFile(url)
        } else {
            pendingSource = url
        }
    }
    
    // Headers support for debrid streams
    fun setHeaders(headers: Map<String, String>?) {
        if (headers.isNullOrEmpty()) return
        val headerString = headers.entries.joinToString(",") { "${it.key}: ${it.value}" }
        if (isMpvInitialized) {
            MPVLib.setOptionString("http-header-fields", headerString)
        }
    }

    fun setPaused(paused: Boolean) {
        if (isMpvInitialized) {
            MPVLib.setPropertyString("pause", if (paused) "yes" else "no")
        }
    }

    fun seek(positionMs: Long) {
        if (isMpvInitialized) {
            isSeeking = true
            val seconds = positionMs / 1000.0
            MPVLib.command(arrayOf("seek", seconds.toString(), "absolute"))
            // Optimization: Assume seek happens instantly for UI purposes or wait for event
            mainHandler.postDelayed({ isSeeking = false }, 500)
        } else {
            pendingPosition = positionMs
        }
    }
    
    fun setAudioTrack(trackId: Int) {
        if (isMpvInitialized) {
            MPVLib.setPropertyString("aid", trackId.toString())
        }
    }
    
    fun setSubtitleTrack(trackId: Int) {
        if (isMpvInitialized) {
            MPVLib.setPropertyString("sid", trackId.toString())
        }
    }
    
    fun setResizeMode(mode: String?) {
         // "contain" (default), "cover" (crop), "stretch" (stretch)
         // MPV 'video-aspect-override' or 'video-scale' could be used, or View layout params
         // Simple pan&scan for cover:
         when(mode) {
             "cover" -> {
                 if(isMpvInitialized) MPVLib.setPropertyDouble("panscan", 1.0)
             }
             else -> {
                 if(isMpvInitialized) MPVLib.setPropertyDouble("panscan", 0.0)
             }
         }
    }
    
    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
}
