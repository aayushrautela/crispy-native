package aayush.crispy.core

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CrispyExoPlayerModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("CrispyExoPlayer")

        View(CrispyExoVideoView::class) {
            Prop("source") { view: CrispyExoVideoView, url: String? ->
                view.setSource(url)
            }

            Prop("headers") { view: CrispyExoVideoView, headers: Map<String, String>? ->
                view.setHeaders(headers)
            }

            Prop("paused") { view: CrispyExoVideoView, paused: Boolean ->
                view.setPaused(paused)
            }

            Prop("resizeMode") { view: CrispyExoVideoView, mode: String? ->
                view.setResizeMode(mode)
            }

            Prop("rate") { view: CrispyExoVideoView, rate: Double ->
                view.setRate(rate)
            }

            Prop("volume") { view: CrispyExoVideoView, volume: Double ->
                view.setVolume(volume)
            }

            Prop("metadata") { view: CrispyExoVideoView, metadata: Map<String, Any>? ->
                metadata?.let {
                    val title = it["title"] as? String ?: ""
                    val artist = (it["artist"] as? String) ?: (it["subtitle"] as? String) ?: ""
                    val artworkUrl = it["artworkUrl"] as? String
                    view.setMetadata(title, artist, artworkUrl)
                }
            }

            Prop("playInBackground") { view: CrispyExoVideoView, playInBackground: Boolean ->
                view.setPlayInBackground(playInBackground)
            }

            Events("onLoad", "onProgress", "onEnd", "onError", "onTracksChanged")

            AsyncFunction("seek") { view: CrispyExoVideoView, positionSec: Double ->
                view.seek(positionSec)
            }

            AsyncFunction("setAudioTrack") { view: CrispyExoVideoView, trackId: Int ->
                view.setAudioTrack(trackId)
            }

            AsyncFunction("setSubtitleTrack") { view: CrispyExoVideoView, trackId: Int ->
                view.setSubtitleTrack(trackId)
            }
        }
    }
}
