package aayush.loading.indicator

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LoadingIndicatorModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("LoadingIndicator")

        View(LoadingIndicatorView::class) {
            Prop("color") { view: LoadingIndicatorView, color: Int ->
                view.setIndicatorColor(color)
            }

            Prop("containerColor") { view: LoadingIndicatorView, color: Int? ->
                view.setContainerColor(color)
            }

            Prop("size") { view: LoadingIndicatorView, size: Int ->
                view.setIndicatorSize(size)
            }

            Prop("containerSize") { view: LoadingIndicatorView, size: Int ->
                view.setContainerSize(size)
            }
        }
    }
}
