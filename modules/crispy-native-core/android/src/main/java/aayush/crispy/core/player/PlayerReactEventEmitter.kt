package aayush.crispy.core.player

import android.content.Context
import android.content.ContextWrapper
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.ViewGroup
import com.facebook.react.ReactActivity
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.ArrayDeque

/**
 * Robust JS event emitter for ReactActivity-backed screens.
 *
 * - Attempts multiple ways to get a ReactContext (classic bridge and bridgeless).
 * - Queues events when ReactContext isn't ready.
 * - Retries for a short time window (TTL) and prunes old events.
 */
internal class PlayerReactEventEmitter(
  private val activity: ReactActivity,
  private val tag: String,
  private val mainHandler: Handler = Handler(Looper.getMainLooper()),
  private val jsEmitRetryMs: Long = 250L,
  private val maxPendingEvents: Int = 96,
  private val pendingEventTtlMs: Long = 12_000L,
  private val reactContextWarnThrottleMs: Long = 2_000L
) {

  private data class PendingJsEvent(
    val eventName: String,
    val payload: Any?,
    val debugName: String,
    val enqueuedAtMs: Long
  )

  private val pendingJsEvents: ArrayDeque<PendingJsEvent> = ArrayDeque()
  private var jsEmitRetryScheduled: Boolean = false
  private var lastReactContextWarnAtMs: Long = 0L

  private val jsEmitRetryRunnable = Runnable {
    jsEmitRetryScheduled = false
    if (activity.isFinishing || isDestroyedCompat(activity)) return@Runnable
    flushQueuedJsEventsOnUiThread()
    if (pendingJsEvents.isNotEmpty()) {
      scheduleJsEmitRetry()
    }
  }

  fun emit(eventName: String, payload: Any?, debugName: String = eventName) {
    activity.runOnUiThread {
      emitOrQueueJsEventOnUiThread(eventName, payload, debugName)
    }
  }

  fun runOnUiThread(block: () -> Unit) {
    activity.runOnUiThread(block)
  }

  fun emitOnUiThread(eventName: String, payload: Any?, debugName: String = eventName) {
    emitOrQueueJsEventOnUiThread(eventName, payload, debugName)
  }

  fun destroy() {
    jsEmitRetryScheduled = false
    mainHandler.removeCallbacks(jsEmitRetryRunnable)
    pendingJsEvents.clear()
  }

  private fun emitOrQueueJsEventOnUiThread(eventName: String, payload: Any?, debugName: String) {
    if (tryEmitJsEvent(eventName, payload, debugName)) {
      flushQueuedJsEventsOnUiThread()
      return
    }

    enqueueJsEventOnUiThread(PendingJsEvent(eventName, payload, debugName, SystemClock.uptimeMillis()))
    scheduleJsEmitRetry()
  }

  private fun tryEmitJsEvent(eventName: String, payload: Any?, debugName: String): Boolean {
    val rc = getReactContextUnsafe()
    if (rc == null) {
      maybeLogReactContextUnavailable(debugName)
      return false
    }

    return try {
      rc
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, payload)
      true
    } catch (t: Exception) {
      Log.e(tag, "Failed to emit $debugName", t)
      false
    }
  }

  private fun enqueueJsEventOnUiThread(event: PendingJsEvent) {
    pruneExpiredJsEventsOnUiThread(event.enqueuedAtMs)

    while (pendingJsEvents.size >= maxPendingEvents) {
      pendingJsEvents.removeFirst()
    }

    pendingJsEvents.addLast(event)
  }

  private fun flushQueuedJsEventsOnUiThread() {
    if (pendingJsEvents.isEmpty()) return

    pruneExpiredJsEventsOnUiThread(SystemClock.uptimeMillis())

    while (pendingJsEvents.isNotEmpty()) {
      val next = pendingJsEvents.peekFirst() ?: break
      if (!tryEmitJsEvent(next.eventName, next.payload, next.debugName)) {
        scheduleJsEmitRetry()
        return
      }
      pendingJsEvents.removeFirst()
    }
  }

  private fun pruneExpiredJsEventsOnUiThread(nowMs: Long) {
    while (pendingJsEvents.isNotEmpty()) {
      val head = pendingJsEvents.peekFirst() ?: break
      if (nowMs - head.enqueuedAtMs <= pendingEventTtlMs) break
      pendingJsEvents.removeFirst()
    }
  }

  private fun scheduleJsEmitRetry() {
    if (jsEmitRetryScheduled) return
    jsEmitRetryScheduled = true
    mainHandler.postDelayed(jsEmitRetryRunnable, jsEmitRetryMs)
  }

  private fun maybeLogReactContextUnavailable(debugName: String) {
    val now = SystemClock.uptimeMillis()
    if (now - lastReactContextWarnAtMs < reactContextWarnThrottleMs) return
    lastReactContextWarnAtMs = now
    Log.w(tag, "ReactContext unavailable, queueing event=$debugName pending=${pendingJsEvents.size}")
  }

  private fun getReactContextUnsafe(): ReactContext? {
    val fromActivityManager = getReactContextFromActivityManager(activity)
    if (fromActivityManager != null) return fromActivityManager

    try {
      val app = activity.application as? ReactApplication
      val ctx = app?.reactNativeHost?.reactInstanceManager?.currentReactContext
      if (ctx != null) return ctx
    } catch (_: Exception) {}

    // Bridgeless fallback: try ReactHost#getCurrentReactContext via reflection.
    val fromActivityHost = getReactContextFromReactHost(activity)
    if (fromActivityHost != null) return fromActivityHost

    val fromAppHost = getReactContextFromReactHost(activity.application)
    if (fromAppHost != null) return fromAppHost

    // Fallback: look for a mounted root view with a ReactContext.
    val content = activity.findViewById<ViewGroup>(android.R.id.content)
    if (content != null) {
      for (i in 0 until content.childCount) {
        val child = content.getChildAt(i) ?: continue
        val ctx = unwrapReactContext(child.context)
        if (ctx != null) return ctx
      }
    }

    return null
  }

  private fun getReactContextFromActivityManager(activity: ReactActivity): ReactContext? {
    return try {
      var owner: Class<*>? = activity.javaClass
      var getReactInstanceManager: java.lang.reflect.Method? = null
      while (owner != null && getReactInstanceManager == null) {
        getReactInstanceManager = owner.declaredMethods.firstOrNull {
          it.name == "getReactInstanceManager" && it.parameterTypes.isEmpty()
        }
        owner = owner.superclass
      }

      val managerMethod = getReactInstanceManager ?: return null
      managerMethod.isAccessible = true
      val reactInstanceManager = managerMethod.invoke(activity) ?: return null

      val getCurrentReactContext = reactInstanceManager.javaClass.methods.firstOrNull {
        it.name == "getCurrentReactContext" && it.parameterTypes.isEmpty()
      } ?: return null

      getCurrentReactContext.invoke(reactInstanceManager) as? ReactContext
    } catch (_: Exception) {
      null
    } catch (_: LinkageError) {
      null
    }
  }

  private fun getReactContextFromReactHost(hostOwner: Any?): ReactContext? {
    if (hostOwner == null) return null
    return try {
      val getReactHost = hostOwner.javaClass.methods.firstOrNull {
        it.name == "getReactHost" && it.parameterTypes.isEmpty()
      } ?: return null

      val reactHost = getReactHost.invoke(hostOwner) ?: return null
      val getCurrentReactContext = reactHost.javaClass.methods.firstOrNull {
        it.name == "getCurrentReactContext" && it.parameterTypes.isEmpty()
      } ?: return null

      getCurrentReactContext.invoke(reactHost) as? ReactContext
    } catch (_: Exception) {
      null
    } catch (_: LinkageError) {
      null
    }
  }

  private fun unwrapReactContext(context: Context?): ReactContext? {
    var current = context
    var guard = 0
    while (current != null && guard < 12) {
      if (current is ReactContext) return current
      current = (current as? ContextWrapper)?.baseContext
      guard += 1
    }
    return null
  }

  private fun isDestroyedCompat(activity: ReactActivity): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
      activity.isDestroyed
    } else {
      false
    }
  }
}
