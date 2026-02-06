package aayush.crispy.core.pip

import android.app.Activity
import android.app.Application
import android.app.PictureInPictureParams
import android.content.Intent
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.Rational
import android.view.View
import androidx.activity.ComponentActivity
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.core.util.Consumer
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference
import kotlin.math.roundToInt

import aayush.crispy.core.player.ExoPlaybackService
import aayush.crispy.core.player.VlcPlaybackService
import aayush.crispy.core.player.PlayerActivity

/**
 * Centralized PiP controller for the RN app.
 *
 * Goals:
 * - No window-size polling; video surface size changes should come from Surface callbacks.
 * - Keep JS events stable: onPipModeChanged(boolean), onPipWillEnter(), onPipDismissed().
 * - Keep PiP params (auto-enter + aspect ratio + sourceRectHint) updated while NOT in PiP.
 */
object PipController {
  private const val TAG = "PipController"

  private const val MAX_ASPECT = 2.39
  private const val MIN_ASPECT = 1.0 / MAX_ASPECT

  private val mainHandler = Handler(Looper.getMainLooper())

  @Volatile private var started = false
  private var application: Application? = null
  private var reactContextRef: WeakReference<ReactContext>? = null

  private var currentActivityRef: WeakReference<Activity>? = null

  // Best-effort state (JS + native engines can update these)
  @Volatile private var enabled: Boolean = false
  @Volatile private var isPlaying: Boolean = false
  @Volatile private var aspectRatio: Rational? = null
  private var playerViewRef: WeakReference<View>? = null

  @Volatile private var isInPipMode: Boolean = false

  private var pipListenerActivityRef: WeakReference<ComponentActivity>? = null
  private var pipListener: Consumer<PictureInPictureModeChangedInfo>? = null

  private val activityCallbacks = object : Application.ActivityLifecycleCallbacks {
    override fun onActivityCreated(activity: Activity, savedInstanceState: android.os.Bundle?) {
      if (activity is PlayerActivity) return
      setCurrentActivity(activity)
      ensurePipListener(activity)
      applyParamsToActivity(activity)
    }

    override fun onActivityStarted(activity: Activity) {
      if (activity is PlayerActivity) return
      setCurrentActivity(activity)
      ensurePipListener(activity)
      applyParamsToActivity(activity)
    }

    override fun onActivityResumed(activity: Activity) {
      if (activity is PlayerActivity) return
      setCurrentActivity(activity)
      ensurePipListener(activity)
      // When returning from PiP expansion, we want params fresh for the next swipe-home.
      applyParamsToActivity(activity)
    }

    override fun onActivityPaused(activity: Activity) {
      // no-op
    }

    override fun onActivityStopped(activity: Activity) {
      if (activity is PlayerActivity) return
      // If the PiP window is dismissed (swiped away), the activity is typically stopped/destroyed
      // while still in PiP mode. Treat that as dismissal.
      if (isInPipMode && currentActivityRef?.get() === activity) {
        Log.d(TAG, "Activity stopped while in PiP; treating as dismissed")
        isInPipMode = false
        stopPlaybackServices()
        emit("onPipDismissed", null)
      }
    }

    override fun onActivitySaveInstanceState(activity: Activity, outState: android.os.Bundle) {
      // no-op
    }

    override fun onActivityDestroyed(activity: Activity) {
      if (activity is PlayerActivity) return
      val current = currentActivityRef?.get()
      if (current === activity) {
        currentActivityRef = null
      }

      val listenerActivity = pipListenerActivityRef?.get()
      if (listenerActivity === activity && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        try {
          pipListener?.let { listenerActivity.removeOnPictureInPictureModeChangedListener(it) }
        } catch (t: Throwable) {
          // Best-effort cleanup.
        }
        pipListener = null
        pipListenerActivityRef = null
      }
    }
  }

  fun start(application: Application, reactContext: ReactContext) {
    if (started) {
      reactContextRef = WeakReference(reactContext)
      return
    }

    this.application = application
    this.reactContextRef = WeakReference(reactContext)
    application.registerActivityLifecycleCallbacks(activityCallbacks)
    started = true

    Log.d(TAG, "Started")
  }

  fun stop() {
    if (!started) return
    val app = application
    if (app != null) {
      try {
        app.unregisterActivityLifecycleCallbacks(activityCallbacks)
      } catch (t: Throwable) {
        // ignore
      }
    }
    application = null
    reactContextRef = null
    currentActivityRef = null
    playerViewRef = null

    started = false
    Log.d(TAG, "Stopped")
  }

  fun setConfigFromJs(enabled: Boolean, isPlaying: Boolean, width: Double?, height: Double?) {
    this.enabled = enabled
    this.isPlaying = isPlaying
    this.aspectRatio = buildAspectRatio(width, height)
    applyParamsToCurrentActivity()
  }

  fun updateIsPlayingFromNative(isPlaying: Boolean) {
    // Don't auto-enable PiP from native; JS controls whether the player screen is eligible.
    this.isPlaying = isPlaying
    applyParamsToCurrentActivity()
  }

  fun updateVideoSizeFromNative(width: Int, height: Int) {
    this.aspectRatio = buildAspectRatio(width.toDouble(), height.toDouble())
    applyParamsToCurrentActivity()
  }

  fun registerPlayerView(view: View) {
    playerViewRef = WeakReference(view)
    applyParamsToCurrentActivity()
  }

