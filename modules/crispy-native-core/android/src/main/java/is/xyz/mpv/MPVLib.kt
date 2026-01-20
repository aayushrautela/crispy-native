package is.xyz.mpv

import android.content.Context
import android.view.Surface

object MPVLib {
    init {
        System.loadLibrary("mpv")
        System.loadLibrary("player")
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
