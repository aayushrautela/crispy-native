package aayush.crispy.core

import android.app.*
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.frostwire.jlibtorrent.*
import com.frostwire.jlibtorrent.alerts.*
import java.io.File
import java.util.concurrent.ConcurrentHashMap

/**
 * Foreground service managing torrent downloads using jlibtorrent.
 * Optimized for sequential video streaming.
 */
class TorrentService : Service() {
    
    companion object {
        private const val TAG = "TorrentService"
        private const val NOTIFICATION_CHANNEL_ID = "crispy_torrent_channel"
        private const val NOTIFICATION_ID = 1001
        
        private val PUBLIC_TRACKERS = listOf(
            "udp://tracker.opentrackr.org:1337/announce",
            "udp://open.demonii.com:1337/announce",
            "udp://tracker.torrent.eu.org:451/announce",
            "udp://explodie.org:6969/announce",
            "udp://open.stealth.si:80/announce",
            "http://tracker.opentrackr.org:1337/announce",
            "http://open.tracker.cl:1337/announce",
            "https://tracker.bt4g.com:443/announce"
        )
        
        // Piece prioritization constants
        private const val PIECES_TO_BUFFER = 20
        private const val INSTANT_TIER_PIECES = 3
        private const val DEADLINE_INCREMENT_MS = 100
        
        private const val IDLE_TIMEOUT_MS = 10 * 60 * 1000L
    }
    
    private val binder = TorrentBinder()
    private var sessionManager: SessionManager? = null
    private val activeTorrents = ConcurrentHashMap<String, Boolean>()
    
    // Track pieces with active deadlines for efficient clearing on seek
    private val priorityWindows = ConcurrentHashMap<String, MutableSet<Int>>()
    
    @Volatile
    private var isSessionActive = false
    
