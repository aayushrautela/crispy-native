package `is`.xyz.mpv

import android.content.Context
import android.util.Log
import android.view.Surface

object MPVLib {
    init {
        // Order matters! Dependencies first.
        val libs = arrayOf(
            "c++_shared",
            "avutil",
            "swresample",
            "swscale",
            "avcodec",
            "avformat",
            "avfilter",
            "avdevice",
            "mpv",
            "player"
        )
        for (lib in libs) {
            try {
                System.loadLibrary(lib)
            } catch (e: UnsatisfiedLinkError) {
                Log.e("MPVLib", "Failed to load $lib: ${e.message}")
            }
        }
    }

    // JNI functions
    @JvmStatic external fun create(context: Context)
    @JvmStatic external fun init()
    @JvmStatic external fun destroy()
    @JvmStatic external fun attachSurface(surface: Surface)
    @JvmStatic external fun detachSurface()
    @JvmStatic external fun command(args: Array<String>)
    @JvmStatic external fun setOptionString(name: String, value: String)
    @JvmStatic external fun setPropertyString(name: String, value: String)
    @JvmStatic external fun getPropertyString(name: String): String?
    @JvmStatic external fun setPropertyInt(name: String, value: Int)
    @JvmStatic external fun getPropertyInt(name: String): Int?
    @JvmStatic external fun setPropertyDouble(name: String, value: Double)
    @JvmStatic external fun getPropertyDouble(name: String): Double?
    @JvmStatic external fun setPropertyBoolean(name: String, value: Boolean)
    @JvmStatic external fun getPropertyBoolean(name: String): Boolean?
    @JvmStatic external fun observeProperty(name: String, format: Int)

    // Observer management
    private val observers = mutableListOf<EventObserver>()

    @JvmStatic
    fun addObserver(o: EventObserver) {
        synchronized(observers) { observers.add(o) }
    }

    @JvmStatic
    fun removeObserver(o: EventObserver) {
        synchronized(observers) { observers.remove(o) }
    }

    // Called by native code for logging
    @JvmStatic
    fun logMessage(prefix: String, level: Int, text: String) {
        Log.println(level, "mpv/$prefix", text)
    }

    // Callbacks from native code
    @JvmStatic
    fun eventProperty(property: String) {
        synchronized(observers) { observers.forEach { it.eventProperty(property) } }
    }

    @JvmStatic
    fun eventProperty(property: String, value: Long) {
        synchronized(observers) { observers.forEach { it.eventProperty(property, value) } }
    }

    @JvmStatic
    fun eventProperty(property: String, value: Boolean) {
        synchronized(observers) { observers.forEach { it.eventProperty(property, value) } }
    }

    @JvmStatic
    fun eventProperty(property: String, value: Double) {
        synchronized(observers) { observers.forEach { it.eventProperty(property, value) } }
    }

    @JvmStatic
    fun eventProperty(property: String, value: String) {
        synchronized(observers) { observers.forEach { it.eventProperty(property, value) } }
    }

    @JvmStatic
    fun event(eventId: Int) {
        synchronized(observers) { observers.forEach { it.event(eventId) } }
    }

    interface EventObserver {
        fun eventProperty(property: String)
        fun eventProperty(property: String, value: Long)
        fun eventProperty(property: String, value: Boolean)
        fun eventProperty(property: String, value: String)
        fun eventProperty(property: String, value: Double)
        fun event(eventId: Int)
    }

    // MPV Event constants
    object MpvEvent {
        const val MPV_EVENT_NONE = 0
        const val MPV_EVENT_SHUTDOWN = 1
        const val MPV_EVENT_LOG_MESSAGE = 2
        const val MPV_EVENT_START_FILE = 6
        const val MPV_EVENT_END_FILE = 7
        const val MPV_EVENT_FILE_LOADED = 8
        const val MPV_EVENT_SEEK = 20
        const val MPV_EVENT_PLAYBACK_RESTART = 21
        const val MPV_EVENT_PROPERTY_CHANGE = 22
    }

    // MPV Format constants
    object MpvFormat {
        const val MPV_FORMAT_NONE = 0
        const val MPV_FORMAT_FLAG = 3
        const val MPV_FORMAT_INT64 = 4
        const val MPV_FORMAT_DOUBLE = 5
    }
}
