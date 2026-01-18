package aayush.crispy.core

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Surface
import java.io.File

/**
 * Low-level wrapper for libmpv.so via JNI.
 * Handles initialization, command dispatch, and property observation.
 */
class MpvPlayer(private val context: Context) {
    private var holder: Long = 0
    private val handler = Handler(Looper.getMainLooper())

    companion object {
        private const val TAG = "MpvPlayer"

        init {
            // Load native libraries provided in jniLibs
            System.loadLibrary("mpv")
            System.loadLibrary("player") // Our custom native helper if any, or just mpv
        }
        
        // JNI declarations (linking to libmpv or a native helper)
        @JvmStatic private external fun _create(): Long
        @JvmStatic private external fun _init(holder: Long)
        @JvmStatic private external fun _destroy(holder: Long)
        @JvmStatic private external fun _setSurface(holder: Long, surface: Surface?)
        @JvmStatic private external fun _command(holder: Long, args: Array<String>)
        @JvmStatic private external fun _setPropertyString(holder: Long, prop: String, value: String)
        @JvmStatic private external fun _getPropertyString(holder: Long, prop: String): String?
    }

    init {
        holder = _create()
        
        // Basic configuration
        _setPropertyString(holder, "vo", "gpu")
        _setPropertyString(holder, "hwdec", "auto")
        _setPropertyString(holder, "save-position-on-quit", "no")
        
        _init(holder)
        Log.d(TAG, "MPV Player Initialized")
    }

    fun setSurface(surface: Surface?) {
        _setSurface(holder, surface)
    }

    fun load(url: String) {
        _command(holder, arrayOf("loadfile", url))
    }

    fun play() {
        _setPropertyString(holder, "pause", "no")
    }

    fun pause() {
        _setPropertyString(holder, "pause", "yes")
    }

    fun seek(positionMs: Long) {
        val seconds = positionMs / 1000.0
        _command(holder, arrayOf("seek", seconds.toString(), "absolute"))
    }

    fun getDuration(): Long {
        return (_getPropertyString(holder, "duration")?.toDoubleOrNull() ?: 0.0).toLong() * 1000
    }

    fun getPosition(): Long {
        return (_getPropertyString(holder, "time-pos")?.toDoubleOrNull() ?: 0.0).toLong() * 1000
    }

    fun destroy() {
        if (holder != 0L) {
            _destroy(holder)
            holder = 0
        }
    }
}
