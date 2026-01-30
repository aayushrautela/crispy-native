package aayush.crispy.core

import android.app.Activity
import android.app.Application
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference

/**
 * Bridges Android PiP lifecycle to JS + native player views.
 *
 * Inspired by crispy-android's MainActivity logic:
 * - When leaving PiP while the activity is stopped, the user dismissed PiP -> pause.
 */
object PipBridge : Application.ActivityLifecycleCallbacks {
    private const val POLL_INTERVAL_MS = 250L

    private val mainHandler = Handler(Looper.getMainLooper())

    private var reactContextRef: WeakReference<ReactContext>? = null
    private var currentActivityRef: WeakReference<Activity>? = null

    @Volatile
    private var currentActivityStopped: Boolean = false

    @Volatile
    private var lastIsPip: Boolean? = null

    @Volatile
    private var started: Boolean = false

    private val poller = object : Runnable {
        override fun run() {
            if (!started) return

            val activity = currentActivityRef?.get()
            if (activity == null) {
                mainHandler.postDelayed(this, POLL_INTERVAL_MS)
                return
            }

            val isPipNow = isInPip(activity)
            val prev = lastIsPip

            if (prev == null) {
                lastIsPip = isPipNow
            } else if (prev != isPipNow) {
                if (isPipNow && !prev) {
                    emit("onPipWillEnter", null)
                }

                emit("onPipModeChanged", isPipNow)
                PlaybackRegistry.notifyPipModeChanged(isPipNow)

                if (!isPipNow && prev && currentActivityStopped) {
                    PlaybackRegistry.pauseAllFromPipDismissed()
                    emit("onPipDismissed", null)
                }

                lastIsPip = isPipNow
            }

            mainHandler.postDelayed(this, POLL_INTERVAL_MS)
        }
    }

    fun start(reactContext: ReactContext) {
        if (started) return
        started = true
        reactContextRef = WeakReference(reactContext)
        (reactContext.applicationContext as? Application)?.registerActivityLifecycleCallbacks(this)
        mainHandler.post(poller)
    }

    fun stop() {
        started = false
        mainHandler.removeCallbacksAndMessages(null)
        val app = reactContextRef?.get()?.applicationContext as? Application
        try {
            app?.unregisterActivityLifecycleCallbacks(this)
        } catch (_: Exception) {
            // ignore
        }
        reactContextRef = null
        currentActivityRef = null
        lastIsPip = null
        currentActivityStopped = false
    }

    private fun emit(name: String, payload: Any?) {
        val ctx = reactContextRef?.get() ?: return
        try {
            ctx
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(name, payload)
        } catch (_: Exception) {
            // ignore
        }
    }

    private fun isInPip(activity: Activity): Boolean {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && activity.isInPictureInPictureMode
    }

    override fun onActivityResumed(activity: Activity) {
        currentActivityRef = WeakReference(activity)
        currentActivityStopped = false
    }

    override fun onActivityStarted(activity: Activity) {
        if (currentActivityRef?.get() === activity) {
            currentActivityStopped = false
        }
    }

    override fun onActivityStopped(activity: Activity) {
        if (currentActivityRef?.get() === activity) {
            currentActivityStopped = true
        }
    }

    override fun onActivityPaused(activity: Activity) {}
    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
    override fun onActivityDestroyed(activity: Activity) {}
}
