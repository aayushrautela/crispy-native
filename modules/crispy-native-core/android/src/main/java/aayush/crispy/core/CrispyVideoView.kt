package aayush.crispy.core

import android.content.Context
import android.view.SurfaceHolder
import android.view.SurfaceView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class CrispyVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    private val surfaceView = SurfaceView(context)
    private var player: MpvPlayer? = null
    
    // Event dispatchers
    val onLoad by EventDispatcher<Map<String, Any>>()
    val onProgress by EventDispatcher<Map<String, Any>>()
    val onEnd by EventDispatcher<Unit>()

    init {
        addView(surfaceView)
        
        surfaceView.holder.addCallback(object : SurfaceHolder.Callback {
            override fun surfaceCreated(holder: SurfaceHolder) {
                player = MpvPlayer(context)
                player?.setSurface(holder.surface)
            }

            override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {}

            override fun surfaceDestroyed(holder: SurfaceHolder) {
                player?.setSurface(null)
                player?.destroy()
                player = null
            }
        })
        
        // Polling for progress (simple for now)
        postDelayed(object : Runnable {
            override fun run() {
                player?.let { p ->
                    val pos = p.getPosition()
                    val dur = p.getDuration()
                    if (pos > 0 || dur > 0) {
                        onProgress(mapOf("position" to pos, "duration" to dur))
                    }
                }
                postDelayed(this, 1000)
            }
        }, 1000)
    }

    fun setSource(url: String?) {
        url?.let {
            player?.load(it)
            player?.play()
            // In a real impl, we'd wait for on-metadata event from JNI
            onLoad(mapOf("status" to "loading"))
        }
    }

    fun setPaused(paused: Boolean) {
        if (paused) player?.pause() else player?.play()
    }

    fun seek(positionMs: Long) {
        player?.seek(positionMs)
    }
}
