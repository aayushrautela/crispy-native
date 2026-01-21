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
    private var pendingPosition: Double = -1.0
    private var pendingHeaders: Map<String, String>? = null
    private var isPaused = true // Default to paused until told otherwise

    // Track info
    private var durationSec: Double = 0.0
    private var positionSec: Double = 0.0
    private var isSeeking = false
    private var hasLoadEventFired = false

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
                pendingPosition = -1.0
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
        MPVLib.setOptionString("stream-reconnect", "yes")
        
        // Apply headers as options if we have them early
        pendingHeaders?.let { headers ->
            val headerString = headers.entries.joinToString(",") { "${it.key}: ${it.value}" }
            MPVLib.setOptionString("http-header-fields", headerString)
        }

        // Improve buffer for streaming
        MPVLib.setOptionString("cache", "yes")
        MPVLib.setOptionString("demuxer-max-bytes", "${64 * 1024 * 1024}")
        MPVLib.setOptionString("demuxer-max-back-bytes", "${64 * 1024 * 1024}")

        // Subtitles
        MPVLib.setOptionString("sub-auto", "fuzzy")
        MPVLib.setOptionString("sub-visibility", "yes")
        MPVLib.setOptionString("embeddedfonts", "yes")
        MPVLib.setOptionString("sub-ass-override", "force")
        
        // Initial track selection
        MPVLib.setOptionString("sid", "auto")
        MPVLib.setOptionString("aid", "auto")
        
        // Android-specific
        MPVLib.setOptionString("android-surface-size", "${surfaceView.width}x${surfaceView.height}")

        // UI
        MPVLib.setOptionString("osc", "no")
        MPVLib.setOptionString("osd-level", "1") // Show basic OSD
        MPVLib.setOptionString("terminal", "no")
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

    override fun eventProperty(property: String) {
        if (property == "track-list") {
            parseAndSendTracks()
        }
    }
    override fun eventProperty(property: String, value: Long) { }
    override fun eventProperty(property: String, value: Boolean) { 
        if (property == "eof-reached" && value && !isSeeking) {
            onEnd(Unit)
        }
    }
    override fun eventProperty(property: String, value: String) { }

    private fun parseAndSendTracks() {
        try {
            val trackCount = MPVLib.getPropertyInt("track-list/count") ?: 0
            Log.d(TAG, "Track count: $trackCount")
            
            val audioTracks = mutableListOf<Map<String, Any>>()
            val subtitleTracks = mutableListOf<Map<String, Any>>()
            
            for (i in 0 until trackCount) {
                val type = MPVLib.getPropertyString("track-list/$i/type") ?: continue
                val id = MPVLib.getPropertyInt("track-list/$i/id") ?: continue
                val title = MPVLib.getPropertyString("track-list/$i/title") ?: ""
                val lang = MPVLib.getPropertyString("track-list/$i/lang") ?: ""
                val codec = MPVLib.getPropertyString("track-list/$i/codec") ?: ""
                
                val trackName = when {
                    title.isNotEmpty() -> title
                    lang.isNotEmpty() -> lang.uppercase()
                    else -> "Track $id"
                }
                
                val track = mapOf(
                    "id" to id,
                    "name" to trackName,
                    "language" to lang,
                    "codec" to codec
                )
                
                when (type) {
                    "audio" -> audioTracks.add(track)
                    "sub" -> subtitleTracks.add(track)
                }
            }
            
            Log.d(TAG, "Sending tracks - Audio: ${audioTracks.size}, Subtitles: ${subtitleTracks.size}")
            onTracksChanged(mapOf(
                "audioTracks" to audioTracks,
                "subtitleTracks" to subtitleTracks
            ))
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing tracks", e)
        }
    }

    override fun eventProperty(property: String, value: Double) {
        if (property == "time-pos") {
            val positionSec = value
            if (!isSeeking && durationSec > 0) {
                onProgress(mapOf("position" to positionSec, "duration" to durationSec))
            }
        } else if (property == "duration") {
            durationSec = value
            // Fire onLoad only once when we have valid duration and ideally dimensions
            if (!hasLoadEventFired && durationSec > 0) {
                val width = MPVLib.getPropertyInt("width") ?: 0
                val height = MPVLib.getPropertyInt("height") ?: 0
                if (width > 0 && height > 0) {
                    hasLoadEventFired = true
                    onLoad(mapOf("duration" to durationSec, "width" to width, "height" to height))
                } else if (durationSec > 0) {
                    // Fallback if dimensions take too long
                    onLoad(mapOf("duration" to durationSec, "width" to 1920, "height" to 1080))
                    hasLoadEventFired = true
                }
            }
        }
    }

    override fun event(eventId: Int) {
        when (eventId) {
           MPVLib.MpvEvent.MPV_EVENT_END_FILE -> onEnd(Unit)
           MPVLib.MpvEvent.MPV_EVENT_FILE_LOADED -> {
               // Re-sync tracks when file is fully loaded
               parseAndSendTracks()
           }
        }
    }

    // --- Public API ---

    private fun loadFile(url: String) {
        Log.d(TAG, "Loading file: $url")
        hasLoadEventFired = false
        MPVLib.command(arrayOf("loadfile", url))
        MPVLib.setPropertyString("pause", if (isPaused) "yes" else "no")
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
        pendingHeaders = headers
        if (isMpvInitialized && !headers.isNullOrEmpty()) {
            val headerString = headers.entries.joinToString(",") { "${it.key}: ${it.value}" }
            MPVLib.setOptionString("http-header-fields", headerString)
        }
    }

    fun setPaused(paused: Boolean) {
        isPaused = paused
        if (isMpvInitialized) {
            MPVLib.setPropertyString("pause", if (paused) "yes" else "no")
        }
    }

    fun seek(positionSec: Double) {
        if (isMpvInitialized) {
            isSeeking = true
            MPVLib.command(arrayOf("seek", positionSec.toString(), "absolute"))
            // Optimization: Assume seek happens instantly for UI purposes or wait for event
            mainHandler.postDelayed({ isSeeking = false }, 500)
        } else {
            pendingPosition = positionSec
        }
    }
    
    fun setAudioTrack(trackId: Int) {
        if (isMpvInitialized) {
            val value = if (trackId == -1) "no" else trackId.toString()
            Log.d(TAG, "Setting audio track (aid) to: $value")
            MPVLib.command(arrayOf("set", "aid", value))
        }
    }
    
    fun setSubtitleTrack(trackId: Int) {
        Log.d(TAG, "setSubtitleTrack called: trackId=$trackId, isMpvInitialized=$isMpvInitialized")
        if (isMpvInitialized) {
            if (trackId == -1) {
                Log.d(TAG, "Disabling subtitles (sid=no)")
                MPVLib.command(arrayOf("set", "sid", "no"))
                MPVLib.command(arrayOf("set", "sub-visibility", "no"))
            } else {
                Log.d(TAG, "Setting subtitle track (sid) to: $trackId")
                MPVLib.command(arrayOf("set", "sid", trackId.toString()))
                MPVLib.command(arrayOf("set", "sub-visibility", "yes"))
                
                // Debug: Verify
                mainHandler.postDelayed({
                    val currentSid = MPVLib.getPropertyString("sid")
                    val subVisibility = MPVLib.getPropertyString("sub-visibility")
                    Log.d(TAG, "Verification after set - sid=$currentSid, sub-visibility=$subVisibility")
                }, 100)
            }
        }
    }

    fun addExternalSubtitle(url: String, title: String? = null, language: String? = null) {
        if (isMpvInitialized) {
            // sub-add: [url], [flags], [title], [lang]
            // flags: "select" to make it active, "auto" to use sub-auto logic
            val titleStr = title ?: "External"
            val langStr = language ?: "eng"
            Log.d(TAG, "Adding external subtitle: $url ($titleStr)")
            MPVLib.command(arrayOf("sub-add", url, "select", titleStr, langStr))
        }
    }
    
    fun setSubtitleVisibility(visible: Boolean) {
        if (isMpvInitialized) {
            MPVLib.setPropertyString("sub-visibility", if (visible) "yes" else "no")
        }
    }

    fun setSubtitleDelay(delaySec: Double) {
        if (isMpvInitialized) {
            Log.d(TAG, "Setting subtitle delay: $delaySec")
            MPVLib.setPropertyDouble("sub-delay", delaySec)
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
