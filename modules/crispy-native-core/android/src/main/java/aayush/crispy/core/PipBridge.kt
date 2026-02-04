package aayush.crispy.core

import android.app.Activity
import android.app.Application
import android.graphics.Point
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowInsets
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
    private const val TAG = "PipBridge"

    private inline fun d(message: () -> String) {
        if (BuildConfig.DEBUG) {
            try {
                Log.d(TAG, message())
            } catch (_: Exception) {
                // ignore
            }
        }
    }

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

    // PiP resize tracking
    // Some devices (Pixel included) can update PiP window bounds without promptly re-laying out
    // the view hierarchy or dispatching timely surface resize callbacks. To keep playback stable,
    // we treat the *window size* as the source of truth and notify native playback targets.
    private val pipHandler = Handler(Looper.getMainLooper())
    private var pipResizeRunnable: Runnable? = null
    private var pipRootViewRef: WeakReference<View>? = null
    private var pipRootLayoutListener: View.OnLayoutChangeListener? = null
    private var lastPipW: Int = 0
    private var lastPipH: Int = 0

    private fun computeWindowSize(activity: Activity): Pair<Int, Int> {
        // In PiP mode, we want the raw window bounds without subtracting insets,
        // since PiP windows don't have system bars overlaying them.
        val isPip = isInPip(activity)

        // Some devices update the PiP bounds without keeping currentWindowMetrics perfectly in sync.
        // The decor view size tends to reflect what the system is actually composing.
        if (isPip) {
            try {
                val decor = activity.window?.decorView
                val w = decor?.width ?: 0
                val h = decor?.height ?: 0
                if (w > 0 && h > 0) {
                    return w to h
                }
            } catch (_: Exception) {
                // ignore
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                val metrics = activity.windowManager.currentWindowMetrics
                val bounds = metrics.bounds
                
                if (isPip) {
                    // In PiP, use raw bounds - no system bars to subtract
                    return bounds.width() to bounds.height()
                }
                
                val insets = metrics.windowInsets.getInsetsIgnoringVisibility(
                    WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout()
                )

                val w = (bounds.width() - insets.left - insets.right).coerceAtLeast(0)
                val h = (bounds.height() - insets.top - insets.bottom).coerceAtLeast(0)
                return w to h
            } catch (_: Exception) {
                // ignore
            }
        }

        return try {
            val out = Point()
            @Suppress("DEPRECATION")
            activity.windowManager.defaultDisplay.getSize(out)
            out.x to out.y
        } catch (_: Exception) {
            0 to 0
        }
    }

    private fun maybeNotifyWindowSize(activity: Activity, reason: String) {
        val (w, h) = computeWindowSize(activity)

        d {
            val decor = activity.window?.decorView
            val decorW = decor?.width ?: -1
            val decorH = decor?.height ?: -1
            val isPip = isInPip(activity)
            "maybeNotifyWindowSize(reason=$reason) computed=${w}x${h} last=${lastPipW}x${lastPipH} decor=${decorW}x${decorH} isPip=$isPip"
        }

        if (w <= 0 || h <= 0) {
            d { "maybeNotifyWindowSize skip: non-positive computed=${w}x${h} reason=$reason" }
            return
        }

        if (w == lastPipW && h == lastPipH) {
            d { "maybeNotifyWindowSize skip: unchanged computed=${w}x${h} reason=$reason" }
            return
        }

        lastPipW = w
        lastPipH = h

        d { "maybeNotifyWindowSize notify: new=${w}x${h} reason=$reason" }

        // Nudge the view tree so RN/Expo can pick up the new bounds.
        try {
            activity.window?.decorView?.requestLayout()
            activity.window?.decorView?.invalidate()
        } catch (_: Exception) {
            // ignore
        }

        PlaybackRegistry.notifyPipWindowSizeChanged(w, h)
        emit("onPipWindowSizeChanged", mapOf("width" to w, "height" to h, "reason" to reason))
    }

    private fun startPipResizeTracking(activity: Activity) {
        if (pipResizeRunnable != null) return

        d {
            val isPip = isInPip(activity)
            "startPipResizeTracking(activity=${activity.javaClass.simpleName}) isPip=$isPip"
        }

        // Attach a layout listener to the decor view. When it does fire, we can react immediately.
        val root = activity.window?.decorView
        if (root != null) {
            val listener = View.OnLayoutChangeListener { _, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom ->
                val w = right - left
                val h = bottom - top
                val oldW = oldRight - oldLeft
                val oldH = oldBottom - oldTop
                if (w > 0 && h > 0 && (w != oldW || h != oldH)) {
                    d { "decorLayout ${oldW}x${oldH} -> ${w}x${h} (root=${root.width}x${root.height})" }
                    maybeNotifyWindowSize(activity, "decorLayout")
                }
            }
            pipRootViewRef = WeakReference(root)
            pipRootLayoutListener = listener
            root.addOnLayoutChangeListener(listener)
        }

        // Fallback poll: bounded work while in PiP, only notifies on actual size changes.
        val runnable = object : Runnable {
            private var stableTicks = 0
            private var intervalMs = 50L

            override fun run() {
                if (pipResizeRunnable !== this) return

                val a = currentActivityRef?.get()
                if (!started || a == null || !isInPip(a)) {
                    d { "pipPoll stop: started=$started activity=${a?.javaClass?.simpleName} isInPip=${a?.let { isInPip(it) } ?: false}" }
                    stopPipResizeTracking()
                    return
                }

                val beforeW = lastPipW
                val beforeH = lastPipH
                maybeNotifyWindowSize(a, "poll")

                val changed = (lastPipW != beforeW || lastPipH != beforeH)
                if (changed) {
                    d { "pipPoll changed: ${beforeW}x${beforeH} -> ${lastPipW}x${lastPipH}" }
                    stableTicks = 0
                    intervalMs = 50L
                } else {
                    stableTicks++
                    // After the window is stable for a bit, reduce poll frequency.
                    if (stableTicks >= 20) {
                        intervalMs = 250L
                    }

                    if (stableTicks == 1 || stableTicks == 20 || stableTicks % 40 == 0) {
                        d { "pipPoll stable: ticks=$stableTicks intervalMs=$intervalMs last=${lastPipW}x${lastPipH}" }
                    }
                }

                pipHandler.postDelayed(this, intervalMs)
            }
        }

        pipResizeRunnable = runnable
        // Emit immediately to sync state as soon as we enter PiP.
        maybeNotifyWindowSize(activity, "start")
        pipHandler.post(runnable)
    }

    private fun stopPipResizeTracking() {
        d { "stopPipResizeTracking() last=${lastPipW}x${lastPipH}" }
        pipResizeRunnable?.let { pipHandler.removeCallbacks(it) }
        pipResizeRunnable = null
        lastPipW = 0
        lastPipH = 0

        val root = pipRootViewRef?.get()
        val listener = pipRootLayoutListener
        if (root != null && listener != null) {
            try {
                root.removeOnLayoutChangeListener(listener)
            } catch (_: Exception) {
                // ignore
            }
        }

        pipRootViewRef = null
        pipRootLayoutListener = null
    }

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
        stopPipResizeTracking()
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

        d { "handlePipChanged(prev=$prev now=$isPipNow allowInitialEmit=$allowInitialEmit stopped=$currentActivityStopped)" }

        if (prev == null) {
            lastIsPip = isPipNow
            if (allowInitialEmit && isPipNow) {
                // If we attach while already in PiP (rare, but possible), ensure native views + JS
                // immediately switch to their PiP rendering mode.
                emit("onPipWillEnter", null)
                emit("onPipModeChanged", true)
                PlaybackRegistry.notifyPipModeChanged(true)
                currentActivityRef?.get()?.let { startPipResizeTracking(it) }
            }
            return
        }

        if (prev == isPipNow) return

        if (isPipNow && !prev) {
            emit("onPipWillEnter", null)
        }

        emit("onPipModeChanged", isPipNow)
        PlaybackRegistry.notifyPipModeChanged(isPipNow)

        if (isPipNow) {
            currentActivityRef?.get()?.let { startPipResizeTracking(it) }
        } else {
            stopPipResizeTracking()
        }

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
