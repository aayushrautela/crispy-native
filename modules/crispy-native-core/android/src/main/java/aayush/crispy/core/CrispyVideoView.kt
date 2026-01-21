package aayush.crispy.core

import android.content.Context
import android.graphics.SurfaceTexture
import android.util.Log
import android.view.Surface
import android.view.TextureView
import android.view.View
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import `is`.xyz.mpv.MPVLib
import kotlin.math.abs
import androidx.media3.common.*
import androidx.media3.common.util.ListenerSet
import androidx.media3.common.util.Clock
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.PlayerNotificationManager
import android.os.Looper
import coil.ImageLoader
import coil.request.ImageRequest
import android.graphics.drawable.BitmapDrawable

@UnstableApi
class CrispyVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext), TextureView.SurfaceTextureListener, MPVLib.EventObserver, Player {
    companion object {
        private const val TAG = "CrispyVideoView"
        private const val NOTIFICATION_CHANNEL_ID = "crispy_playback_channel"
        private const val NOTIFICATION_ID = 1147
    }

    private val surfaceView = TextureView(context)
    private var isMpvInitialized = false
    private var pendingSource: String? = null
    private var pendingPosition: Double = -1.0
    private var pendingHeaders: Map<String, String>? = null
    private var isPaused = true // Default to paused until told otherwise

    private val addedExternalSubUrls = mutableSetOf<String>()
    private var isFileLoaded = false
    private var hasLoadEventFired = false
    private var pendingCommands = mutableListOf<Array<String>>()
    private var resumeOnForeground = false

    private val listeners: ListenerSet<Player.Listener> =
        ListenerSet(Looper.getMainLooper(), Clock.DEFAULT) { listener: Player.Listener, flags: FlagSet ->
            listener.onEvents(this, Player.Events(flags))
        }

    private var currentMediaItem: MediaItem? = null
    private var isPlayerReady = false
    private var playbackState: Int = Player.STATE_IDLE
    
    private var notificationManager: PlayerNotificationManager? = null
    private var currentMetadata: CrispyMediaMetadata? = null

    // Lifecycle handling via Android lifecycle callbacks
    private fun handleHostPause() {
        resumeOnForeground = !isPaused
        if (resumeOnForeground) {
            Log.d(TAG, "App backgrounded - pausing MPV")
            setPaused(true)
        }
    }

    private fun handleHostResume() {
        if (resumeOnForeground) {
            Log.d(TAG, "App foregrounded - resuming MPV")
            setPaused(false)
            resumeOnForeground = false
        }
    }

    private var durationSec: Double = 0.0
    private var positionSec: Double = 0.0
    private var isSeeking = false

    // Event dispatchers
    val onLoad by EventDispatcher<Map<String, Any>>()
    val onProgress by EventDispatcher<Map<String, Any>>()
    val onEnd by EventDispatcher<Unit>()
    val onError by EventDispatcher<Map<String, String>>()
    val onTracksChanged by EventDispatcher<Map<String, Any>>()

    init {
        surfaceView.surfaceTextureListener = this
        addView(surfaceView, android.view.ViewGroup.LayoutParams(
            android.view.ViewGroup.LayoutParams.MATCH_PARENT, 
            android.view.ViewGroup.LayoutParams.MATCH_PARENT
        ))
        setupNotification()
    }

    // --- TextureView.SurfaceTextureListener ---

    override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {
        Log.d(TAG, "Surface available: ${width}x${height}")
        initMpv(Surface(surface))
    }