  fun unregisterPlayerView(view: View) {
    val current = playerViewRef?.get()
    if (current === view) playerViewRef = null
  }

  fun enterPiP(activity: Activity?, overrideWidth: Double?, overrideHeight: Double?): Boolean {
    if (activity == null) return false
    if (activity is PlayerActivity) return false
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false

    emit("onPipWillEnter", null)

    val params = buildParams(activity, overrideWidth, overrideHeight)
    return try {
      activity.enterPictureInPictureMode(params)
    } catch (t: Throwable) {
      Log.e(TAG, "enterPiP failed", t)
      false
    }
  }

  fun isInPiPMode(activity: Activity?): Boolean {
    if (activity == null) return false
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && activity.isInPictureInPictureMode
  }

  fun isInPiPMode(): Boolean = isInPipMode

  private fun setCurrentActivity(activity: Activity) {
    currentActivityRef = WeakReference(activity)
  }

  private fun stopPlaybackServices() {
    val app = application ?: return
    try {
      app.stopService(Intent(app, VlcPlaybackService::class.java))
    } catch (_: Throwable) {
      // ignore
    }
    try {
      app.stopService(Intent(app, ExoPlaybackService::class.java))
    } catch (_: Throwable) {
      // ignore
    }
  }

  private fun ensurePipListener(activity: Activity) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    if (activity is PlayerActivity) return

    val componentActivity = activity as? ComponentActivity ?: return

    val existing = pipListenerActivityRef?.get()
    if (existing === componentActivity && pipListener != null) return

    // Remove old listener, if any.
    if (existing != null && pipListener != null) {
      try {
        existing.removeOnPictureInPictureModeChangedListener(pipListener!!)
      } catch (t: Throwable) {
        // ignore
      }
    }

    val listener = Consumer<PictureInPictureModeChangedInfo> { info ->
      handlePipModeChanged(info.isInPictureInPictureMode)
    }
    try {
      componentActivity.addOnPictureInPictureModeChangedListener(listener)
      pipListener = listener
      pipListenerActivityRef = WeakReference(componentActivity)
    } catch (t: Throwable) {
      Log.w(TAG, "Failed to attach PiP listener", t)
    }
  }

  private fun handlePipModeChanged(isPipNow: Boolean) {
    if (isInPipMode == isPipNow) return
    isInPipMode = isPipNow
    emit("onPipModeChanged", isPipNow)
  }

  private fun applyParamsToCurrentActivity() {
    val activity = currentActivityRef?.get() ?: return
    applyParamsToActivity(activity)
  }

  private fun applyParamsToActivity(activity: Activity) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    if (activity is PlayerActivity) return

    // Avoid updating params while already in PiP; OEMs can snap the window back.
    if (activity.isInPictureInPictureMode) return

    try {
      activity.setPictureInPictureParams(buildParams(activity, null, null))
    } catch (t: Throwable) {
      Log.w(TAG, "Failed to apply PiP params", t)
    }
  }

  private fun buildParams(activity: Activity, overrideWidth: Double?, overrideHeight: Double?): PictureInPictureParams {
    val builder = PictureInPictureParams.Builder()

    val ratio = buildAspectRatio(overrideWidth, overrideHeight) ?: aspectRatio
    if (ratio != null) {
      try {
        builder.setAspectRatio(ratio)
      } catch (t: Throwable) {
        // ignore
      }
    }

    // Source rect hint for smoother transitions.
    val rect = computeSourceRectHint(activity)
    if (rect != null) {
      try {
        builder.setSourceRectHint(rect)
      } catch (t: Throwable) {
        // ignore
      }
    }

    // Prefer disabling seamless resize for SurfaceView-backed renderers.
    setSeamlessResizeEnabledCompat(builder, false)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      try {
        builder.setAutoEnterEnabled(enabled && isPlaying)
      } catch (t: Throwable) {
        // ignore
      }
    }

    return builder.build()
  }

  private fun computeSourceRectHint(activity: Activity): Rect? {
    val view = playerViewRef?.get() ?: return null
    if (!view.isAttachedToWindow) return null

    val outRect = Rect()
    val ok = try {
      view.getGlobalVisibleRect(outRect)
    } catch (t: Throwable) {
      false
    }
    return if (ok) outRect else null
  }

  private fun buildAspectRatio(width: Double?, height: Double?): Rational? {
    val w = (width ?: 0.0).toDouble()
    val h = (height ?: 0.0).toDouble()
    if (w <= 0.0 || h <= 0.0) return null

    val ratio = (w / h).coerceIn(MIN_ASPECT, MAX_ASPECT)
    val denom = 1000
    val num = (ratio * denom).roundToInt().coerceAtLeast(1)
    return try {
      Rational(num, denom)
    } catch (_: Throwable) {
      null
    }
  }

  private fun setSeamlessResizeEnabledCompat(builder: PictureInPictureParams.Builder, enabled: Boolean) {
    // PictureInPictureParams.Builder#setSeamlessResizeEnabled is API 31.
    try {
      val m = builder.javaClass.getMethod("setSeamlessResizeEnabled", Boolean::class.javaPrimitiveType)
      m.invoke(builder, enabled)
    } catch (_: Throwable) {
      // ignore
    }
  }

  private fun emit(eventName: String, payload: Any?) {
    val reactContext = reactContextRef?.get() ?: return
    mainHandler.post {
      try {
        reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(eventName, payload)
      } catch (t: Throwable) {
        Log.w(TAG, "emit($eventName) failed", t)
      }
    }
  }
}
