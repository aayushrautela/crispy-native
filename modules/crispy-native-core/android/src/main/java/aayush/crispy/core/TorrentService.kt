package aayush.crispy.core

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.thread

/**
 * Foreground service that runs a bundled TorrServer process.
 */
class TorrentService : Service() {

    companion object {
        private const val TAG = "TorrentService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "torrent_service_channel"
        private const val IDLE_TIMEOUT_MS = 3 * 60 * 1000L

        private const val LOCAL_HOST = "127.0.0.1"
        private const val LOCAL_PORT = 8090

        private const val RUNTIME_DIR = "torrserver"
        private const val DATA_DIR = "data"
        private const val TORRENTS_DIR = "torrents"

        private const val TORRSERVER_LIB_NAME = "libtorrserver.so"

        private fun safeSize(path: File): Long {
            return try {
                if (!path.exists()) {
                    0L
                } else if (path.isFile) {
                    path.length()
                } else {
                    path.listFiles()?.sumOf { safeSize(it) } ?: 0L
                }
            } catch (_: Exception) {
                0L
            }
        }

        fun getTorrentStorageDir(context: Context): File {
            val runtime = File(context.filesDir, RUNTIME_DIR)
            val torrents = File(runtime, TORRENTS_DIR)
            if (!torrents.exists() && !torrents.mkdirs()) {
                Log.w(TAG, "Failed creating TorrServer torrents dir at ${torrents.absolutePath}")
            }
            return torrents
        }

        fun cleanupTorrentStorage(context: Context, reason: String): Boolean {
            val runtime = File(context.filesDir, RUNTIME_DIR)
            var removedEntries = 0
            var freedBytes = 0L
            var hadErrors = false

            val children = runtime.listFiles() ?: emptyArray()
            for (child in children) {
                val size = safeSize(child)
                val ok = try {
                    child.deleteRecursively()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed deleting ${child.absolutePath}", e)
                    false
                }
                if (ok) {
                    removedEntries++
                    freedBytes += size
                } else {
                    hadErrors = true
                }
            }

            val torrents = getTorrentStorageDir(context)
            val data = File(File(context.filesDir, RUNTIME_DIR), DATA_DIR)
            if (!data.exists() && !data.mkdirs()) {
                hadErrors = true
                Log.w(TAG, "Failed recreating TorrServer data dir at ${data.absolutePath}")
            }
            if (!torrents.exists() && !torrents.mkdirs()) {
                hadErrors = true
                Log.w(TAG, "Failed recreating TorrServer torrents dir at ${torrents.absolutePath}")
            }

            Log.i(TAG, "TorrServer cleanup(reason=$reason): removed=$removedEntries freedBytes=$freedBytes success=${!hadErrors}")
            return !hadErrors
        }
    }

    inner class TorrentBinder : Binder() {
        fun getService(): TorrentService = this@TorrentService
    }

    private data class ActiveTorrent(
        val link: String,
        val hash: String?,
    )

    private val binder = TorrentBinder()
    private val activeTorrents = ConcurrentHashMap<String, ActiveTorrent>()
    private val processLock = Any()

    @Volatile
    private var torrServerProcess: Process? = null

