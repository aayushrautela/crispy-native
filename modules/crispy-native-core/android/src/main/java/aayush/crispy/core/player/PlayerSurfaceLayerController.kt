package aayush.crispy.core.player

import android.graphics.Color
import android.graphics.PixelFormat
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout

/**
 * Installs the SurfaceView layers behind the React root view.
 *
 * Layers (back to front):
 * - Video SurfaceView (opaque)
 * - Subtitle SurfaceView (transparent media overlay)
 * - React root view (UI overlay)
 */
internal class PlayerSurfaceLayerController(
  private val activity: PlayerActivity,
  private val callbacks: Callbacks
) {

  private val warnLog = PlayerThrottledLogger("PlayerSurfaceLayer")

  private inline fun bestEffort(step: String, crossinline block: () -> Unit) {
    try {
      block()
    } catch (e: Exception) {
      warnLog.w(step, "Best-effort surface layer step failed: $step", e)
    }
  }

  interface Callbacks {
    fun onContainerLayoutChanged(newW: Int, newH: Int, oldW: Int, oldH: Int)

    fun onVideoSurfaceCreated()
    fun onVideoSurfaceChanged(format: Int, width: Int, height: Int)
    fun onVideoSurfaceDestroyed()

    fun onSubtitleSurfaceCreated()
    fun onSubtitleSurfaceChanged(format: Int, width: Int, height: Int)
    fun onSubtitleSurfaceDestroyed()
  }

  var videoSurfaceView: SurfaceView? = null
    private set
  var subtitleSurfaceView: SurfaceView? = null
    private set
  var reactRootView: View? = null
    private set

  private var content: ViewGroup? = null
  private var contentLayoutListener: View.OnLayoutChangeListener? = null

  private val videoCallback = object : SurfaceHolder.Callback {
    override fun surfaceCreated(holder: SurfaceHolder) {
      callbacks.onVideoSurfaceCreated()
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
      callbacks.onVideoSurfaceChanged(format, width, height)
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
      callbacks.onVideoSurfaceDestroyed()
    }
  }

  private val subtitleCallback = object : SurfaceHolder.Callback {
    override fun surfaceCreated(holder: SurfaceHolder) {
      callbacks.onSubtitleSurfaceCreated()
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
      callbacks.onSubtitleSurfaceChanged(format, width, height)
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
      callbacks.onSubtitleSurfaceDestroyed()
    }
  }

  fun install() {
    val content = activity.findViewById<ViewGroup>(android.R.id.content) ?: return
    this.content = content

    // Ensure letterboxing area is true black (not theme default gray).
    content.setBackgroundColor(Color.BLACK)

    val reactRoot = content.getChildAt(0)
    reactRootView = reactRoot
    reactRoot?.setBackgroundColor(Color.TRANSPARENT)

    val videoSv = SurfaceView(activity)
    videoSv.setZOrderOnTop(false)
    videoSv.setZOrderMediaOverlay(false)
    bestEffort("videoSurface.setFormat") {
      videoSv.holder.setFormat(PixelFormat.OPAQUE)
    }
    videoSv.layoutParams = FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT,
      android.view.Gravity.CENTER
    )
    videoSv.holder.addCallback(videoCallback)
    videoSurfaceView = videoSv
    content.addView(videoSv, 0)

    val subtitleSv = SurfaceView(activity)
    subtitleSv.setZOrderOnTop(false)
    subtitleSv.setZOrderMediaOverlay(true)
    bestEffort("subtitleSurface.setFormat") {
      subtitleSv.holder.setFormat(PixelFormat.TRANSLUCENT)
    }
    subtitleSv.setBackgroundColor(Color.TRANSPARENT)
    subtitleSv.layoutParams = FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT,
      android.view.Gravity.CENTER
    )
    subtitleSv.holder.addCallback(subtitleCallback)
    subtitleSurfaceView = subtitleSv
    // Add above video surface, below React root.
    content.addView(subtitleSv, 1)

    // Keep container dimensions in sync (PiP resize / multi-window).
    val listener = View.OnLayoutChangeListener { _, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom ->
      val newW = right - left
      val newH = bottom - top
      val oldW = oldRight - oldLeft
      val oldH = oldBottom - oldTop
      if (newW <= 0 || newH <= 0) return@OnLayoutChangeListener
      if (newW == oldW && newH == oldH) return@OnLayoutChangeListener
      callbacks.onContainerLayoutChanged(newW, newH, oldW, oldH)
    }
    content.addOnLayoutChangeListener(listener)
    contentLayoutListener = listener
  }

  fun setReactOverlayVisible(visible: Boolean): Boolean {
    val v = reactRootView ?: return false
    val next = if (visible) View.VISIBLE else View.INVISIBLE
    if (v.visibility == next) return false
    v.visibility = next
    return true
  }

  fun dispose() {
    val videoSv = videoSurfaceView
    val subtitleSv = subtitleSurfaceView

    videoSv?.holder?.removeCallback(videoCallback)
    subtitleSv?.holder?.removeCallback(subtitleCallback)

    val content = content
    val listener = contentLayoutListener
    if (content != null && listener != null) {
      content.removeOnLayoutChangeListener(listener)
    }

    contentLayoutListener = null
    this.content = null
    videoSurfaceView = null
    subtitleSurfaceView = null
    reactRootView = null
  }
}
