package aayush.crispy.core

import android.content.Context
import android.util.Log
import android.view.ViewGroup
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.common.VideoSize
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactContext
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import android.os.Handler
import android.os.Looper

class CrispyExoVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext), PipPlaybackTarget {

    companion object {
        private const val TAG = "CrispyExoVideoView"
        private const val PROGRESS_INTERVAL_MS = 500L
    }

    private val playerView = PlayerView(context)
    private val trackSelector = DefaultTrackSelector(context)

    private val httpDataSourceFactory = DefaultHttpDataSource.Factory()
        .setAllowCrossProtocolRedirects(true)

    private val player: ExoPlayer = ExoPlayer.Builder(context)
        .setTrackSelector(trackSelector)
        .setMediaSourceFactory(DefaultMediaSourceFactory(httpDataSourceFactory))
        .build()

    private var mediaSessionHandler: MediaSessionHandler? = null

    private var isPaused: Boolean = true
    private var playInBackground: Boolean = false

    private var lastVideoSize: VideoSize? = null
    private var hasLoadEventFired: Boolean = false
    private var pendingSource: String? = null

    private var requestedResizeMode: String? = null
    private var isInPipMode: Boolean = false

    // Track mapping for index-based selection from JS
    private data class TrackRef(
        val trackGroup: androidx.media3.common.TrackGroup,
        val trackIndexInGroup: Int,
        val type: Int
    )

    private var audioTrackRefs: List<TrackRef> = emptyList()
    private var textTrackRefs: List<TrackRef> = emptyList()

    // Event dispatchers
    val onLoad by EventDispatcher<Map<String, Any>>()
    val onProgress by EventDispatcher<Map<String, Any>>()
    val onEnd by EventDispatcher<Unit>()
    val onError by EventDispatcher<Map<String, String>>()
    val onTracksChanged by EventDispatcher<Map<String, Any>>()

    private val mainHandler = Handler(Looper.getMainLooper())
    private val progressRunnable = object : Runnable {
        override fun run() {
            try {
                val posMs = player.currentPosition
                val durMs = player.duration
                val posSec = posMs.toDouble() / 1000.0
                val durSec = if (durMs > 0) durMs.toDouble() / 1000.0 else 0.0

                onProgress(mapOf(
                    "currentTime" to posSec,
                    "duration" to durSec
                ))

                mediaSessionHandler?.updatePosition(posSec)
                mediaSessionHandler?.updateDuration(durSec)
            } catch (_: Exception) {
                // ignore
            } finally {
                mainHandler.postDelayed(this, PROGRESS_INTERVAL_MS)
            }
        }
    }

    private var resumeOnForeground = false
    private val lifecycleListener = object : LifecycleEventListener {
        override fun onHostPause() {
            val activity = appContext.currentActivity
            val isInPip = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                activity?.isInPictureInPictureMode == true
            } else {
                false
            }

            if (isInPip) {
                Log.d(TAG, "App backgrounded but in PiP — keeping ExoPlayer playing")
                return
            }

            if (playInBackground) {
                Log.d(TAG, "App backgrounded but playInBackground is true — keeping ExoPlayer playing")
                return
            }

            resumeOnForeground = player.isPlaying
            if (resumeOnForeground) {
                Log.d(TAG, "App backgrounded — pausing ExoPlayer")
                setPaused(true)
            }
        }

        override fun onHostResume() {
            if (resumeOnForeground) {
                Log.d(TAG, "App foregrounded — resuming ExoPlayer")
                setPaused(false)
                resumeOnForeground = false
            }
        }