    @Volatile
    private var activeSessionId: String? = null

    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val idleRunnable = Runnable {
        if (activeTorrents.isEmpty()) {
            Log.d(TAG, "Idle timeout reached (${IDLE_TIMEOUT_MS}ms), stopping TorrentService")
            stopSelf()
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
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
        stopAll(clearStorage = true)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Crispy Streaming", NotificationManager.IMPORTANCE_LOW)
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(text: String): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = launchIntent?.let {
            PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Crispy Native Core")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
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

    private fun runtimeRoot(): File = File(filesDir, RUNTIME_DIR)
    private fun runtimeDataDir(): File = File(runtimeRoot(), DATA_DIR)
    private fun runtimeTorrentsDir(): File = File(runtimeRoot(), TORRENTS_DIR)

    private fun resolveBundledTorrServerBinary(): File? {
        val nativeLibDir = applicationInfo.nativeLibraryDir
        if (nativeLibDir.isNullOrBlank()) {
            Log.e(TAG, "nativeLibraryDir is empty; cannot locate TorrServer binary")
            return null
        }

        val binary = File(nativeLibDir, TORRSERVER_LIB_NAME)
        if (!binary.exists()) {
            Log.e(
                TAG,
                "Missing TorrServer binary at ${binary.absolutePath}. " +
                    "Expected $TORRSERVER_LIB_NAME to be packaged via jniLibs for this ABI. " +
                    "(CI: run .github/scripts/fetch-torrserver-binaries.sh before building)"
            )
            return null
        }
        if (!binary.isFile) {
            Log.e(TAG, "TorrServer binary path is not a file: ${binary.absolutePath}")
            return null
        }
        if (!binary.canExecute()) {
            Log.w(TAG, "TorrServer binary is not marked executable: ${binary.absolutePath}")
        }
        Log.i(TAG, "Using TorrServer binary: ${binary.absolutePath}")
        return binary
    }

    private fun ensureServerStarted(): Boolean {
        synchronized(processLock) {
            val process = torrServerProcess
            if (process != null && process.isAlive) {
                return true
            }

            val binary = resolveBundledTorrServerBinary() ?: return false
            runtimeDataDir().mkdirs()
            runtimeTorrentsDir().mkdirs()

            val command = listOf(
                binary.absolutePath,
                "--ip", LOCAL_HOST,
                "--port", LOCAL_PORT.toString(),
                "--path", runtimeDataDir().absolutePath,
                "--torrentsdir", runtimeTorrentsDir().absolutePath,
            )

            return try {
                val builder = ProcessBuilder(command)
                    .directory(runtimeRoot())
                    .redirectErrorStream(true)

                val started = builder.start()
                torrServerProcess = started
                thread(start = true, isDaemon = true, name = "torrserver-log") {
                    try {
                        started.inputStream.bufferedReader().useLines { lines ->
                            lines.forEach { Log.d(TAG, "[TorrServer] $it") }
                        }
                    } catch (_: Exception) {
                    }
                }
                Log.i(TAG, "TorrServer process started on $LOCAL_HOST:$LOCAL_PORT")
                true
            } catch (e: Exception) {
                Log.e(TAG, "Failed starting TorrServer process", e)
                torrServerProcess = null
                false
            }
        }
    }

    private fun stopServer() {
        synchronized(processLock) {
            val process = torrServerProcess ?: return
            try {
                process.destroy()
                process.waitFor(2, java.util.concurrent.TimeUnit.SECONDS)
                if (process.isAlive) {
                    process.destroyForcibly()
                }
                Log.i(TAG, "TorrServer process stopped")
            } catch (e: Exception) {
                Log.e(TAG, "Failed stopping TorrServer process", e)
            } finally {
                torrServerProcess = null
            }
        }
    }

    fun awaitServerReady(timeoutMs: Long = 8_000L): Boolean {
        if (!ensureServerStarted()) return false

        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            val code = httpStatus("GET", "/echo")
            if (code in 200..399) {
                return true
            }
            try {
                Thread.sleep(120)
            } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
                break
            }
        }

        Log.w(TAG, "TorrServer readiness check timed out after ${timeoutMs}ms")
        return false
    }

    private fun httpStatus(method: String, path: String): Int {
        var connection: HttpURLConnection? = null
        return try {
            connection = (URL("http://$LOCAL_HOST:$LOCAL_PORT$path").openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 500
                readTimeout = 500
            }
            connection.responseCode
        } catch (_: Exception) {
            -1
        } finally {
            connection?.disconnect()
        }
    }

    private fun postJson(path: String, body: JSONObject): JSONObject? {
        var connection: HttpURLConnection? = null
        return try {
            val payload = body.toString().toByteArray(StandardCharsets.UTF_8)
            connection = (URL("http://$LOCAL_HOST:$LOCAL_PORT$path").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 3_000
                readTimeout = 5_000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
            }
            connection.outputStream.use { it.write(payload) }
            val status = connection.responseCode
            val bodyText = (if (status in 200..399) connection.inputStream else connection.errorStream)
                ?.bufferedReader()
                ?.use { it.readText() }
                ?: return null

            JSONObject(bodyText)
        } catch (e: Exception) {
            Log.w(TAG, "HTTP POST $path failed: ${e.message}")
            null
        } finally {
            connection?.disconnect()
        }
    }

    private fun postTorrents(action: String, link: String? = null, hash: String? = null): JSONObject? {
        val payload = JSONObject().put("action", action)
        if (!link.isNullOrBlank()) payload.put("link", link)
        if (!hash.isNullOrBlank()) payload.put("hash", hash.lowercase())
        return postJson("/torrents", payload)
    }

    private fun extractInfoHash(link: String): String? {
        val normalized = link.trim()
        val magnetRegex = Regex("xt=urn:btih:([a-zA-Z0-9]+)", RegexOption.IGNORE_CASE)
        val directHashRegex = Regex("^[0-9a-fA-F]{40}$")
        val magnetMatch = magnetRegex.find(normalized)?.groupValues?.getOrNull(1)?.lowercase()
        if (!magnetMatch.isNullOrBlank()) return magnetMatch
        if (directHashRegex.matches(normalized)) return normalized.lowercase()
        return null
    }

    private fun fileStatsFrom(obj: JSONObject): JSONArray? {
        if (obj.has("file_stats") && obj.opt("file_stats") is JSONArray) {
            return obj.optJSONArray("file_stats")
        }

        val keys = obj.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val value = obj.opt(key)
            if (value is JSONObject) {
                val nested = fileStatsFrom(value)
                if (nested != null) return nested
            }
        }
        return null
    }

