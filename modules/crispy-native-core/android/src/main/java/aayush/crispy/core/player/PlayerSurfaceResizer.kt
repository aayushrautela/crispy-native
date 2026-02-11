package aayush.crispy.core.player

import android.util.Log
import android.view.ViewGroup
import android.widget.FrameLayout
import kotlin.math.max

internal class PlayerSurfaceResizer(
  private val tag: String
) {

  data class Result(
    val status: Status,
    val mode: String,
    val targetW: Int = 0,
    val targetH: Int = 0,
    val videoRatio: Double = 0.0,
    val containerRatio: Double = 0.0,
    val changed: Boolean = false
  )

  enum class Status {
    SKIPPED_NOT_READY,
    APPLIED,
    NO_OP
  }

  fun apply(
    videoView: android.view.View?,
    subtitleView: android.view.View?,
    containerW: Int,
    containerH: Int,
    videoW: Int,
    videoH: Int,
    resizeMode: String?
  ): Result {
    if (videoView == null) return Result(Status.SKIPPED_NOT_READY, mode = (resizeMode ?: "contain").lowercase())
    if (containerW <= 0 || containerH <= 0 || videoW <= 0 || videoH <= 0) {
      return Result(Status.SKIPPED_NOT_READY, mode = (resizeMode ?: "contain").lowercase())
    }

    val mode = (resizeMode ?: "contain").lowercase()
    val vRatio = videoW.toDouble() / videoH.toDouble()
    val cRatio = containerW.toDouble() / containerH.toDouble()

    var targetW = containerW
    var targetH = containerH

    if (mode == "cover") {
      if (cRatio > vRatio) {
        targetW = containerW
        targetH = (containerW / vRatio).toInt()
      } else {
        targetH = containerH
        targetW = (containerH * vRatio).toInt()
      }
    } else {
      if (cRatio > vRatio) {
        targetH = containerH
        targetW = (containerH * vRatio).toInt()
      } else {
        targetW = containerW
        targetH = (containerW / vRatio).toInt()
      }
    }

    targetW = max(1, targetW)
    targetH = max(1, targetH)

    var changed = false
    val params = (videoView.layoutParams as? FrameLayout.LayoutParams)
      ?: FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    if (params.width != targetW || params.height != targetH) {
      params.width = targetW
      params.height = targetH
      params.gravity = android.view.Gravity.CENTER
      videoView.layoutParams = params
      changed = true
    }

    if (subtitleView != null) {
      val subParams = (subtitleView.layoutParams as? FrameLayout.LayoutParams)
        ?: FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
      if (subParams.width != targetW || subParams.height != targetH) {
        subParams.width = targetW
        subParams.height = targetH
        subParams.gravity = android.view.Gravity.CENTER
        subtitleView.layoutParams = subParams
        changed = true
      }
    }

    if (changed) {
      Log.i(tag, "applyResizeTransform mode=$mode container=${containerW}x${containerH} video=${videoW}x${videoH} -> ${targetW}x${targetH}")
      return Result(Status.APPLIED, mode = mode, targetW = targetW, targetH = targetH, videoRatio = vRatio, containerRatio = cRatio, changed = true)
    }
    return Result(Status.NO_OP, mode = mode, targetW = targetW, targetH = targetH, videoRatio = vRatio, containerRatio = cRatio, changed = false)
  }
}
