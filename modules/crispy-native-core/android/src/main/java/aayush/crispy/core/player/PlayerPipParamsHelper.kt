package aayush.crispy.core.player

import android.app.PictureInPictureParams
import android.graphics.Rect
import android.os.Build
import android.util.Rational
import android.view.View
import kotlin.math.roundToInt

internal class PlayerPipParamsHelper(
  private val maxAspect: Double,
  private val minAspect: Double
) {

  private val warnLog = PlayerThrottledLogger("PlayerPip")

  fun buildParams(sourceView: View?, videoW: Int, videoH: Int, isPlaying: Boolean): PictureInPictureParams {
    val builder = PictureInPictureParams.Builder()

    val ratio = buildAspectRatio(videoW, videoH)
    if (ratio != null) {
      try {
        builder.setAspectRatio(ratio)
      } catch (e: Exception) {
        warnLog.w("setAspectRatio", "PiP setAspectRatio failed", e, throttleMs = 60_000L)
      }
    }

    val rect = computeSourceRectHint(sourceView)
    if (rect != null) {
      try {
        builder.setSourceRectHint(rect)
      } catch (e: Exception) {
        warnLog.w("setSourceRectHint", "PiP setSourceRectHint failed", e, throttleMs = 60_000L)
      }
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      try {
        builder.setAutoEnterEnabled(isPlaying)
      } catch (e: Exception) {
        warnLog.w("setAutoEnterEnabled", "PiP setAutoEnterEnabled failed", e, throttleMs = 60_000L)
      }
      setSeamlessResizeEnabledCompat(builder, false)
    }

    return builder.build()
  }

  fun updateParams(activity: PlayerActivity, sourceView: View?, videoW: Int, videoH: Int, isPlaying: Boolean) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    if (activity.isInPictureInPictureMode) return

    try {
      activity.setPictureInPictureParams(buildParams(sourceView, videoW, videoH, isPlaying))
    } catch (e: Exception) {
      warnLog.w("setPictureInPictureParams", "PiP setPictureInPictureParams failed", e, throttleMs = 60_000L)
    }
  }

  private fun computeSourceRectHint(sourceView: View?): Rect? {
    val sv = sourceView ?: return null
    if (sv.width <= 0 || sv.height <= 0) return null

    val out = Rect()
    val ok = try {
      sv.getGlobalVisibleRect(out)
    } catch (_: Exception) {
      false
    }
    if (!ok) return null
    return out
  }

  private fun buildAspectRatio(width: Int, height: Int): Rational? {
    if (width <= 0 || height <= 0) return null
    val ratio = (width.toDouble() / height.toDouble()).coerceIn(minAspect, maxAspect)
    val denom = 1000
    val num = (ratio * denom).roundToInt().coerceAtLeast(1)
    return try {
      Rational(num, denom)
    } catch (_: Exception) {
      null
    }
  }

  private fun setSeamlessResizeEnabledCompat(builder: PictureInPictureParams.Builder, enabled: Boolean) {
    try {
      val m = builder.javaClass.getMethod("setSeamlessResizeEnabled", Boolean::class.javaPrimitiveType)
      m.invoke(builder, enabled)
    } catch (e: Exception) {
      // Reflection: the method may not exist on some builds; don't spam logs.
      warnLog.w("setSeamlessResizeEnabled", "PiP seamless resize compat not available", e, throttleMs = 60_000L)
    }
  }
}