    private fun bestFileIndex(fileStats: JSONArray): Int {
        val preferredExtensions = setOf("mkv", "mp4", "avi", "mov", "webm", "m4v", "ts", "m2ts")
        var bestVideoIdx = -1
        var bestVideoSize = -1L
        var bestAnyIdx = 0
        var bestAnySize = -1L

        for (i in 0 until fileStats.length()) {
            val entry = fileStats.optJSONObject(i) ?: continue
            val id = entry.optInt("id", -1)
            val length = entry.optLong("length", -1L)
            val path = entry.optString("path", "")
            val ext = path.substringAfterLast('.', "").lowercase()
            val isPreferredVideo = preferredExtensions.contains(ext)

            if (length > bestAnySize && id >= 0) {
                bestAnySize = length
                bestAnyIdx = id
            }
            if (isPreferredVideo && length > bestVideoSize && id >= 0) {
                bestVideoSize = length
                bestVideoIdx = id
            }
        }

        return if (bestVideoIdx >= 0) bestVideoIdx else bestAnyIdx
    }

    fun getLargestFileIndex(infoHash: String): Int {
        val hash = infoHash.lowercase()
        repeat(20) {
            val data = postTorrents(action = "get", hash = hash)
            val fileStats = data?.let { fileStatsFrom(it) }
            if (fileStats != null && fileStats.length() > 0) {
                return bestFileIndex(fileStats)
            }
            Thread.sleep(150)
        }
        return 0
    }

    fun getLargestFileIndexFromLink(link: String): Int {
        val hash = extractInfoHash(link)
        return if (hash != null) getLargestFileIndex(hash) else 0
    }

