package aayush.crispy.core.player

import android.os.SystemClock
import android.util.Log

/**
 * Tiny throttling helper to avoid log spam.
 *
 * Thread-safe.
 */
internal class PlayerThrottledLogger(
  private val tag: String,
  private val defaultThrottleMs: Long = 5_000L
) {

  private val lastAtByKey: HashMap<String, Long> = HashMap()

  fun w(key: String, message: String, e: Exception? = null, throttleMs: Long = defaultThrottleMs) {
    val shouldLog = synchronized(lastAtByKey) {
      val now = SystemClock.uptimeMillis()
      val last = lastAtByKey[key] ?: 0L
      if (now - last < throttleMs) {
        false
      } else {
        lastAtByKey[key] = now
        true
      }
    }
    if (!shouldLog) return

    if (e != null) {
      Log.w(tag, message, e)
    } else {
      Log.w(tag, message)
    }
  }
}
