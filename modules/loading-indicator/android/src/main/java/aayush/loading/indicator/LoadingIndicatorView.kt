package aayush.loading.indicator

import android.content.Context
import android.graphics.Color
import com.google.android.material.loadingindicator.LoadingIndicator
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

class LoadingIndicatorView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    private val indicator = LoadingIndicator(context)

    init {
        addView(indicator)
    }

    fun setIndicatorColor(color: Int) {
        indicator.setIndicatorColor(color)
    }

    fun setContainerColor(color: Int?) {
        indicator.containerColor = color ?: Color.TRANSPARENT
    }

    fun setIndicatorSize(size: Int) {
        indicator.indicatorSize = size
    }

    fun setContainerSize(size: Int) {
        indicator.containerHeight = size
        indicator.containerWidth = size
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        super.onLayout(changed, l, t, r, b)
        val width = r - l
        val height = b - t
        indicator.layout(0, 0, width, height)
    }
}
