package aayush.crispy.core

import android.app.Activity
import android.app.PictureInPictureParams
import android.os.Build
import android.graphics.Rect
import android.util.Rational
import android.util.Log

/**
 * Shared PiP state used by both the Expo module and MainActivity.
 *
 * This allows JS to provide the latest video aspect ratio + playback state,
 * and lets MainActivity decide whether to enter PiP on user-leave.
 */
object PipState {
    private const val TAG = "PipState"

    @Volatile
    var enabled: Boolean = false

    @Volatile
    var isPlaying: Boolean = false

    @Volatile
    private var aspectRatio: Rational? = null

    fun setAspectRatio(width: Double?, height: Double?) {
        if (width == null || height == null) return
        if (width <= 0 || height <= 0) return

        val w = width.toInt().coerceAtLeast(1)
        val h = height.toInt().coerceAtLeast(1)
        aspectRatio = clampAspectRatio(Rational(w, h))
    }

    fun getAspectRatio(): Rational? = aspectRatio

    fun shouldEnterOnUserLeave(): Boolean {
        // We only enter PiP when explicitly enabled by the player screen.
        // Most users expect PiP only while content is actively playing.
        return enabled && isPlaying
    }

    fun applyToActivity(activity: Activity?) {
        if (activity == null) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        try {
            val builder = PictureInPictureParams.Builder()
            getAspectRatio()?.let { builder.setAspectRatio(it) }

            try {
                val rect = Rect()
                if (activity.window?.decorView?.getGlobalVisibleRect(rect) == true && !rect.isEmpty) {
                    builder.setSourceRectHint(rect)
                }
            } catch (_: Exception) {
                // ignore
            }

            // Android 12+ can auto-enter PiP when the user goes home.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                builder.setAutoEnterEnabled(shouldEnterOnUserLeave())
            }

            activity.setPictureInPictureParams(builder.build())
        } catch (e: Exception) {
            Log.w(TAG, "Failed to apply PiP params", e)
        }
    }

    fun enterPiP(activity: Activity?, overrideWidth: Double?, overrideHeight: Double?): Boolean {
        if (activity == null) return false
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false

        try {
            // Prefer explicit ratio when provided, otherwise last known.
            if (overrideWidth != null && overrideHeight != null) {
                setAspectRatio(overrideWidth, overrideHeight)
            }

            val builder = PictureInPictureParams.Builder()
            getAspectRatio()?.let { builder.setAspectRatio(it) }

            try {
                val rect = Rect()
                if (activity.window?.decorView?.getGlobalVisibleRect(rect) == true && !rect.isEmpty) {
                    builder.setSourceRectHint(rect)
                }
            } catch (_: Exception) {
                // ignore
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                builder.setAutoEnterEnabled(shouldEnterOnUserLeave())
            }

            return activity.enterPictureInPictureMode(builder.build())
        } catch (e: Exception) {
            Log.w(TAG, "Failed to enter PiP", e)
            return false
        }
    }

    /**
     * Android PiP has aspect ratio limits.
     * If out-of-range, setAspectRatio / enterPictureInPictureMode can throw.
     */
    private fun clampAspectRatio(r: Rational): Rational {
        val w = r.numerator.toDouble()
        val h = r.denominator.toDouble()
        if (w <= 0 || h <= 0) return Rational(16, 9)

        val ratio = w / h
        val min = 1.0 / 2.39
        val max = 2.39
        val clamped = ratio.coerceIn(min, max)

        // Preserve height and adjust width.
        val baseH = 1000
        val adjW = (baseH * clamped).toInt().coerceAtLeast(1)
        return Rational(adjW, baseH)
    }
}
