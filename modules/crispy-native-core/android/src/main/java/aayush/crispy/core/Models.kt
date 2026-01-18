package aayush.crispy.core

data class TorrentStats(
    val infoHash: String,
    val name: String,
    val peers: Int,
    val seeds: Int,
    val downloadSpeed: Long,
    val uploadSpeed: Long,
    val progress: Float,
    val state: String
)

data class FileStats(
    val streamProgress: Float,
    val streamLen: Long,
    val streamName: String,
    val downloaded: Long,
    val pieceLength: Int
)
