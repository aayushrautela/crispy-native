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

    @Volatile
    private var currentIsPip: Boolean = false

    @Volatile
    private var currentPipW: Int = 0

    @Volatile
    private var currentPipH: Int = 0

    fun register(target: PipPlaybackTarget) {
        cleanup()
        if (targets.any { it.get() === target }) return
        targets.add(WeakReference(target))

        d { "register(${target.javaClass.simpleName}) targets=${targets.size}" }

        // Sync the newly registered target to the latest known PiP state.
        // This is critical because player views can be recreated while already in PiP.
        val isPipNow = currentIsPip
        val w = currentPipW
        val h = currentPipH
        mainHandler.post {
            try {
                target.onPipModeChanged(isPipNow)
                if (isPipNow && w > 0 && h > 0) {
                    target.onPipWindowSizeChanged(w, h)
                }
            } catch (_: Exception) {
                // ignore
            }
        }
    }

    fun unregister(target: PipPlaybackTarget) {
        targets.removeAll { it.get() == null || it.get() === target }

        d { "unregister(${target.javaClass.simpleName}) targets=${targets.size}" }
    }

    fun notifyPipModeChanged(isPip: Boolean) {
        currentIsPip = isPip
        if (!isPip) {
            currentPipW = 0
            currentPipH = 0
        }

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

        currentPipW = width
        currentPipH = height

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