    private fun buildStreamUrl(link: String, hash: String?, fileIdx: Int): String {
        if (!hash.isNullOrBlank()) {
            return "http://$LOCAL_HOST:$LOCAL_PORT/play/${hash.lowercase()}/$fileIdx"
        }

        val encodedLink = URLEncoder.encode(link, StandardCharsets.UTF_8.toString())
        return "http://$LOCAL_HOST:$LOCAL_PORT/stream?link=$encodedLink&index=$fileIdx&play=1"
    }

    fun getStreamUrl(infoHash: String, fileIdx: Int): String {
        return buildStreamUrl(infoHash.lowercase(), infoHash.lowercase(), fileIdx)
    }

    fun getStreamUrlForLink(link: String, fileIdx: Int): String {
        return buildStreamUrl(link, extractInfoHash(link), fileIdx)
    }

    fun startInfoHash(infoHash: String, sessionId: String? = null): Boolean {
        val hash = infoHash.lowercase()
        return startLink(hash, sessionId)
    }

    fun startLink(link: String, sessionId: String? = null): Boolean {
        if (!awaitServerReady()) {
            return false
        }

        val normalizedLink = link.trim()
        if (normalizedLink.isEmpty()) {
            return false
        }

        if (sessionId != null) {
            activeSessionId = sessionId
        }

        if (activeTorrents.isNotEmpty()) {
            stopAll(clearStorage = true)
            if (!awaitServerReady()) {
                return false
            }
        }

        val hash = extractInfoHash(normalizedLink)
        val added = postTorrents(action = "add", link = normalizedLink) != null
        if (!added) {
            Log.w(TAG, "Failed adding torrent link to TorrServer: $normalizedLink")
        }

        activeTorrents[hash ?: normalizedLink] = ActiveTorrent(normalizedLink, hash)
        updateServiceState()
        return true
    }

    fun stopTorrent(infoHash: String, clearStorage: Boolean = true) {
        val hash = infoHash.lowercase()
        try {
            postTorrents(action = "drop", hash = hash)
            if (clearStorage) {
                postTorrents(action = "wipe", hash = hash)
            }
        } catch (e: Exception) {
            Log.w(TAG, "stopTorrent failed for $hash", e)
        }
        activeTorrents.remove(hash)

        if (activeTorrents.isEmpty()) {
            activeSessionId = null
            stopServer()
            if (clearStorage) {
                performStartupCleanup("stop_torrent:$hash")
            }
        }
        updateServiceState()
    }

    fun deleteTorrentData(infoHash: String) {
        stopTorrent(infoHash, clearStorage = true)
    }

    fun stopAll(onlyForSessionId: String? = null, clearStorage: Boolean = true) {
        if (onlyForSessionId != null && activeSessionId != null && onlyForSessionId != activeSessionId) {
            Log.d(TAG, "stopAll ignored: Session mismatch (Active: $activeSessionId, Request: $onlyForSessionId)")
            return
        }

        val hashes = activeTorrents.values.mapNotNull { it.hash }
        for (hash in hashes) {
            try {
                postTorrents(action = "drop", hash = hash)
                if (clearStorage) {
                    postTorrents(action = "wipe", hash = hash)
                }
            } catch (_: Exception) {
            }
        }

        if (clearStorage) {
            try {
                postTorrents(action = "wipe")
            } catch (_: Exception) {
            }
        }

        activeTorrents.clear()
        activeSessionId = null
        stopServer()

        if (clearStorage) {
            performStartupCleanup("stop_all")
        }

        updateServiceState()
    }

    fun performStartupCleanup(reason: String = "manual"): Boolean {
        return cleanupTorrentStorage(this, reason)
    }

    fun getDownloadDir(): File = getTorrentStorageDir(this)

    fun hasActiveTorrents(): Boolean = activeTorrents.isNotEmpty()

    fun handleSeek(infoHash: String, fileIdx: Int, seekPosition: Long) {
        // TorrServer handles seek by HTTP range requests from the player.
        Log.d(TAG, "handleSeek no-op for TorrServer: infoHash=$infoHash fileIdx=$fileIdx pos=$seekPosition")
    }
}
