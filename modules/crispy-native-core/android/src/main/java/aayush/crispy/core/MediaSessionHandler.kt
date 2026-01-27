package aayush.crispy.core

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.os.Build
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import coil.ImageLoader
import coil.request.ImageRequest

/**
 * Manages MediaSession and Media Notification.
 */
class MediaSessionHandler(
    private val context: Context,
    private val callbacks: MediaSessionCallbacks
) {

    interface MediaSessionCallbacks {
        fun onPlay()
        fun onPause()
        fun onStop()
        fun onSeekTo(pos: Long)
    }

    private val mediaSession: MediaSessionCompat
    private val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    
    // Metadata cache
    private var currentTitle = "Crispy Player"
    private var currentArtist = ""
    private var currentArtwork: Bitmap? = null
    private var currentDuration = 0L
    private var currentPosition = 0L
    private var isPlaying = false

    companion object {
        const val CHANNEL_ID = "media_channel"
        private const val NOTIFICATION_ID = 1002
        private const val TAG = "MediaSessionHandler"
    }

    init {
        createNotificationChannel()

        mediaSession = MediaSessionCompat(context, "CrispyMediaSession").apply {
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() { callbacks.onPlay() }
                override fun onPause() { callbacks.onPause() }
                override fun onStop() { callbacks.onStop() }
                override fun onSeekTo(pos: Long) {
                    val seconds = pos / 1000.0
                    callbacks.onSeekTo(pos) // Pass ms to callback if needed, or convert to sec in View
                    
                    // Optimistic update
                    currentPosition = pos
                    updatePlaybackState(isPlaying)
                }
            })
            
            setPlaybackState(
                PlaybackStateCompat.Builder()
                    .setActions(
                        PlaybackStateCompat.ACTION_PLAY or 
                        PlaybackStateCompat.ACTION_PAUSE or 
                        PlaybackStateCompat.ACTION_PLAY_PAUSE or
                        PlaybackStateCompat.ACTION_SEEK_TO or
                        PlaybackStateCompat.ACTION_STOP
                    )
                    .setState(PlaybackStateCompat.STATE_PAUSED, 0, 1f)
                    .build()
            )
            isActive = true
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Media Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Media playback controls"
                setShowBadge(false)
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun updateMetadata(title: String, artist: String, artworkUrl: String?) {
        android.util.Log.d(TAG, "updateMetadata called with: title='$title', artist='$artist', artworkUrl='$artworkUrl'")
        currentTitle = title
        currentArtist = artist

        if (!artworkUrl.isNullOrEmpty()) {
            android.util.Log.d(TAG, "Starting image load for: $artworkUrl")
            val loader = ImageLoader(context)
            val request = ImageRequest.Builder(context)
                .data(artworkUrl)
                .allowHardware(false) 
                .target(
                    onSuccess = { result ->
                        android.util.Log.d(TAG, "Image load successful")
                        if (result is BitmapDrawable) {
                            currentArtwork = result.bitmap
                        } else {
                            android.util.Log.w(TAG, "Image is not a BitmapDrawable, cannot use as largeIcon")
                             // detailed handling or conversion could be added here
                             // For now, simple fallback
                             currentArtwork = null
                        }
                        updateNotification()
                        updateMediaSessionMetadata()
                    },
                    onError = {
                        android.util.Log.e(TAG, "Image load failed")
                        currentArtwork = null
                        updateNotification()
                        updateMediaSessionMetadata()
                    }
                )
                .build()
            loader.enqueue(request)
        } else {
            android.util.Log.d(TAG, "No artwork URL, clearing artwork")
            currentArtwork = null
            updateNotification()
            updateMediaSessionMetadata()
        }
    }

    fun updateDuration(durationSeconds: Double) {
        val newDuration = (durationSeconds * 1000).toLong()
        if (newDuration != currentDuration) {
            currentDuration = newDuration
            updateMediaSessionMetadata()
        }
    }

    fun updatePosition(positionSeconds: Double) {
        val newPos = (positionSeconds * 1000).toLong()
        if (Math.abs(newPos - currentPosition) > 2000 || !isPlaying) {
            currentPosition = newPos
            // Only update state if playing to keep Seekbar in sync or if paused to correct position
            updatePlaybackState(isPlaying)
        } else {
            currentPosition = newPos
        }
    }

    fun updatePlaybackState(playing: Boolean) {
        isPlaying = playing
        
        val state = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        
        mediaSession.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setActions(
                    PlaybackStateCompat.ACTION_PLAY or 
                    PlaybackStateCompat.ACTION_PAUSE or 
                    PlaybackStateCompat.ACTION_PLAY_PAUSE or 
                    PlaybackStateCompat.ACTION_SEEK_TO or
                    PlaybackStateCompat.ACTION_STOP
                )
                .setState(state, currentPosition, 1f)
                .build()
        )
        
        updateNotification()
    }

    private fun updateMediaSessionMetadata() {
        val builder = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, currentDuration)
        
        if (currentArtwork != null) {
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentArtwork)
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, currentArtwork)
        }
        
        mediaSession.setMetadata(builder.build())
    }

    private fun updateNotification() {
        android.util.Log.d(TAG, "updateNotification called. Title: $currentTitle, Artist: $currentArtist, Playing: $isPlaying, HasArtwork: ${currentArtwork != null}")
        // We don't need the controller to check for updates, we have our local state values
        
        // Use a generic intent if MainActivity class name is unknown at compile time,
        // or assume the standard package structure.
        // Ideally we should inject the class or use getLaunchIntentForPackage
        val pm = context.packageManager
        val launchIntent = pm.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

        val pendingIntent = if (launchIntent != null) {
            PendingIntent.getActivity(
                context, 0, launchIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
        } else null

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSubText("Crispy")
            .setLargeIcon(currentArtwork)
            .setContentIntent(pendingIntent)
            .setDeleteIntent(
                androidx.media.session.MediaButtonReceiver.buildMediaButtonPendingIntent(
                    context,
                    PlaybackStateCompat.ACTION_STOP
                )
            )
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSmallIcon(android.R.drawable.ic_media_play) // Fallback icon
            .setStyle(
                 androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(mediaSession.sessionToken)
                    .setShowActionsInCompactView(0) 
                    .setShowCancelButton(true)
                    .setCancelButtonIntent(
                        androidx.media.session.MediaButtonReceiver.buildMediaButtonPendingIntent(
                            context,
                            PlaybackStateCompat.ACTION_STOP
                        )
                    )
            )
            
        if (isPlaying) {
             builder.addAction(
                 android.R.drawable.ic_media_pause, "Pause",
                 androidx.media.session.MediaButtonReceiver.buildMediaButtonPendingIntent(context, PlaybackStateCompat.ACTION_PAUSE)
             )
        } else {
             builder.addAction(
                 android.R.drawable.ic_media_play, "Play",
                 androidx.media.session.MediaButtonReceiver.buildMediaButtonPendingIntent(context, PlaybackStateCompat.ACTION_PLAY)
             )
        }
        
        notificationManager.notify(NOTIFICATION_ID, builder.build())
    }
    
    fun release() {
        mediaSession.isActive = false
        mediaSession.release()
        notificationManager.cancel(NOTIFICATION_ID)
    }
}