        override fun onHostDestroy() {
            release()
        }
    }

    init {
        playerView.layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        playerView.useController = false
        playerView.player = player
        addView(playerView)

        PlaybackRegistry.register(this)

        // Media session + notification
        mediaSessionHandler = MediaSessionHandler(context, object : MediaSessionHandler.MediaSessionCallbacks {
            override fun onPlay() { setPaused(false) }
            override fun onPause() { setPaused(true) }
            override fun onStop() {
                setPaused(true)
                seek(0.0)
            }
            override fun onSeekTo(pos: Long) { seek(pos / 1000.0) }
        })

        player.addListener(object : androidx.media3.common.Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_READY) {
                    emitLoadIfNeeded()
                } else if (playbackState == Player.STATE_ENDED) {
                    onEnd(Unit)
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                onError(mapOf("error" to (error.message ?: "ExoPlayer error")))
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                isPaused = !isPlaying

                // Keep PiP gating in sync with actual playback.
                PipState.isPlaying = isPlaying
                PipState.applyToActivity(appContext.currentActivity)

                mediaSessionHandler?.updatePlaybackState(isPlaying)
            }

            override fun onVideoSizeChanged(videoSize: VideoSize) {
                lastVideoSize = videoSize
                if (videoSize.width > 0 && videoSize.height > 0) {
                    PipState.setAspectRatio(videoSize.width.toDouble(), videoSize.height.toDouble())
                    PipState.applyToActivity(appContext.currentActivity)
                }
                emitLoadIfNeeded()
            }

            override fun onTracksChanged(tracks: androidx.media3.common.Tracks) {
                parseAndSendTracks(tracks)
            }
        })

        // Start progress dispatch.
        mainHandler.post(progressRunnable)

        (context as? ReactContext)?.addLifecycleEventListener(lifecycleListener)
    }

    fun setPlayInBackground(enabled: Boolean) {
        playInBackground = enabled
    }

    fun setHeaders(headers: Map<String, String>?) {
        if (headers == null) {
            httpDataSourceFactory.setDefaultRequestProperties(emptyMap<String, String>())
            return
        }

        // Media3 expects Map<String, String>
        httpDataSourceFactory.setDefaultRequestProperties(headers)
    }

    fun setResizeMode(mode: String?) {
        requestedResizeMode = mode
        applyResizeMode(if (isInPipMode) "contain" else mode)
    }

    private fun applyResizeMode(mode: String?) {
        playerView.resizeMode = when (mode) {
            "cover" -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
            "stretch" -> AspectRatioFrameLayout.RESIZE_MODE_FILL
            else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
        }
    }

    fun setRate(rate: Double) {
        try {
            player.setPlaybackSpeed(rate.toFloat())
        } catch (e: Exception) {
            Log.w(TAG, "Failed to set playback speed", e)
        }
    }

    fun setVolume(volume: Double) {
        try {
            player.volume = volume.toFloat().coerceIn(0f, 1f)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to set volume", e)
        }
    }

    fun setSource(url: String?) {
        if (url.isNullOrBlank()) return

        hasLoadEventFired = false
        pendingSource = url

        try {
            player.setMediaItem(MediaItem.fromUri(url))
            player.prepare()
            applyPlayPause()
        } catch (e: Exception) {
            onError(mapOf("error" to (e.message ?: "Failed to load media")))
        }
    }

    fun setPaused(paused: Boolean) {
        isPaused = paused
        applyPlayPause()
    }

    private fun applyPlayPause() {
        try {
            if (isPaused) player.pause() else player.play()
            mediaSessionHandler?.updatePlaybackState(!isPaused)
            PipState.isPlaying = !isPaused
            PipState.applyToActivity(appContext.currentActivity)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to apply play/pause", e)
        }
    }

    fun seek(positionSec: Double) {
        try {
            player.seekTo((positionSec * 1000.0).toLong())
        } catch (_: Exception) {
            // ignore
        }
    }

    fun setMetadata(title: String, artist: String, artworkUrl: String?) {
        mediaSessionHandler?.updateMetadata(title, artist, artworkUrl)
    }

    fun setAudioTrack(trackId: Int) {
        try {
            val builder = player.trackSelectionParameters.buildUpon()

            if (trackId < 0) {
                builder.setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, true)
                player.trackSelectionParameters = builder.build()
                return
            }

            val ref = audioTrackRefs.getOrNull(trackId) ?: return
            builder.setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, false)
            builder.setOverrideForType(
                androidx.media3.common.TrackSelectionOverride(ref.trackGroup, listOf(ref.trackIndexInGroup))
            )
            player.trackSelectionParameters = builder.build()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to set audio track", e)
        }
    }

    fun setSubtitleTrack(trackId: Int) {
        try {
            val builder = player.trackSelectionParameters.buildUpon()

            if (trackId < 0) {
                builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                player.trackSelectionParameters = builder.build()
                return
            }

            val ref = textTrackRefs.getOrNull(trackId) ?: return
            builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
            builder.setOverrideForType(
                androidx.media3.common.TrackSelectionOverride(ref.trackGroup, listOf(ref.trackIndexInGroup))
            )
            player.trackSelectionParameters = builder.build()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to set subtitle track", e)
        }
    }

    private fun emitLoadIfNeeded() {
        if (hasLoadEventFired) return

        val durMs = player.duration
        if (durMs <= 0) return

        val durationSec = durMs.toDouble() / 1000.0
        val vs = lastVideoSize
        val w = vs?.width ?: 0
        val h = vs?.height ?: 0

        val safeW = if (w > 0) w else 1920
        val safeH = if (h > 0) h else 1080

        hasLoadEventFired = true
        onLoad(mapOf(
            "duration" to durationSec,
            "width" to safeW,
            "height" to safeH
        ))
    }

    private fun parseAndSendTracks(tracks: androidx.media3.common.Tracks) {
        try {
            val audioTracks = mutableListOf<Map<String, Any>>()
            val subtitleTracks = mutableListOf<Map<String, Any>>()

            val audioRefs = mutableListOf<TrackRef>()
            val textRefs = mutableListOf<TrackRef>()

            for (group in tracks.groups) {
                val type = group.type
                val tg = group.mediaTrackGroup
                for (i in 0 until tg.length) {
                    if (!group.isTrackSupported(i)) continue

                    val fmt = tg.getFormat(i)
                    val label = fmt.label ?: ""
                    val lang = fmt.language ?: ""
                    val name = if (label.isNotBlank()) label else if (lang.isNotBlank()) lang.uppercase() else "Track"

                    when (type) {
                        C.TRACK_TYPE_AUDIO -> {
                            val id = audioRefs.size
                            audioRefs.add(TrackRef(tg, i, type))
                            audioTracks.add(mapOf(
                                "id" to id,
                                "name" to name,
                                "language" to lang
                            ))
                        }
                        C.TRACK_TYPE_TEXT -> {
                            val id = textRefs.size
                            textRefs.add(TrackRef(tg, i, type))
                            subtitleTracks.add(mapOf(
                                "id" to id,
                                "name" to name,
                                "language" to lang
                            ))
                        }
                    }
                }
            }

            audioTrackRefs = audioRefs
            textTrackRefs = textRefs

            onTracksChanged(mapOf(
                "audioTracks" to audioTracks,
                "subtitleTracks" to subtitleTracks
            ))
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse tracks", e)
        }
    }

    private fun release() {
        try {
            mainHandler.removeCallbacksAndMessages(null)
            playerView.player = null
            player.release()
        } catch (_: Exception) {
            // ignore
        } finally {
            mediaSessionHandler?.release()
            mediaSessionHandler = null
            (context as? ReactContext)?.removeLifecycleEventListener(lifecycleListener)
            PlaybackRegistry.unregister(this)
        }
    }

    override fun onPipModeChanged(isPip: Boolean) {
        isInPipMode = isPip
        applyResizeMode(if (isPip) "contain" else requestedResizeMode)
    }

    override fun pauseFromPipDismissed() {
        setPaused(true)
    }
}