    inner class TorrentBinder : Binder() {
        fun getService(): TorrentService = this@TorrentService
    }
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        initSession()
    }
    
    override fun onBind(intent: Intent?): IBinder = binder
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        updateServiceState()
        return START_NOT_STICKY
    }
    
    override fun onDestroy() {
        super.onDestroy()
        mainHandler.removeCallbacksAndMessages(null)
        stopForeground(STOP_FOREGROUND_REMOVE)
        Thread { stopSession() }.start()
    }

    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val idleRunnable = Runnable { stopSelf() }
    
    private fun updateServiceState() {
        mainHandler.post {
            val activeCount = activeTorrents.size
            val notifText = if (activeCount > 0) "Streaming $activeCount torrents..." else "Torrent engine ready"
            val notification = createNotification(notifText)
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            
            mainHandler.removeCallbacks(idleRunnable)
            if (activeCount == 0) {
                mainHandler.postDelayed(idleRunnable, IDLE_TIMEOUT_MS)
            }
        }
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Crispy Streaming",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
    
    private fun createNotification(text: String): Notification {
        // Try to find the launcher activity of the main app
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = launchIntent?.let {
            PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }
        
        // Use a generic icon from android.R since we are in a library
        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("Crispy Native Core")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }
    
    private fun initSession() {
        if (isSessionActive) return
        
        val settings = SettingsPack().apply {
            connectionsLimit(200)
            activeDownloads(1)
            activeSeeds(0)
            downloadRateLimit(0)
            uploadRateLimit(500 * 1024)
        }
        
        sessionManager = SessionManager().apply {
            start(SessionParams(settings))
            addListener(object : AlertListener {
                override fun types(): IntArray? = null
                override fun alert(alert: Alert<*>) {
                    when (alert.type()) {
                        AlertType.ADD_TORRENT -> {
                            val handle = (alert as AddTorrentAlert).handle()
                            val infoHash = handle.infoHash().toHex()
                            Log.d(TAG, "[ALERT] ADD_TORRENT: $infoHash")
                            activeTorrents[infoHash] = true
                            try { handle.setFlags(handle.flags().or_(TorrentFlags.SEQUENTIAL_DOWNLOAD)) } catch (e: Exception) {}
                            updateServiceState()
                        }
                        AlertType.METADATA_RECEIVED -> {
                            val handle = (alert as MetadataReceivedAlert).handle()
                            Log.d(TAG, "[ALERT] METADATA_RECEIVED: ${handle.infoHash().toHex()} (${handle.torrentFile()?.name()})")
                        }
                        AlertType.METADATA_FAILED -> {
                            val handle = (alert as MetadataFailedAlert).handle()
                            Log.w(TAG, "[ALERT] METADATA_FAILED: ${handle.infoHash().toHex()}")
                        }
                        AlertType.TORRENT_ERROR -> {
                            val handle = (alert as TorrentErrorAlert).handle()
                            Log.e(TAG, "[ALERT] TORRENT_ERROR: ${handle.infoHash().toHex()} -> ${alert.errorMessage()}")
                        }
                        AlertType.TORRENT_FINISHED -> {
                            val infoHash = (alert as TorrentFinishedAlert).handle().infoHash().toHex()
                            Log.d(TAG, "[ALERT] TORRENT_FINISHED: $infoHash")
                        }
                        AlertType.TRACKER_REPLY -> {
                            val alertTracker = alert as TrackerReplyAlert
                            Log.d(TAG, "[ALERT] TRACKER_REPLY: ${alertTracker.handle().infoHash().toHex()} -> ${alertTracker.trackerUrl()} (${alertTracker.numPeers} peers)")
                        }
                        AlertType.TRACKER_ERROR -> {
                            val alertTracker = alert as TrackerErrorAlert
                            Log.w(TAG, "[ALERT] TRACKER_ERROR: ${alertTracker.handle().infoHash().toHex()} -> ${alertTracker.trackerUrl()} (${alertTracker.errorMessage()})")
                        }
                        AlertType.PEER_CONNECT -> {
                            val alertPeer = alert as PeerConnectAlert
                            Log.d(TAG, "[ALERT] PEER_CONNECT: ${alertPeer.handle().infoHash().toHex()} -> ${alertPeer.ip()}")
                        }
                        AlertType.PEER_DISCONNECTED -> {
                            val alertPeer = alert as PeerDisconnectedAlert
                            Log.d(TAG, "[ALERT] PEER_DISCONNECT: ${alertPeer.handle().infoHash().toHex()} -> ${alertPeer.errorMessage()}")
                        }
                        else -> {
                            // Optionally log type for untracked alerts
                            // Log.v(TAG, "[ALERT] Other: ${alert.type()} - ${alert.message()}")
                        }
                    }
                }
            })
        }
        isSessionActive = true
    }
    
    private fun stopSession() {
        isSessionActive = false
        priorityWindows.clear()
        val sm = sessionManager ?: return
        activeTorrents.keys.forEach { hash ->
            try { sm.find(Sha1Hash(hash))?.let { sm.remove(it) } } catch (e: Exception) {}
        }
        sm.stop()
        sessionManager = null
    }

    private fun getHandle(infoHash: String): TorrentHandle? {
        if (!isSessionActive) return null
        return try { sessionManager?.find(Sha1Hash(infoHash))?.takeIf { it.isValid } } catch (e: Throwable) { null }
    }

    fun startInfoHash(infoHash: String): Boolean {
        val session = sessionManager ?: return false
        try {
            val downloadDir = getDownloadDir()
            val trackerParams = PUBLIC_TRACKERS.joinToString("") { "&tr=${java.net.URLEncoder.encode(it, "UTF-8")}" }
            val magnetUri = "magnet:?xt=urn:btih:$infoHash$trackerParams"
            
            val params = AddTorrentParams.parseMagnetUri(magnetUri)
            params.savePath(downloadDir.absolutePath)
            session.swig().async_add_torrent(params.swig())
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Error starting magnet", e)
            return false
        }
    }

    fun stopTorrent(infoHash: String) {
        val hash = infoHash.lowercase()
        activeTorrents.remove(hash)
        
        // Clear priority window for this torrent
        priorityWindows.keys.filter { it.startsWith("$hash:") }.forEach { priorityWindows.remove(it) }
        
        updateServiceState()
        getHandle(hash)?.let { sessionManager?.remove(it) }
    }

    fun deleteTorrentData(infoHash: String) {
        val hash = infoHash.lowercase()
        val handle = getHandle(hash)
        var torrentName: String? = null
        if (handle != null && handle.status().hasMetadata()) {
            torrentName = handle.torrentFile()?.name()
        }
        stopTorrent(hash)
        Thread {
            try {
                if (!torrentName.isNullOrEmpty()) {
                    File(getDownloadDir(), torrentName).deleteRecursively()
                }
            } catch (e: Exception) {}
        }.start()
    }
    
    /**
     * Delete all files in the download directory on startup.
     */
    fun performStartupCleanup() {
        Thread {
            try {
                val dir = getDownloadDir()
                if (dir.exists()) {
                    dir.deleteRecursively()
                    dir.mkdirs()
                    Log.d(TAG, "Startup Cleanup: Wiped data at ${dir.absolutePath}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Startup Cleanup Failed", e)
            }
        }.start()
    }

    fun getDownloadDir(): File = getExternalFilesDir(null) ?: filesDir

    fun getStreamUrl(infoHash: String, fileIdx: Int): String? {
        val handle = getHandle(infoHash) ?: return null
        val torrentInfo = handle.torrentFile() ?: return null
        if (fileIdx >= torrentInfo.numFiles()) return null
        return "http://localhost:11470/$infoHash/$fileIdx"
    }

    fun getLargestFileIndex(infoHash: String): Int {
        val handle = getHandle(infoHash) ?: return 0
        if (!handle.isValid || !handle.status().hasMetadata()) return 0
        val torrentInfo = handle.torrentFile() ?: return 0
        var largestIdx = 0
        var largestSize = 0L
        for (i in 0 until torrentInfo.numFiles()) {
            val size = torrentInfo.files().fileSize(i)
            if (size > largestSize) { largestSize = size; largestIdx = i }
        }
        return largestIdx
    }

    fun getTorrentStats(infoHash: String): CrispyServer.TorrentStats? {
        val handle = getHandle(infoHash) ?: return null
        if (!handle.isValid) return null
        val status = handle.status()
        return CrispyServer.TorrentStats(
            infoHash = infoHash,
            name = if (status.hasMetadata()) handle.torrentFile()?.name() ?: "Unknown" else "Fetching meta...",
            peers = status.numPeers(),
            seeds = status.numSeeds(),
            downloadSpeed = status.downloadRate().toLong(),
            uploadSpeed = status.uploadRate().toLong(),
            progress = status.progress(),
            state = status.state().name
        )
    }

    fun getFileStats(infoHash: String, fileIdx: Int): CrispyServer.FileStats? {
        val handle = getHandle(infoHash) ?: return null
        if (!handle.isValid || !handle.status().hasMetadata()) return null
        val torrentInfo = handle.torrentFile() ?: return null
        val files = torrentInfo.files()
        val offset = files.fileOffset(fileIdx)
        val size = files.fileSize(fileIdx)
        val startPiece = (offset / torrentInfo.pieceLength()).toInt()
        val endPiece = ((offset + size - 1) / torrentInfo.pieceLength()).toInt()
        var downloaded = 0
        for (i in startPiece..endPiece) if (handle.havePiece(i)) downloaded++
        val progress = if (endPiece >= startPiece) downloaded.toFloat() / (endPiece - startPiece + 1) else 0f
        return CrispyServer.FileStats(progress, size, files.fileName(fileIdx), (progress * size).toLong(), torrentInfo.pieceLength())
    }

    fun getFilePath(infoHash: String, fileIdx: Int): String? {
        val handle = getHandle(infoHash) ?: return null
        if (!handle.isValid || !handle.status().hasMetadata()) return null
        return handle.torrentFile()?.files()?.filePath(fileIdx)
    }

    fun isHeaderReady(infoHash: String, fileIdx: Int): Boolean {
        val handle = getHandle(infoHash) ?: return false
        if (!handle.isValid || !handle.status().hasMetadata()) return false
        val torrentInfo = handle.torrentFile() ?: return false
        val startPiece = (torrentInfo.files().fileOffset(fileIdx) / torrentInfo.pieceLength()).toInt()
        for (i in 0 until 3) if (!handle.havePiece(startPiece + i)) return false
        return true
    }

    fun prioritizeHeader(infoHash: String, fileIdx: Int) {
        val handle = getHandle(infoHash) ?: return
        if (!handle.isValid || !handle.status().hasMetadata()) return
        val torrentInfo = handle.torrentFile() ?: return
        
        val startPiece = (torrentInfo.files().fileOffset(fileIdx) / torrentInfo.pieceLength()).toInt()
        
        // Tiered priority for header
        for (i in 0 until 5) {
            val deadline = if (i < INSTANT_TIER_PIECES) 0 else (i - INSTANT_TIER_PIECES + 1) * DEADLINE_INCREMENT_MS
            handle.setPieceDeadline(startPiece + i, deadline)
        }
    }

    fun startStreaming(infoHash: String, fileIdx: Int) {
        val handle = getHandle(infoHash) ?: return
        if (!handle.isValid || !handle.status().hasMetadata()) return
        handle.setFlags(handle.flags().or_(TorrentFlags.SEQUENTIAL_DOWNLOAD))
        prioritizeHeader(infoHash, fileIdx)
    }

    fun handleSeek(infoHash: String, fileIdx: Int, position: Long) {
        val handle = getHandle(infoHash) ?: return
        if (!handle.isValid || !handle.status().hasMetadata()) return
        val torrentInfo = handle.torrentFile() ?: return
        
        val pieceLen = torrentInfo.pieceLength()
        val fileOffset = torrentInfo.files().fileOffset(fileIdx)
        val fileSize = torrentInfo.files().fileSize(fileIdx)
        
        val seekPiece = ((fileOffset + position) / pieceLen).toInt()
        val endPiece = ((fileOffset + fileSize - 1) / pieceLen).toInt()
        
        val windowKey = "$infoHash:$fileIdx"
        val window = priorityWindows.getOrPut(windowKey) { ConcurrentHashMap.newKeySet() }
        
        // 1. Clear old deadlines
        val it = window.iterator()
        while (it.hasNext()) {
            val p = it.next()
            try { handle.resetPieceDeadline(p) } catch (_: Exception) {}
            it.remove()
        }
        
        // 2. Set new tiered deadlines
        val toBuffer = minOf(PIECES_TO_BUFFER, endPiece - seekPiece + 1)
        for (i in 0 until toBuffer) {
            val p = seekPiece + i
            val deadline = if (i < INSTANT_TIER_PIECES) 0 else (i - INSTANT_TIER_PIECES + 1) * DEADLINE_INCREMENT_MS
            handle.setPieceDeadline(p, deadline)
            window.add(p)
        }
        
        Log.d(TAG, "handleSeek: Prioritized pieces $seekPiece to ${seekPiece + toBuffer - 1}")
    }
}
