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
}
