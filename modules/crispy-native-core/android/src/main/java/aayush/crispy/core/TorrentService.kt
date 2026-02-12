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
import com.frostwire.jlibtorrent.swig.settings_pack
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.random.Random

/**
 * Foreground service managing torrent downloads using jlibtorrent.
 * Optimized for sequential video streaming.
 */
class TorrentService : Service() {
    
    companion object {
        private const val TAG = "TorrentService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "torrent_service_channel"
        private const val IDLE_TIMEOUT_MS = 3 * 60 * 1000L // 3 minutes to avoid churn between short player transitions
        
        private val PUBLIC_TRACKERS = listOf(
            "udp://tracker.opentrackr.org:1337/announce",
            "udp://open.stealth.si:80/announce",
            "udp://tracker.torrent.eu.org:451/announce",
            "udp://tracker.bittorrent.am:80/announce",
            "udp://tracker.openbittorrent.com:6969/announce",
            "udp://exodus.desync.com:6969/announce",
            "udp://tracker.tiny-vps.com:6969/announce",
            "udp://retracker.lanta-net.ru:2710/announce"
        )
        private const val INSTANT_TIER_PIECES = 3
        private const val DEADLINE_INCREMENT_MS = 1000
        private const val PIECES_TO_BUFFER = 30
        private const val LISTEN_PORT_MIN = 37000
        private const val LISTEN_PORT_MAX = 57000
        private const val LISTEN_BIND_RETRIES = 8
    }
    
    private val binder = TorrentBinder()
    private var sessionManager: SessionManager? = null
    private val activeTorrents = ConcurrentHashMap<String, Boolean>()
    private var server: CrispyServer? = null
    
    // Track pieces with active deadlines for efficient clearing on seek
    private val priorityWindows = ConcurrentHashMap<String, MutableSet<Int>>()
    
    // Track pending metadata requests for blockers (if needed)
    private val metadataLatches = ConcurrentHashMap<String, CountDownLatch>()
    
    @Volatile
    private var isSessionActive = false

    @Volatile
    private var activeSessionId: String? = null

    @Volatile
    private var configuredListenPort: Int? = null
    
