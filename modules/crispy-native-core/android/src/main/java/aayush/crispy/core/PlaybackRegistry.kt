package aayush.crispy.core

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
    fun pauseFromPipDismissed()
}

object PlaybackRegistry {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val targets = CopyOnWriteArrayList<WeakReference<PipPlaybackTarget>>()

    fun register(target: PipPlaybackTarget) {
        cleanup()
        if (targets.any { it.get() === target }) return
        targets.add(WeakReference(target))
    }

    fun unregister(target: PipPlaybackTarget) {
        targets.removeAll { it.get() == null || it.get() === target }
    }

    fun notifyPipModeChanged(isPip: Boolean) {
        mainHandler.post {
            cleanup()
            for (ref in targets) {
                ref.get()?.onPipModeChanged(isPip)
            }
        }
    }

    fun pauseAllFromPipDismissed() {
        mainHandler.post {
            cleanup()
            for (ref in targets) {
                ref.get()?.pauseFromPipDismissed()
            }
        }
    }

    private fun cleanup() {
        targets.removeAll { it.get() == null }
    }
}
