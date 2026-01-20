package aayush.crispy.core

import android.content.Context
import android.view.SurfaceHolder
import android.view.SurfaceView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import `is`.xyz.mpv.MPVLib

class CrispyVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    private val surfaceView = SurfaceView(context)
    private var isMpvInitialized = false
    
    // Event dispatchers
    val onLoad by EventDispatcher<Map<String, Any>>()
    val onProgress by EventDispatcher<Map<String, Any>>()
    val onEnd by EventDispatcher<Unit>()

    init {
        addView(surfaceView)
        
        surfaceView.holder.addCallback(object : SurfaceHolder.Callback {
            override fun surfaceCreated(holder: SurfaceHolder) {
                MPVLib.create(context.applicationContext)
                
                // Basic configuration
                MPVLib.setPropertyString("vo", "gpu")
                MPVLib.setPropertyString("hwdec", "auto")
                MPVLib.setPropertyString("save-position-on-quit", "no")
                
                MPVLib.init()
                MPVLib.attachSurface(holder.surface)
                isMpvInitialized = true
            }

            override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {}

            override fun surfaceDestroyed(holder: SurfaceHolder) {
                if (isMpvInitialized) {
                    MPVLib.detachSurface()
                    MPVLib.destroy()
                    isMpvInitialized = false
                }
            }
        })
        
        // Polling for progress (simple for now)
        postDelayed(object : Runnable {
            override fun run() {
                if (isMpvInitialized) {
                    val pos = (MPVLib.getPropertyDouble("time-pos") ?: 0.0) * 1000
                    val dur = (MPVLib.getPropertyDouble("duration") ?: 0.0) * 1000
                    if (pos > 0 || dur > 0) {
                        onProgress(mapOf("position" to pos.toLong(), "duration" to dur.toLong()))
                    }
                }
                postDelayed(this, 1000)
            }
        }, 1000)
    }

    fun setSource(url: String?) {
        url?.let {
            if (isMpvInitialized) {
                MPVLib.command(arrayOf("loadfile", it))
                MPVLib.setPropertyString("pause", "no")
                // In a real impl, we'd wait for on-metadata event from JNI
                onLoad(mapOf("status" to "loading"))
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
