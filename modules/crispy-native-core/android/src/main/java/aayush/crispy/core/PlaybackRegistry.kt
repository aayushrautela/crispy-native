package aayush.crispy.core

import android.util.Log
import android.os.Handler
import android.os.Looper
import java.lang.ref.WeakReference
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Tracks active native playback surfaces so we can react to PiP lifecycle
 * (eg. force a safe resize mode in PiP, pause when PiP is dismissed).
 */
interface PipPlaybackTarget {
    fun onPipModeChanged(isPip: Boolean)
    fun onPipWindowSizeChanged(width: Int, height: Int) {}
    fun pauseFromPipDismissed()
}

object PlaybackRegistry {
    private const val TAG = "PlaybackRegistry"

    private inline fun d(message: () -> String) {
        if (BuildConfig.DEBUG) {
            try {
                Log.d(TAG, message())
            } catch (_: Exception) {
                // ignore
            }
        }
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val targets = CopyOnWriteArrayList<WeakReference<PipPlaybackTarget>>()

    fun register(target: PipPlaybackTarget) {
        cleanup()
        if (targets.any { it.get() === target }) return
        targets.add(WeakReference(target))

        d { "register(${target.javaClass.simpleName}) targets=${targets.size}" }
    }

    fun unregister(target: PipPlaybackTarget) {
        targets.removeAll { it.get() == null || it.get() === target }

        d { "unregister(${target.javaClass.simpleName}) targets=${targets.size}" }
    }

    fun notifyPipModeChanged(isPip: Boolean) {
        d { "notifyPipModeChanged(isPip=$isPip) targets=${targets.size}" }
        mainHandler.post {
            cleanup()
            for (ref in targets) {
                val t = ref.get() ?: continue
                d { " -> ${t.javaClass.simpleName}.onPipModeChanged($isPip)" }
                t.onPipModeChanged(isPip)
            }
        }
    }

    fun notifyPipWindowSizeChanged(width: Int, height: Int) {
        if (width <= 0 || height <= 0) return

        d { "notifyPipWindowSizeChanged(${width}x${height}) targets=${targets.size}" }

        mainHandler.post {
            cleanup()
            for (ref in targets) {
                val t = ref.get() ?: continue
                d { " -> ${t.javaClass.simpleName}.onPipWindowSizeChanged(${width}x${height})" }
                t.onPipWindowSizeChanged(width, height)
            }
        }
    }

    fun pauseAllFromPipDismissed() {
        d { "pauseAllFromPipDismissed() targets=${targets.size}" }
        mainHandler.post {
            cleanup()
            for (ref in targets) {
                val t = ref.get() ?: continue
                d { " -> ${t.javaClass.simpleName}.pauseFromPipDismissed()" }
                t.pauseFromPipDismissed()
            }
        }
    }

    private fun cleanup() {
        targets.removeAll { it.get() == null }
    }
}
