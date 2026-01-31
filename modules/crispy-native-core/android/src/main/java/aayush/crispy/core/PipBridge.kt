package aayush.crispy.core

import android.app.Activity
import android.app.Application
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.core.util.Consumer
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
    private var reactContextRef: WeakReference<ReactContext>? = null
    private var currentActivityRef: WeakReference<Activity>? = null

    private var pipListenerActivityRef: WeakReference<ComponentActivity>? = null
    private var pipListener: Consumer<PictureInPictureModeChangedInfo>? = null

    @Volatile
    private var currentActivityStopped: Boolean = false

    @Volatile
    private var lastIsPip: Boolean? = null

    @Volatile
    private var started: Boolean = false

    fun start(reactContext: ReactContext) {
        if (started) return
        started = true
        reactContextRef = WeakReference(reactContext)
        (reactContext.applicationContext as? Application)?.registerActivityLifecycleCallbacks(this)
    }

    fun stop() {
        started = false
        val app = reactContextRef?.get()?.applicationContext as? Application
        try {
            app?.unregisterActivityLifecycleCallbacks(this)
        } catch (_: Exception) {
            // ignore
        }

        detachPipListener()
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

    private fun attachPipListener(activity: Activity) {
        if (!started) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val component = activity as? ComponentActivity ?: return
        if (pipListenerActivityRef?.get() === component) return

        detachPipListener()

        val listener = Consumer<PictureInPictureModeChangedInfo> { info ->
            val isPip = info.isInPictureInPictureMode
            handlePipChanged(isPip, allowInitialEmit = true)
        }

        pipListener = listener
        pipListenerActivityRef = WeakReference(component)
        try {
            component.addOnPictureInPictureModeChangedListener(listener)
        } catch (_: Exception) {
            // ignore
        }
    }

    private fun detachPipListener() {
        val activity = pipListenerActivityRef?.get()
        val listener = pipListener

        if (activity != null && listener != null) {
            try {
                activity.removeOnPictureInPictureModeChangedListener(listener)
            } catch (_: Exception) {
                // ignore
            }
        }

        pipListener = null
        pipListenerActivityRef = null
    }

    private fun syncPipState(activity: Activity, allowInitialEmit: Boolean) {
        handlePipChanged(isInPip(activity), allowInitialEmit = allowInitialEmit)
    }

    private fun handlePipChanged(isPipNow: Boolean, allowInitialEmit: Boolean) {
        val prev = lastIsPip

        if (prev == null) {
            lastIsPip = isPipNow
            if (allowInitialEmit && isPipNow) {
                // If we attach while already in PiP (rare, but possible), ensure native views + JS
                // immediately switch to their PiP rendering mode.
                emit("onPipWillEnter", null)
                emit("onPipModeChanged", true)
                PlaybackRegistry.notifyPipModeChanged(true)
            }
            return
        }

        if (prev == isPipNow) return

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

    override fun onActivityResumed(activity: Activity) {
        currentActivityRef = WeakReference(activity)
        currentActivityStopped = false

        attachPipListener(activity)
        syncPipState(activity, allowInitialEmit = true)
    }

    override fun onActivityStarted(activity: Activity) {
        if (currentActivityRef?.get() === activity) {
            currentActivityStopped = false
            attachPipListener(activity)
            syncPipState(activity, allowInitialEmit = true)
        }
    }

    override fun onActivityStopped(activity: Activity) {
        if (currentActivityRef?.get() === activity) {
            currentActivityStopped = true

            // Some OEMs/devices can fail to deliver PiP mode callbacks when the PiP window is
            // dismissed while the activity transitions to stopped. In that case, treat a stop
            // while previously in PiP as a dismissal.
            val prev = lastIsPip
            val isPipNow = isInPip(activity)
            if (prev == true && !isPipNow) {
                handlePipChanged(false, allowInitialEmit = true)
            }
        }
    }

    override fun onActivityPaused(activity: Activity) {}
    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
    override fun onActivityDestroyed(activity: Activity) {}
}
