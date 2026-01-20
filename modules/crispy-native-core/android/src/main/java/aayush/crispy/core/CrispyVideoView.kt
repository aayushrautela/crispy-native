package aayush.crispy.core

import android.content.Context
import android.util.Log
import android.view.SurfaceHolder
import android.view.SurfaceView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import `is`.xyz.mpv.MPVLib

class CrispyVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    companion object {
        private const val TAG = "CrispyVideoView"
    }

    private val surfaceView = SurfaceView(context)
    private var isMpvInitialized = false
    private var pendingSource: String? = null
    
    // Event dispatchers
    val onLoad by EventDispatcher<Map<String, Any>>()
    val onProgress by EventDispatcher<Map<String, Any>>()
    val onEnd by EventDispatcher<Unit>()

    init {
        addView(surfaceView)
        
        surfaceView.holder.addCallback(object : SurfaceHolder.Callback {
            override fun surfaceCreated(holder: SurfaceHolder) {
                Log.d(TAG, "Surface created, initializing MPV")
                try {
                    MPVLib.create(context.applicationContext)
                    
                    // Options MUST be set before init()
                    initOptions()
                    
                    MPVLib.init()
                    MPVLib.attachSurface(holder.surface)
                    isMpvInitialized = true
                    Log.d(TAG, "MPV initialized successfully")
                    
                    // Load pending source if any
                    pendingSource?.let { url ->
                        Log.d(TAG, "Loading pending source: $url")
                        loadFile(url)
                        pendingSource = null
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to initialize MPV", e)
                }
            }

            override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
                Log.d(TAG, "Surface changed: ${width}x${height}")
                if (isMpvInitialized) {
                    MPVLib.setPropertyString("android-surface-size", "${width}x${height}")
                }
            }

            override fun surfaceDestroyed(holder: SurfaceHolder) {
                Log.d(TAG, "Surface destroyed, cleaning up MPV")
                if (isMpvInitialized) {
                    MPVLib.detachSurface()
                    MPVLib.destroy()
                    isMpvInitialized = false
                }
            }
        })
        
        // Polling for progress
        postDelayed(object : Runnable {
            override fun run() {
                if (isMpvInitialized) {
                    try {
                        val pos = (MPVLib.getPropertyDouble("time-pos") ?: 0.0) * 1000
                        val dur = (MPVLib.getPropertyDouble("duration") ?: 0.0) * 1000
                        if (pos > 0 || dur > 0) {
                            onProgress(mapOf("position" to pos.toLong(), "duration" to dur.toLong()))
                        }
                    } catch (e: Exception) {
                        // Ignore errors during polling
                    }
                }
                postDelayed(this, 1000)
            }
        }, 1000)
    }

    private fun initOptions() {
        // GPU rendering
        MPVLib.setOptionString("vo", "gpu")
        MPVLib.setOptionString("gpu-context", "android")
        MPVLib.setOptionString("opengl-es", "yes")
        
        // Hardware decoding (auto-copy is safest)
        MPVLib.setOptionString("hwdec", "auto-copy")
        
        // Audio output
        MPVLib.setOptionString("ao", "audiotrack,opensles")
        
        // Cache settings
        MPVLib.setOptionString("cache", "yes")
        MPVLib.setOptionString("cache-secs", "30")
        MPVLib.setOptionString("demuxer-max-bytes", "${32 * 1024 * 1024}")
        MPVLib.setOptionString("demuxer-max-back-bytes", "${32 * 1024 * 1024}")
        
        // Network
        MPVLib.setOptionString("network-timeout", "60")
        MPVLib.setOptionString("tls-verify", "no")
        MPVLib.setOptionString("http-reconnect", "yes")
        
        // Subtitles
        MPVLib.setOptionString("sub-auto", "fuzzy")
        MPVLib.setOptionString("sub-visibility", "yes")
        
        // Disable on-screen controls
        MPVLib.setOptionString("osc", "no")
        MPVLib.setOptionString("terminal", "no")
        MPVLib.setOptionString("input-default-bindings", "no")
        
        Log.d(TAG, "MPV options configured")
    }

    private fun loadFile(url: String) {
        Log.d(TAG, "Loading file: $url")
        MPVLib.command(arrayOf("loadfile", url))
        MPVLib.setPropertyString("pause", "no")
        onLoad(mapOf("status" to "loading"))
    }

    fun setSource(url: String?) {
        url?.let {
            if (isMpvInitialized) {
                loadFile(it)
            } else {
                Log.d(TAG, "MPV not ready, queueing source: $it")
                pendingSource = it
            }
        }
    }

    fun setPaused(paused: Boolean) {
        if (isMpvInitialized) {
            MPVLib.setPropertyString("pause", if (paused) "yes" else "no")
        }
    }

    fun seek(positionMs: Long) {
        if (isMpvInitialized) {
            val seconds = positionMs / 1000.0
            MPVLib.command(arrayOf("seek", seconds.toString(), "absolute"))
        }
    }
}