    inner class TorrentBinder : Binder() {
        fun getService(): TorrentService = this@TorrentService
    }
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startServer()
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
        // Tear down engine resources.
        Thread { 
            stopServer()
            stopAll() 
            stopSession() 
        }.start()
    }

    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val idleRunnable = Runnable {
        if (activeTorrents.isEmpty()) {
            Log.d(TAG, "Idle timeout reached (${IDLE_TIMEOUT_MS}ms), stopping TorrentService")
            stopSelf()
        }
    }
    
    private fun updateServiceState() {
        mainHandler.post {
            val activeCount = activeTorrents.size
            val notifText = if (activeCount > 0) "Streaming $activeCount torrents..." else "Torrent engine ready"
            val notification = createNotification(notifText)
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val serviceType = if (activeCount > 0) {
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC or
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                } else {
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                }
                startForeground(NOTIFICATION_ID, notification, serviceType)
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
                CHANNEL_ID,
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
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Crispy Native Core")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    private fun startServer() {
        if (server != null && server?.isAlive == true) return
        
        try {
            val downloadDir = getDownloadDir()
            server = CrispyServer(11470, downloadDir, this)
            if (server?.safeStart() == true) {
                Log.d(TAG, "CrispyServer started on port 11470")
            } else {
                Log.e(TAG, "Failed to start CrispyServer on port 11470")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting CrispyServer", e)
        }
    }

    private fun stopServer() {
        try {
            server?.stop()
            server = null
            Log.d(TAG, "CrispyServer stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping CrispyServer", e)
        }
    }
    
    private fun pickListenPort(excluded: Set<Int>): Int {
        var candidate = LISTEN_PORT_MIN
        do {
            candidate = Random.nextInt(LISTEN_PORT_MIN, LISTEN_PORT_MAX + 1)
        } while (candidate in excluded)
        return candidate
    }

    private fun createSessionSettings(listenPort: Int): SettingsPack {
        return SettingsPack().apply {
            connectionsLimit(200)
            maxPeerlistSize(500)
            activeDownloads(1)
            activeSeeds(0)
            activeLimit(3)
            downloadRateLimit(0)
            uploadRateLimit(500 * 1024)

            listenInterfaces("0.0.0.0:$listenPort,[::]:$listenPort")

            setBoolean(settings_pack.bool_types.enable_dht.swigValue(), true)
            setBoolean(settings_pack.bool_types.enable_lsd.swigValue(), false)
            setBoolean(settings_pack.bool_types.enable_outgoing_tcp.swigValue(), true)
            setBoolean(settings_pack.bool_types.enable_outgoing_utp.swigValue(), true)
            setBoolean(settings_pack.bool_types.enable_incoming_tcp.swigValue(), true)
            setBoolean(settings_pack.bool_types.enable_incoming_utp.swigValue(), true)
            setBoolean(settings_pack.bool_types.enable_upnp.swigValue(), true)
            setBoolean(settings_pack.bool_types.enable_natpmp.swigValue(), true)

            setDhtBootstrapNodes("router.bittorrent.com:6881,router.utorrent.com:6881,dht.transmissionbt.com:6881,router.opentrackr.org:1337")
            setString(settings_pack.string_types.user_agent.swigValue(), "qBittorrent/4.6.3")
            alertQueueSize(2000)
        }
    }

    private fun attachAlertListener(manager: SessionManager) {
        manager.addListener(object : AlertListener {
            override fun types(): IntArray? = null

            override fun alert(alert: Alert<*>) {
                when (alert.type()) {
                    AlertType.ADD_TORRENT -> {
                        val handle = (alert as AddTorrentAlert).handle()
                        val infoHash = handle.infoHash().toHex()
                        Log.d(TAG, "[ALERT] ADD_TORRENT: $infoHash")
                        activeTorrents[infoHash] = true
                        try {
                            handle.setFlags(handle.flags().or_(TorrentFlags.SEQUENTIAL_DOWNLOAD))
                        } catch (_: Exception) {
                        }
                        updateServiceState()
                    }

                    AlertType.METADATA_RECEIVED -> {
                        val handle = (alert as MetadataReceivedAlert).handle()
                        val hash = handle.infoHash().toHex()
                        Log.d(TAG, "[ALERT] METADATA_RECEIVED: $hash (${handle.torrentFile()?.name()})")
                        metadataLatches[hash]?.countDown()
                    }

                    AlertType.METADATA_FAILED -> {
                        val handle = (alert as MetadataFailedAlert).handle()
                        Log.w(TAG, "[ALERT] METADATA_FAILED: ${handle.infoHash().toHex()}")
                    }

                    AlertType.TORRENT_ERROR -> {
                        val alertError = alert as TorrentErrorAlert
                        Log.e(TAG, "[ALERT] TORRENT_ERROR: ${alertError.handle().infoHash().toHex()} -> ${alertError.message()}")
                    }

                    AlertType.TORRENT_FINISHED -> {
                        val infoHash = (alert as TorrentFinishedAlert).handle().infoHash().toHex()
                        Log.d(TAG, "[ALERT] TORRENT_FINISHED: $infoHash")
                    }

                    AlertType.TRACKER_REPLY -> {
                        val alertTracker = alert as TrackerReplyAlert
                        Log.d(TAG, "[ALERT] TRACKER_REPLY: ${alertTracker.handle().infoHash().toHex()} -> ${alertTracker.trackerUrl()} (${alertTracker.numPeers()} peers)")
                    }

                    AlertType.TRACKER_ERROR -> {
                        val alertTracker = alert as TrackerErrorAlert
                        val reason = alertTracker.errorMessage().ifBlank { "unknown" }
                        Log.w(
                            TAG,
                            "[ALERT] TRACKER_ERROR: ${alertTracker.handle().infoHash().toHex()} -> ${alertTracker.trackerUrl()} (reason=$reason, detail=${alertTracker.message()})"
                        )
                    }

                    AlertType.PEER_CONNECT -> {
                        val alertPeer = alert as PeerConnectAlert
                        Log.d(TAG, "[ALERT] PEER_CONNECT: ${alertPeer.handle().infoHash().toHex()} -> ${alertPeer.endpoint()}")
                    }

                    AlertType.PEER_DISCONNECTED -> {
                        val alertPeer = alert as PeerDisconnectedAlert
                        Log.d(TAG, "[ALERT] PEER_DISCONNECT: ${alertPeer.handle().infoHash().toHex()} -> ${alertPeer.message()}")
                    }

                    else -> {
                    }

                }
            }
        })
    }

    private fun initSession() {
        if (isSessionActive) return

        val attemptedPorts = mutableSetOf<Int>()
        var lastError: Exception? = null

        repeat(LISTEN_BIND_RETRIES) { attemptIndex ->
            val attempt = attemptIndex + 1
            val listenPort = pickListenPort(attemptedPorts)
            attemptedPorts.add(listenPort)

            val manager = SessionManager()
            try {
                manager.start(SessionParams(createSessionSettings(listenPort)))
                attachAlertListener(manager)

                sessionManager = manager
                configuredListenPort = listenPort
                isSessionActive = true

                Log.i(
                    TAG,
                    "[ALERT] LISTEN_SUCCEEDED: port=$listenPort attempt=$attempt/$LISTEN_BIND_RETRIES"
                )
                return
            } catch (e: Exception) {
                lastError = e
                Log.w(
                    TAG,
                    "[ALERT] LISTEN_FAILED: port=$listenPort attempt=$attempt/$LISTEN_BIND_RETRIES reason=${e.message}"
                )
                try {
                    manager.stop()
                } catch (_: Exception) {
                }
            }
        }

        configuredListenPort = null
        Log.e(
            TAG,
            "Failed to initialize torrent session after $LISTEN_BIND_RETRIES attempts",
            lastError
        )
    }
    
    private fun stopSession() {
        isSessionActive = false
        configuredListenPort = null
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

    fun startInfoHash(infoHash: String, sessionId: String? = null): Boolean {
        val hash = infoHash.lowercase()
        Log.d(TAG, "startInfoHash: $hash (session: $sessionId)")

        // Idempotent start: if this torrent is already active or being initialized,
        // do not reset the session.
        if (activeTorrents.containsKey(hash)) {
            updateServiceState()
            return true
        }

        // Single-stream policy, but avoid hard-reset churn for repeated same-hash starts.
        if (activeTorrents.isNotEmpty()) {
            stopAll()
        }
        
        if (sessionId != null) {
            this.activeSessionId = sessionId
        }
        
        // Ensure session is initialized
        if (sessionManager == null) {
            initSession()
        }
        
        val session = sessionManager ?: return false
        
        try {
            val downloadDir = getDownloadDir()
            downloadDir.mkdirs()

            val trackerParams = PUBLIC_TRACKERS.joinToString("") { "&tr=${java.net.URLEncoder.encode(it, "UTF-8")}" }
            val magnetUri = "magnet:?xt=urn:btih:$hash$trackerParams"
            
            // Create latch BEFORE adding torrent so it's ready for the alert
            metadataLatches.putIfAbsent(hash, CountDownLatch(1))
            
            // Track immediately to allow optimistic URL generation
            activeTorrents[hash] = true
            
            val params = AddTorrentParams.parseMagnetUri(magnetUri)
            params.savePath(downloadDir.absolutePath)
            session.swig().async_add_torrent(params.swig())
            
            updateServiceState()
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Error starting magnet", e)
            activeTorrents.remove(hash)
            metadataLatches.remove(hash)
            return false
        }
    }
    
    /**
     * Blocks until metadata is received for the given torrent.
     * @param infoHash The torrent info hash
     * @param timeoutMs Maximum time to wait in milliseconds (default 60s)
     * @return true if metadata was received, false if timed out or error
     */
    fun awaitMetadata(infoHash: String, timeoutMs: Long = 60_000L): Boolean {
        val hash = infoHash.lowercase()
        
        // Check if metadata already available
        val handle = getHandle(hash)
        if (handle != null && handle.status().hasMetadata()) {
            Log.d(TAG, "Metadata already available for $hash")
            metadataLatches.remove(hash)
            return true
        }
        
        val latch = metadataLatches[hash]
        if (latch == null) {
            Log.w(TAG, "No latch for $hash - torrent may not have been started")
            return false
        }
        
        return try {
            Log.d(TAG, "Awaiting metadata for $hash (timeout: ${timeoutMs}ms)")
            val received = latch.await(timeoutMs, TimeUnit.MILLISECONDS)
            if (received) {
                Log.d(TAG, "Metadata received for $hash")
            } else {
                Log.w(TAG, "Metadata timeout for $hash after ${timeoutMs}ms")
            }
            metadataLatches.remove(hash)
            received
        } catch (e: InterruptedException) {
            Log.e(TAG, "Interrupted while awaiting metadata for $hash", e)
            metadataLatches.remove(hash)
            false
        }
    }

    fun stopTorrent(infoHash: String) {
        val hash = infoHash.lowercase()
        activeTorrents.remove(hash)
        
        // Clear priority window for this torrent
        priorityWindows.keys.filter { it.startsWith("$hash:") }.forEach { priorityWindows.remove(it) }
        
        // Clean up any pending metadata latch
        metadataLatches.remove(hash)?.countDown()
        
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
     * Stop all active torrents for the current session.
     * @param onlyForSessionId If provided, only stops if the current active session matches this ID.
     */
    fun stopAll(onlyForSessionId: String? = null) {
        if (onlyForSessionId != null && activeSessionId != null && onlyForSessionId != activeSessionId) {
            Log.d(TAG, "stopAll ignored: Session mismatch (Active: $activeSessionId, Request: $onlyForSessionId)")
            return
        }
        
        Log.d(TAG, "Stopping all torrents...")
        
        // Remove all torrents from session first
        val sm = sessionManager
        if (sm != null) {
            activeTorrents.keys.forEach { hash ->
                try {
                    sm.find(Sha1Hash(hash))?.let { sm.remove(it) }
                } catch (e: Exception) {
                    Log.e(TAG, "Error removing torrent $hash during stopAll", e)
                }
            }
        }
        
        activeTorrents.clear()
        activeSessionId = null
        priorityWindows.clear()
        metadataLatches.values.forEach { it.countDown() }
        metadataLatches.clear()

        updateServiceState()
    }
    
    /**
     * Delete all files in the download directory.
     * Synchronous execution preferred for reliability during shutdown.
     */
    fun performStartupCleanup() {
        try {
            val dir = getDownloadDir()
            if (dir.exists()) {
                val success = dir.deleteRecursively()
                dir.mkdirs()
                Log.d(TAG, "Cleanup: Wiped data at ${dir.absolutePath} (Success: $success)")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Cleanup Failed", e)
        }
    }

    fun getDownloadDir(): File = getExternalFilesDir(null) ?: filesDir

    fun getStreamUrl(infoHash: String, fileIdx: Int): String? {
        val hash = infoHash.lowercase()
        if (!activeTorrents.containsKey(hash)) return null
        
        // Optimistic return - we don't wait for handle or metadata here.
        // The CrispyServer handles waiting/retrying when the player actually connects.
        // Use explicit IPv4 loopback. Some Android networking stacks resolve `localhost` to IPv6 (::1)
        // while our NanoHTTPD server binds to 127.0.0.1.
        return "http://127.0.0.1:11470/$hash/$fileIdx"
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

    fun hasActiveTorrents(): Boolean = activeTorrents.isNotEmpty()

    fun isHeaderReady(infoHash: String, fileIdx: Int): Pair<Boolean, Float> {
        val handle = getHandle(infoHash) ?: return Pair(false, 0f)
        if (!handle.isValid || !handle.status().hasMetadata()) return Pair(false, 0f)
        val torrentInfo = handle.torrentFile() ?: return Pair(false, 0f)

        val files = torrentInfo.files()
        val pieceLength = torrentInfo.pieceLength()
        val fileOffset = files.fileOffset(fileIdx)
        val fileSize = files.fileSize(fileIdx)

        // Calculate which piece contains the start of this file
        val startPiece = (fileOffset / pieceLength).toInt()

        // Check if the first 3 pieces are downloaded (typically ~48KB-96KB)
        // This is enough for any video container header (MKV, MP4, AVI)
        var downloadedPieces = 0
        for (i in 0 until 3) {
            if (handle.havePiece(startPiece + i)) downloadedPieces++
        }

        val ready = downloadedPieces >= 3
        // Calculate overall file progress for better UX
        val endPiece = ((fileOffset + fileSize - 1) / pieceLength).toInt()
        val totalPieces = endPiece - startPiece + 1
        var totalDownloaded = 0
        for (i in startPiece..endPiece) {
            if (handle.havePiece(i)) totalDownloaded++
        }
        val progress = if (totalPieces > 0) (totalDownloaded.toFloat() / totalPieces * 100f) else 0f

        return Pair(ready, progress)
    }

    fun prioritizeHeader(infoHash: String, fileIdx: Int) {
        val handle = getHandle(infoHash) ?: return
        if (!handle.isValid || !handle.status().hasMetadata()) return
        val torrentInfo = handle.torrentFile() ?: return

        val files = torrentInfo.files()
        val pieceLength = torrentInfo.pieceLength()
        val fileOffset = files.fileOffset(fileIdx)
        val startPiece = (fileOffset / pieceLength).toInt()

        // Set deadline 0 for first 3 pieces (CRITICAL priority)
        // Set deadline 1000ms for pieces 3-4 (URGENT priority)
        for (i in 0 until 5) {
            val deadline = if (i < INSTANT_TIER_PIECES) 0 else (i - INSTANT_TIER_PIECES + 1) * DEADLINE_INCREMENT_MS
            try {
                handle.setPieceDeadline(startPiece + i, deadline)
            } catch (e: Exception) {
                // Piece might be out of range for very small files
                break
            }
        }

        Log.d(TAG, "Prioritized header pieces ${startPiece}-${startPiece + 4} for $infoHash/$fileIdx")
    }

    fun startStreaming(infoHash: String, fileIdx: Int) {
        val handle = getHandle(infoHash) ?: run {
            Log.w(TAG, "startStreaming: torrent not found: $infoHash")
            return
        }
        
        if (!handle.isValid) {
            Log.w(TAG, "startStreaming: handle invalid: $infoHash")
            return
        }
        
        if (!handle.status().hasMetadata()) {
            Log.w(TAG, "startStreaming: torrent metadata not ready: $infoHash")
            return
        }
        
        val torrentInfo = handle.torrentFile() ?: run {
            Log.w(TAG, "startStreaming: could not get torrent info: $infoHash")
            return
        }
        
        if (fileIdx < 0 || fileIdx >= torrentInfo.numFiles()) {
            Log.w(TAG, "startStreaming: invalid fileIdx: $fileIdx")
            return
        }
        
        val files = torrentInfo.files()
        val pieceLength = torrentInfo.pieceLength()
        val fileOffset = files.fileOffset(fileIdx)
        val fileSize = files.fileSize(fileIdx)
        
        val startPiece = (fileOffset / pieceLength).toInt()
        val endPiece = ((fileOffset + fileSize - 1) / pieceLength).toInt()
        
        // Get or create priority window for this stream
        val windowKey = "$infoHash:$fileIdx"
        val priorityWindow = priorityWindows.getOrPut(windowKey) {
            java.util.concurrent.ConcurrentHashMap.newKeySet()
        }
        
        // Clear any existing deadlines from previous playback
        val iter = priorityWindow.iterator()
        while (iter.hasNext()) {
            val p = iter.next()
            try { handle.resetPieceDeadline(p) } catch (_: Exception) {}
            iter.remove()
        }
        
        // Set tiered deadlines for first N pieces
        val piecesToSet = minOf(PIECES_TO_BUFFER, endPiece - startPiece + 1)
        for (i in 0 until piecesToSet) {
            val pieceIdx = startPiece + i
            // Tier 1: First 3 pieces = deadline 0 (CRITICAL - download ASAP)
            // Tier 2: Remaining pieces = incremental deadline
            val deadline = if (i < INSTANT_TIER_PIECES) 0 else (i - INSTANT_TIER_PIECES + 1) * DEADLINE_INCREMENT_MS
            try {
                handle.setPieceDeadline(pieceIdx, deadline)
                priorityWindow.add(pieceIdx)
            } catch (e: Exception) {
                Log.w(TAG, "Could not set deadline for piece $pieceIdx: ${e.message}")
            }
        }
        
        // Enable sequential download as "autopilot" for continuous playback
        // This ensures pieces 21, 22, 23... are downloaded after our buffer
        try {
            val currentFlags = handle.flags()
            handle.setFlags(currentFlags.or_(TorrentFlags.SEQUENTIAL_DOWNLOAD))
        } catch (e: Exception) {
            Log.w(TAG, "Could not set sequential download flag: ${e.message}")
        }
        
        // Boost peer discovery for faster stream start
        boostPeerDiscovery(handle)
        
        Log.d(TAG, "startStreaming: set tiered deadlines for pieces $startPiece-${startPiece + piecesToSet - 1} (instant: $INSTANT_TIER_PIECES) for $infoHash/$fileIdx")
    }
    
    private fun boostPeerDiscovery(handle: TorrentHandle) {
        try {
            handle.forceReannounce()
            handle.forceDHTAnnounce()
            Log.d(TAG, "Boosted peer discovery for ${handle.infoHash().toHex()}")
        } catch (e: Exception) {
            Log.w(TAG, "Could not boost peer discovery: ${e.message}")
        }
    }

    fun handleSeek(infoHash: String, fileIdx: Int, seekPosition: Long) {
        val handle = getHandle(infoHash) ?: run {
            Log.w(TAG, "handleSeek: torrent not found: $infoHash")
            return
        }
        
        if (!handle.isValid) {
            Log.w(TAG, "handleSeek: handle invalid: $infoHash")
            return
        }
        
        if (!handle.status().hasMetadata()) {
            Log.w(TAG, "handleSeek: torrent metadata not ready: $infoHash")
            return
        }
        
        val torrentInfo = handle.torrentFile() ?: run {
            Log.w(TAG, "handleSeek: could not get torrent info: $infoHash")
            return
        }
        
        if (fileIdx < 0 || fileIdx >= torrentInfo.numFiles()) {
            Log.w(TAG, "handleSeek: invalid fileIdx: $fileIdx")
            return
        }
        
        val files = torrentInfo.files()
        val pieceLength = torrentInfo.pieceLength()
        val fileOffset = files.fileOffset(fileIdx)
        val fileSize = files.fileSize(fileIdx)
        
        // Calculate piece at seek position
        val seekPiece = ((fileOffset + seekPosition) / pieceLength).toInt()
        val endPiece = ((fileOffset + fileSize - 1) / pieceLength).toInt()
        
        // Get or create priority window for this stream
        val windowKey = "$infoHash:$fileIdx"
        val priorityWindow = priorityWindows.getOrPut(windowKey) {
            java.util.concurrent.ConcurrentHashMap.newKeySet()
        }
        
        // OPTIMIZED CLEAR: Only reset the pieces we previously prioritized
        // Instead of looping 2000+ times for a 2GB file, we loop ~20 times.
        // This is the key optimization that prevents seek stutter/jank.
        val iter = priorityWindow.iterator()
        while (iter.hasNext()) {
            val p = iter.next()
            try { handle.resetPieceDeadline(p) } catch (_: Exception) {}
            iter.remove()
        }
        
        // Set new tiered deadlines from seek position
        val piecesToSet = minOf(PIECES_TO_BUFFER, endPiece - seekPiece + 1)
        for (i in 0 until piecesToSet) {
            val pieceIdx = seekPiece + i
            if (pieceIdx <= endPiece) {
                // Tier 1: First 3 pieces = deadline 0 (CRITICAL - tells swarm "send NOW or I disconnect")
                // Tier 2: Remaining pieces = incremental deadline for smooth buffering
                val deadline = if (i < INSTANT_TIER_PIECES) 0 else (i - INSTANT_TIER_PIECES + 1) * DEADLINE_INCREMENT_MS
                try {
                    handle.setPieceDeadline(pieceIdx, deadline)
                    priorityWindow.add(pieceIdx)
                } catch (e: Exception) {
                    Log.w(TAG, "Could not set deadline for piece $pieceIdx: ${e.message}")
                }
            }
        }
        
        // Ensure sequential download is enabled (autopilot for continuous playback)
        try {
            val currentFlags = handle.flags()
            handle.setFlags(currentFlags.or_(TorrentFlags.SEQUENTIAL_DOWNLOAD))
        } catch (e: Exception) {
            Log.w(TAG, "Could not set sequential download flag: ${e.message}")
        }
        
        Log.d(TAG, "handleSeek: Prioritized pieces $seekPiece-${seekPiece + piecesToSet - 1} (instant: $INSTANT_TIER_PIECES) for $infoHash/$fileIdx")
    }
}