    override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) {
        Log.d(TAG, "Surface size changed: ${width}x${height}")
        if (isMpvInitialized) {
            MPVLib.setPropertyString("android-surface-size", "${width}x${height}")
        }
    }

    override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {
        Log.d(TAG, "Surface destroyed")
        destroyMpv()
        return true
    }

    override fun onSurfaceTextureUpdated(surface: SurfaceTexture) {
        // No-op
    }

    // --- MPV Initialization ---

    private fun initMpv(surface: Surface) {
        try {
            MPVLib.create(context.applicationContext)
            initOptions()
            MPVLib.init()
            MPVLib.attachSurface(surface)
            MPVLib.addObserver(this)
            
            // Observe properties for events
            MPVLib.observeProperty("time-pos", MPVLib.MpvFormat.MPV_FORMAT_DOUBLE)
            MPVLib.observeProperty("duration", MPVLib.MpvFormat.MPV_FORMAT_DOUBLE)
            MPVLib.observeProperty("track-list", MPVLib.MpvFormat.MPV_FORMAT_NONE)
            MPVLib.observeProperty("eof-reached", MPVLib.MpvFormat.MPV_FORMAT_FLAG)
            
            isMpvInitialized = true
            Log.d(TAG, "MPV initialized successfully")

            // Restore state if needed
            pendingSource?.let { 
                loadFile(it)
                pendingSource = null 
            }
            if (pendingPosition >= 0) {
                seek(pendingPosition)
                pendingPosition = -1.0
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize MPV", e)
            onError(mapOf("error" to (e.message ?: "Initialization failed")))
        }
    }
    
    private fun initOptions() {
        // Match Nuvio's performance profile
        MPVLib.setOptionString("profile", "fast")
        MPVLib.setOptionString("vo", "gpu")
        MPVLib.setOptionString("gpu-context", "android")
        MPVLib.setOptionString("opengl-es", "yes")
        
        // Match Nuvio's hwdec selection (auto-copy is safest/best balance)
        MPVLib.setOptionString("hwdec", "auto-copy")
        
        MPVLib.setOptionString("target-colorspace-hint", "yes")
        MPVLib.setOptionString("vd-lavc-film-grain", "cpu")
        
        // Cache and Network (Matched to Nuvio)
        val cacheMegs = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) 64 else 32
        MPVLib.setOptionString("demuxer-max-bytes", "${cacheMegs * 1024 * 1024}")
        MPVLib.setOptionString("demuxer-max-back-bytes", "${cacheMegs * 1024 * 1024}")
        MPVLib.setOptionString("cache", "yes")
        MPVLib.setOptionString("cache-secs", "30")
        MPVLib.setOptionString("network-timeout", "60")
        
        // HLS and Reconnect optimization
        MPVLib.setOptionString("http-reconnect", "yes")
        MPVLib.setOptionString("stream-reconnect", "yes")
        // Improve buffer for streaming
        MPVLib.setOptionString("cache", "yes")
        MPVLib.setOptionString("demuxer-max-bytes", "${64 * 1024 * 1024}")
        MPVLib.setOptionString("demuxer-max-back-bytes", "${64 * 1024 * 1024}")

        // Subtitles
        MPVLib.setOptionString("sub-auto", "fuzzy")
        MPVLib.setOptionString("sub-visibility", "yes")
        MPVLib.setOptionString("embeddedfonts", "yes")
        MPVLib.setOptionString("sub-ass-override", "force")
        
        // Initial track selection
        MPVLib.setOptionString("sid", "auto")
        MPVLib.setOptionString("aid", "auto")
        
        // Android-specific
        MPVLib.setOptionString("android-surface-size", "${surfaceView.width}x${surfaceView.height}")

        // UI
        MPVLib.setOptionString("osc", "no")
        MPVLib.setOptionString("osd-level", "1") // Show basic OSD
        MPVLib.setOptionString("terminal", "no")
        MPVLib.setOptionString("input-default-bindings", "no")
    }

    private fun destroyMpv() {
        if (isMpvInitialized) {
            notificationManager?.setPlayer(null)
            MPVLib.removeObserver(this)
            MPVLib.detachSurface()
            MPVLib.destroy()
            isMpvInitialized = false
        }
    }

    // --- MPVLib.EventObserver ---

    override fun eventProperty(property: String) {
        if (property == "track-list") {
            parseAndSendTracks()
        }
    }
    override fun eventProperty(property: String, value: String) { }

    private fun parseAndSendTracks() {
        try {
            val trackCount = MPVLib.getPropertyInt("track-list/count") ?: 0
            Log.d(TAG, "Track count: $trackCount")
            
            val audioTracks = mutableListOf<Map<String, Any>>()
            val subtitleTracks = mutableListOf<Map<String, Any>>()
            
            for (i in 0 until trackCount) {
                val type = MPVLib.getPropertyString("track-list/$i/type") ?: continue
                val id = MPVLib.getPropertyInt("track-list/$i/id") ?: continue
                val title = MPVLib.getPropertyString("track-list/$i/title") ?: ""
                val lang = MPVLib.getPropertyString("track-list/$i/lang") ?: ""
                val codec = MPVLib.getPropertyString("track-list/$i/codec") ?: ""
                
                val trackName = when {
                    title.isNotEmpty() -> title
                    lang.isNotEmpty() -> lang.uppercase()
                    else -> "Track $id"
                }
                
                val track = mapOf(
                    "id" to id,
                    "name" to trackName,
                    "language" to lang,
                    "codec" to codec
                )
                
                when (type) {
                    "audio" -> audioTracks.add(track)
                    "sub" -> subtitleTracks.add(track)
                }
            }
            
            Log.d(TAG, "Sending tracks - Audio: ${audioTracks.size}, Subtitles: ${subtitleTracks.size}")
            onTracksChanged(mapOf(
                "audioTracks" to audioTracks,
                "subtitleTracks" to subtitleTracks
            ))
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing tracks", e)
        }
    }

    override fun eventProperty(property: String, value: Double) {
        if (property == "time-pos") {
            val positionSec = value
            if (!isSeeking && durationSec > 0) {
                onProgress(mapOf("position" to positionSec, "duration" to durationSec))
            }
        } else if (property == "duration") {
            durationSec = value
            // Fire onLoad only once when we have valid duration and ideally dimensions
            if (!hasLoadEventFired && durationSec > 0) {
                val width = MPVLib.getPropertyInt("width") ?: 0
                val height = MPVLib.getPropertyInt("height") ?: 0
                if (width > 0 && height > 0) {
                    hasLoadEventFired = true
                    onLoad(mapOf("duration" to durationSec, "width" to width, "height" to height))
                } else if (durationSec > 0) {
                    // Fallback if dimensions take too long
                    onLoad(mapOf("duration" to durationSec, "width" to 1920, "height" to 1080))
                    hasLoadEventFired = true
                }
            }
        }
    }

    override fun event(eventId: Int) {
        when (eventId) {
           MPVLib.MpvEvent.MPV_EVENT_END_FILE -> {
               isFileLoaded = false
               playbackState = Player.STATE_ENDED
               onEnd(Unit)
               listeners.sendEvent(Player.EVENT_PLAYBACK_STATE_CHANGED) { it.onPlaybackStateChanged(playbackState) }
           }
           MPVLib.MpvEvent.MPV_EVENT_START_FILE -> {
               // Flush pending commands when playback starts
               if (pendingCommands.isNotEmpty()) {
                   Log.d(TAG, "Flushing ${pendingCommands.size} pending commands")
                   for (command in pendingCommands) {
                       MPVLib.command(command)
                   }
                   pendingCommands.clear()
               }
           }
           MPVLib.MpvEvent.MPV_EVENT_FILE_LOADED -> {
               isFileLoaded = true
               isPlayerReady = true
               playbackState = Player.STATE_READY
               // Re-sync tracks when file is fully loaded
               parseAndSendTracks()
               listeners.sendEvent(Player.EVENT_PLAYBACK_STATE_CHANGED) { it.onPlaybackStateChanged(playbackState) }
           }
        }
    }

    // --- Public API ---

    private fun loadFile(url: String) {
        Log.d(TAG, "Loading file: $url")
        isFileLoaded = false
        pendingCommands.clear() // Clear commands from previous file
        MPVLib.command(arrayOf("loadfile", url))
        MPVLib.setPropertyString("pause", if (isPaused) "yes" else "no")
    }

    fun setSource(url: String?) {
        if (url == null) return
        
        // Clear added subtitles for new source
        addedExternalSubUrls.clear()
        
        if (isMpvInitialized) {
            loadFile(url)
        } else {
            pendingSource = url
        }
    }
    
    // Headers support for debrid streams
    fun setHeaders(headers: Map<String, String>?) {
        pendingHeaders = headers
        if (isMpvInitialized && !headers.isNullOrEmpty()) {
            val headerString = headers.entries.joinToString(",") { "${it.key}: ${it.value}" }
            MPVLib.setOptionString("http-header-fields", headerString)
        }
    }

    fun setPaused(paused: Boolean) {
        isPaused = paused
        if (isMpvInitialized) {
            MPVLib.setPropertyString("pause", if (paused) "yes" else "no")
            listeners.sendEvent(Player.EVENT_PLAY_WHEN_READY_CHANGED) { it.onPlayWhenReadyChanged(!paused, Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST) }
            listeners.sendEvent(Player.EVENT_IS_PLAYING_CHANGED) { it.onIsPlayingChanged(!paused) }
        }
    }

    fun seek(positionSec: Double) {
        if (isMpvInitialized) {
            isSeeking = true
            MPVLib.command(arrayOf("seek", positionSec.toString(), "absolute"))
            // Optimization: Assume seek happens instantly for UI purposes or wait for event
            mainHandler.postDelayed({ isSeeking = false }, 500)
        } else {
            pendingPosition = positionSec
        }
    }
    
    fun setAudioTrack(trackId: Int) {
        if (isMpvInitialized) {
            val value = if (trackId == -1) "no" else trackId.toString()
            Log.d(TAG, "Setting audio track (aid) to: $value")
            MPVLib.command(arrayOf("set", "aid", value))
        }
    }
    
    fun setSubtitleTrack(trackId: Int) {
        Log.d(TAG, "setSubtitleTrack called: trackId=$trackId, isMpvInitialized=$isMpvInitialized")
        if (isMpvInitialized) {
            if (trackId == -1) {
                Log.d(TAG, "Disabling subtitles (sid=no)")
                MPVLib.command(arrayOf("set", "sid", "no"))
                MPVLib.command(arrayOf("set", "sub-visibility", "no"))
            } else {
                Log.d(TAG, "Setting subtitle track (sid) to: $trackId")
                MPVLib.command(arrayOf("set", "sid", trackId.toString()))
                MPVLib.command(arrayOf("set", "sub-visibility", "yes"))
                
                // Debug: Verify
                mainHandler.postDelayed({
                    val currentSid = MPVLib.getPropertyString("sid")
                    val subVisibility = MPVLib.getPropertyString("sub-visibility")
                    Log.d(TAG, "Verification after set - sid=$currentSid, sub-visibility=$subVisibility")
                }, 100)
            }
        }
    }

    fun addExternalSubtitle(url: String, title: String? = null, language: String? = null) {
        // Prevent duplicate additions
        if (addedExternalSubUrls.contains(url)) {
            Log.d(TAG, "Subtitle already added, skipping: $url")
            return
        }
        addedExternalSubUrls.add(url)

        val titleStr = title ?: "External"
        val langStr = language ?: "eng"
        val command = arrayOf("sub-add", url, "select", titleStr, langStr)

        if (isFileLoaded) {
            Log.d(TAG, "Adding external subtitle immediately: $url")
            // Run in background thread to avoid blocking UI thread during network fetch
            Thread {
                try {
                    MPVLib.command(command)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to add external subtitle", e)
                }
            }.start()
        } else {
            Log.d(TAG, "Queueing external subtitle: $url")
            pendingCommands.add(command)
        }
    }
    
    fun setSubtitleVisibility(visible: Boolean) {
        if (isMpvInitialized) {
            MPVLib.setPropertyString("sub-visibility", if (visible) "yes" else "no")
        }
    }

    fun setSubtitleDelay(delaySec: Double) {
        if (isMpvInitialized) {
            Log.d(TAG, "Setting subtitle delay: $delaySec")
            MPVLib.setPropertyDouble("sub-delay", delaySec)
        }
    }
    
    fun setResizeMode(mode: String?) {
         when(mode) {
             "cover" -> {
                 if(isMpvInitialized) MPVLib.setPropertyDouble("panscan", 1.0)
             }
             else -> {
                 if(isMpvInitialized) MPVLib.setPropertyDouble("panscan", 0.0)
             }
         }
    }

    fun setMetadata(metadata: CrispyMediaMetadata?) {
        Log.d(TAG, "Setting metadata: ${metadata?.title}")
        this.currentMetadata = metadata
        notificationManager?.invalidate()
    }

    private fun setupNotification() {
        if (notificationManager != null) return

        val context = context.applicationContext
        
        // Create Notification Channel for Android O+
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val name = "Playback"
            val importance = android.app.NotificationManager.IMPORTANCE_LOW
            val channel = android.app.NotificationChannel(NOTIFICATION_CHANNEL_ID, name, importance)
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            manager.createNotificationChannel(channel)
        }

        val adapter = object : PlayerNotificationManager.MediaDescriptionAdapter {
            override fun getCurrentContentTitle(player: Player): CharSequence {
                return currentMetadata?.title ?: "Playing"
            }

            override fun createCurrentContentIntent(player: Player): android.app.PendingIntent? {
                return null
            }

            override fun getCurrentContentText(player: Player): CharSequence? {
                return currentMetadata?.subtitle
            }

            override fun getCurrentLargeIcon(player: Player, callback: PlayerNotificationManager.BitmapCallback): android.graphics.Bitmap? {
                val url = currentMetadata?.artworkUrl ?: return null
                
                // Use Coil to load the bitmap asynchronously
                val request = ImageRequest.Builder(context)
                    .data(url)
                    .target { drawable ->
                        val bitmap = (drawable as? android.graphics.drawable.BitmapDrawable)?.bitmap
                        if (bitmap != null) {
                            callback.onBitmap(bitmap)
                        }
                    }
                    .build()
                ImageLoader(context).enqueue(request)
                return null
            }
        }

        notificationManager = PlayerNotificationManager.Builder(context, NOTIFICATION_ID, NOTIFICATION_CHANNEL_ID)
            .setMediaDescriptionAdapter(adapter)
            .setNotificationListener(object : PlayerNotificationManager.NotificationListener {
                override fun onNotificationCancelled(notificationId: Int, dismissedByUser: Boolean) {
                    // Handle cancellation if needed
                }
                override fun onNotificationPosted(notificationId: Int, notification: android.app.Notification, ongoing: Boolean) {
                    // Handle post if needed
                }
            })
            .build().apply {
                setPlayer(this@CrispyVideoView)
                setUseNextAction(false)
                setUsePreviousAction(false)
                setUseStopAction(true)
                setPriority(android.app.Notification.PRIORITY_LOW)
                setVisibility(android.app.Notification.VISIBILITY_PUBLIC)
            }
    }

    // --- Player Implementation ---

    override fun getApplicationLooper(): Looper = Looper.getMainLooper()
    override fun addListener(listener: Player.Listener) = listeners.add(listener)
    override fun removeListener(listener: Player.Listener) = listeners.remove(listener)
    
    override fun setPlayWhenReady(playWhenReady: Boolean) = setPaused(!playWhenReady)
    override fun getPlayWhenReady(): Boolean = !isPaused
    
    override fun getPlaybackState(): Int = playbackState
    
    override fun isPlaying(): Boolean = isPlayerReady && !isPaused && playbackState == Player.STATE_READY
    
    override fun getDuration(): Long = (durationSec * 1000).toLong()
    override fun getCurrentPosition(): Long = (positionSec * 1000).toLong()
    override fun getBufferedPosition(): Long = getCurrentPosition() // MPV manages its own buffer
    override fun getTotalBufferedDuration(): Long = 0L
    
    override fun seekTo(positionMs: Long) = seek(positionMs / 1000.0)
    override fun seekTo(windowIndex: Int, positionMs: Long) = seekTo(positionMs)
    
    override fun getCurrentMediaItem(): MediaItem? = currentMediaItem
    override fun getMediaItemCount(): Int = if (currentMediaItem != null) 1 else 0
    override fun getMediaItemAt(index: Int): MediaItem = currentMediaItem ?: MediaItem.Builder().build()
    
    override fun getCurrentMediaItemIndex(): Int = 0
    
    override fun getPlaybackParameters(): PlaybackParameters = PlaybackParameters.DEFAULT
    override fun setPlaybackParameters(playbackParameters: PlaybackParameters) {}
    
    override fun stop() {
        setPaused(true)
        playbackState = Player.STATE_IDLE
        listeners.sendEvent(Player.EVENT_PLAYBACK_STATE_CHANGED) { it.onPlaybackStateChanged(playbackState) }
    }
    
    override fun release() = destroyMpv()
    
    // Stubs for other Player methods to satisfy the interface
    override fun getCurrentTracks(): Tracks = Tracks.EMPTY
    override fun getTrackSelectionParameters(): TrackSelectionParameters = TrackSelectionParameters.DEFAULT
    override fun setTrackSelectionParameters(parameters: TrackSelectionParameters) {}
    override fun getMediaMetadata(): MediaMetadata = MediaMetadata.EMPTY
    override fun getPlaylistMetadata(): MediaMetadata = MediaMetadata.EMPTY
    override fun setPlaylistMetadata(mediaMetadata: MediaMetadata) {}
    override fun getContentDuration(): Long = getDuration()
    override fun getContentPosition(): Long = getCurrentPosition()
    override fun getContentBufferedPosition(): Long = getBufferedPosition()
    override fun isPlayingAd(): Boolean = false
    override fun getCurrentAdGroupIndex(): Int = -1
    override fun getCurrentAdIndexInAdGroup(): Int = -1
    override fun hasNextMediaItem(): Boolean = false
    override fun hasPreviousMediaItem(): Boolean = false
    override fun seekToNextMediaItem() {}
    override fun seekToPreviousMediaItem() {}
    override fun setRepeatMode(repeatMode: Int) {}
    override fun getRepeatMode(): Int = Player.REPEAT_MODE_OFF
    override fun setShuffleModeEnabled(shuffleModeEnabled: Boolean) {}
    override fun getShuffleModeEnabled(): Boolean = false
    override fun getPlayerError(): PlaybackException? = null
    override fun getVideoSize(): VideoSize = VideoSize.UNKNOWN
    override fun getCurrentCues(): CueGroup = CueGroup.EMPTY_TIME_ZERO
    override fun getDeviceInfo(): DeviceInfo = DeviceInfo.UNKNOWN
    override fun getDeviceVolume(): Int = 0
    override fun isDeviceMuted(): Boolean = false
    override fun setDeviceVolume(volume: Int) {}
    override fun setDeviceVolume(volume: Int, flags: Int) {}
    override fun increaseDeviceVolume() {}
    override fun increaseDeviceVolume(flags: Int) {}
    override fun decreaseDeviceVolume() {}
    override fun decreaseDeviceVolume(flags: Int) {}
    override fun setDeviceMuted(muted: Boolean) {}
    override fun setDeviceMuted(muted: Boolean, flags: Int) {}
    override fun getAudioAttributes(): AudioAttributes = AudioAttributes.DEFAULT
    override fun setVolume(volume: Float) {}
    override fun getVolume(): Float = 1.0f
    override fun getCurrentTimeline(): Timeline = Timeline.EMPTY
    override fun getCurrentPeriodIndex(): Int = 0
    override fun isCommandAvailable(command: Int): Boolean = true
    override fun getAvailableCommands(): Player.Commands = Player.Commands.EMPTY

    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
}
