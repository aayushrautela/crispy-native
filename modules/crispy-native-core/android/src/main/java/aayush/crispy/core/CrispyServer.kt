package aayush.crispy.core

import android.util.Log
import fi.iki.elonen.NanoHTTPD
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.net.BindException

/**
 * Local HTTP server for Crispy.
 * Features:
 * - Streaming torrent files to MPV with Range request support
 * - /stats.json health endpoint
 * - Full CORS support for local player compatibility
 */
class CrispyServer(
    port: Int,
    private val downloadDir: File,
    private var torrentService: TorrentService? = null
) : NanoHTTPD("127.0.0.1", port) {
    
    companion object {
        private const val TAG = "CrispyServer"
        private const val CORS_ORIGIN = "*"
    }
    
    fun safeStart(): Boolean {
        return try {
            if (isAlive) {
                Log.w(TAG, "Server already running")
                return true
            }
            start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
            Log.e(TAG, "SERVER STARTED SUCCESSFULLY ON 127.0.0.1:11470")
            true
        } catch (e: BindException) {
            Log.e(TAG, "Port already in use: ${e.message}")
            false
        } catch (e: IOException) {
            Log.e(TAG, "Failed to start server: ${e.message}")
            false
        }
    }
    
    override fun useGzipWhenAccepted(r: Response?): Boolean = false
    
    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri
        
        if (session.method == Method.OPTIONS) {
            return createCorsPreflightResponse()
        }
        
        val response = when {
            uri == "/stats.json" -> serveStats()
            uri.matches(Regex("^/[a-fA-F0-9]{40}/create$")) -> serveTorrentCreate(session)
            uri.matches(Regex("^/[a-fA-F0-9]{40}/stats\\.json$")) -> serveTorrentStats(uri)
            uri.matches(Regex("^/[a-fA-F0-9]{40}/\\d+/stats\\.json$")) -> serveFileStats(uri)
            uri.matches(Regex("^/[a-fA-F0-9]{40}/\\d+$")) -> serveTorrentFile(session)
            else -> newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Not Found")
        }
        
        return response.withCorsHeaders()
    }

    private fun Response.withCorsHeaders(): Response {
        addHeader("Access-Control-Allow-Origin", CORS_ORIGIN)
        addHeader("Access-Control-Allow-Private-Network", "true")
        return this
    }
    
    private fun createCorsPreflightResponse(): Response {
        return newFixedLengthResponse(Response.Status.NO_CONTENT, MIME_PLAINTEXT, "").apply {
            addHeader("Access-Control-Allow-Origin", CORS_ORIGIN)
            addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            addHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Range")
            addHeader("Access-Control-Allow-Private-Network", "true")
            addHeader("Access-Control-Max-Age", "86400")
        }
    }
    
    private fun serveStats(): Response {
        return newFixedLengthResponse(Response.Status.OK, "application/json", """{"status":"ok"}""")
    }

    private fun serveTorrentCreate(session: IHTTPSession): Response {
        val infoHash = session.uri.removePrefix("/").removeSuffix("/create").lowercase()
        val service = torrentService ?: return newFixedLengthResponse(Response.Status.SERVICE_UNAVAILABLE, "application/json", """{"error":"TorrentService not available"}""")
        
        val started = service.startInfoHash(infoHash)
        return newFixedLengthResponse(Response.Status.OK, "application/json", """{"infoHash":"$infoHash","status":"${if (started) "created" else "pending"}"}""")
    }

    private fun serveTorrentStats(uri: String): Response {
        val infoHash = uri.trim('/').split("/")[0]
        val stats = torrentService?.getTorrentStats(infoHash) ?: return newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", """{"error":"Torrent not found"}""")
        
        val json = """
            {
                "infoHash": "${stats.infoHash}",
                "name": "${stats.name.replace("\"", "\\\"")}",
                "peers": ${stats.peers},
                "seeds": ${stats.seeds},
                "downloadSpeed": ${stats.downloadSpeed},
                "uploadSpeed": ${stats.uploadSpeed},
                "progress": ${stats.progress},
                "state": "${stats.state}"
            }
        """.trimIndent()
        return newFixedLengthResponse(Response.Status.OK, "application/json", json)
    }

    private fun serveFileStats(uri: String): Response {
        val parts = uri.trim('/').split("/") // [infoHash, fileIdx, stats.json]
        if (parts.size < 3) return newFixedLengthResponse(Response.Status.BAD_REQUEST, "application/json", """{"error":"Invalid format"}""")
        
        val infoHash = parts[0]
        val fileIdx = parts[1].toIntOrNull() ?: 0
        
        val stats = torrentService?.getFileStats(infoHash, fileIdx) ?: return newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", """{"error":"File not found"}""")
        
        val json = """
            {
                "streamProgress": ${stats.streamProgress},
                "streamLen": ${stats.streamLen},
                "streamName": "${stats.streamName.replace("\"", "\\\"")}",
                "downloaded": ${stats.downloaded},
                "pieceLength": ${stats.pieceLength}
            }
        """.trimIndent()
        return newFixedLengthResponse(Response.Status.OK, "application/json", json)
    }

    private fun serveTorrentFile(session: IHTTPSession): Response {
        val parts = session.uri.trim('/').split("/")
        if (parts.size < 2) return newFixedLengthResponse(Response.Status.BAD_REQUEST, MIME_PLAINTEXT, "Invalid format")
        
        val infoHash = parts[0].lowercase()
        val fileIdx = parts[1].toIntOrNull() ?: 0
        val service = torrentService ?: return newFixedLengthResponse(Response.Status.SERVICE_UNAVAILABLE, MIME_PLAINTEXT, "TorrentService inactive")
        
        if (service.getTorrentStats(infoHash) == null) service.startInfoHash(infoHash)
        
        val stats = service.getFileStats(infoHash, fileIdx) ?: return newFixedLengthResponse(Response.Status.SERVICE_UNAVAILABLE, MIME_PLAINTEXT, "Loading metadata...").apply { addHeader("Retry-After", "2") }
        
        service.startStreaming(infoHash, fileIdx)
        val relativeFilePath = service.getFilePath(infoHash, fileIdx) ?: return newFixedLengthResponse(Response.Status.SERVICE_UNAVAILABLE, MIME_PLAINTEXT, "Finding file...").apply { addHeader("Retry-After", "2") }
        
        val videoFile = File(service.getDownloadDir(), relativeFilePath)
        
        var elapsed = 0L
        while (elapsed < 30000L) {
            if (service.isHeaderReady(infoHash, fileIdx)) break
            service.prioritizeHeader(infoHash, fileIdx)
            Thread.sleep(500)
            elapsed += 500
        }
        
        if (!service.isHeaderReady(infoHash, fileIdx)) {
            return newFixedLengthResponse(Response.Status.SERVICE_UNAVAILABLE, MIME_PLAINTEXT, "Downloading header...").apply { addHeader("Retry-After", "2") }
        }
        
        if (!videoFile.exists()) return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, "File missing")
        
        return serveFile(session, videoFile)
    }
    
    private fun serveFile(session: IHTTPSession, file: File): Response {
        val mimeType = getMimeType(file.name)
        val fileLength = file.length()
        val rangeHeader = session.headers["range"]
        
        return if (rangeHeader != null) servePartialContent(file, fileLength, rangeHeader, mimeType)
        else serveFullContent(file, fileLength, mimeType)
    }
    
    private fun serveFullContent(file: File, fileLength: Long, mimeType: String): Response {
        return try {
            newFixedLengthResponse(Response.Status.OK, mimeType, FileInputStream(file), fileLength).apply {
                addHeader("Accept-Ranges", "bytes")
                addHeader("Content-Length", fileLength.toString())
            }
        } catch (e: IOException) {
            newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, "Read error")
        }
    }
    
    private fun servePartialContent(file: File, fileLength: Long, rangeHeader: String, mimeType: String): Response {
        val range = rangeHeader.replace("bytes=", "").split("-")
        val start = range[0].toLongOrNull() ?: 0
        val end = if (range.size > 1 && range[1].isNotEmpty()) range[1].toLong() else fileLength - 1
        
        if (start >= fileLength || end >= fileLength || start > end) return newFixedLengthResponse(Response.Status.RANGE_NOT_SATISFIABLE, MIME_PLAINTEXT, "Invalid range")
        
        val contentLength = end - start + 1
        return try {
            val fis = FileInputStream(file).apply { skip(start) }
            newFixedLengthResponse(Response.Status.PARTIAL_CONTENT, mimeType, fis, contentLength).apply {
                addHeader("Accept-Ranges", "bytes")
                addHeader("Content-Range", "bytes $start-$end/$fileLength")
                addHeader("Content-Length", contentLength.toString())
            }
        } catch (e: IOException) {
            newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, "Read error")
        }
    }

    private fun getMimeType(fileName: String): String = when {
        fileName.endsWith(".mp4", true) -> "video/mp4"
        fileName.endsWith(".mkv", true) -> "video/x-matroska"
        fileName.endsWith(".avi", true) -> "video/x-msvideo"
        fileName.endsWith(".json", true) -> "application/json"
        else -> "application/octet-stream"
    }

    fun setTorrentService(service: TorrentService) { this.torrentService = service }
}
