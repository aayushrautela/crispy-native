package aayush.crispy.core.player

import com.facebook.react.bridge.Arguments

/**
 * Emits `nativePlayerEvent` events with a consistent payload shape.
 *
 * Special-case: track updates are cached and always emitted before any other event
 * in the same UI tick, mirroring PlayerActivity's prior behavior.
 */
internal class PlayerNativePlayerEventEmitter(
  private val tag: String,
  private val reactEmitter: PlayerReactEventEmitter,
  private val sessionIdProvider: () -> String,
  private val engineProvider: () -> String
) {

  private val warnLog = PlayerThrottledLogger(tag)

  private var pendingTracksEmit: Boolean = false
  private var cachedAudioTracks: List<Map<String, Any>> = emptyList()
  private var cachedSubtitleTracks: List<Map<String, Any>> = emptyList()

  fun emitNativePlayerEvent(eventType: String, extras: Map<String, Any>) {
    if (eventType == "tracks") {
      @Suppress("UNCHECKED_CAST")
      val audio = extras["audioTracks"] as? List<Map<String, Any>>
      @Suppress("UNCHECKED_CAST")
      val subs = extras["subtitleTracks"] as? List<Map<String, Any>>
      cachedAudioTracks = audio ?: emptyList()
      cachedSubtitleTracks = subs ?: emptyList()
      pendingTracksEmit = true
    }

    val sessionId = sessionIdProvider()
    val engine = engineProvider()

    reactEmitter.runOnUiThread {
      if (pendingTracksEmit) {
        val trackPayload = HashMap<String, Any>()
        trackPayload["sessionId"] = sessionId
        trackPayload["engine"] = engine
        trackPayload["type"] = "tracks"
        trackPayload["audioTracks"] = cachedAudioTracks
        trackPayload["subtitleTracks"] = cachedSubtitleTracks

        val nativeMap = try {
          Arguments.makeNativeMap(trackPayload)
        } catch (e: Exception) {
          warnLog.w(
            key = "nativePlayerEvent:tracks:makeNativeMap",
            message = "Failed to build nativePlayerEvent:tracks payload",
            e = e
          )
          null
        }

        if (nativeMap != null) {
          reactEmitter.emitOnUiThread(
            "nativePlayerEvent",
            nativeMap,
            debugName = "nativePlayerEvent:tracks"
          )
        }
        pendingTracksEmit = false
      }

      if (eventType == "tracks") return@runOnUiThread

      val payload = HashMap<String, Any>()
      payload["sessionId"] = sessionId
      payload["engine"] = engine
      payload["type"] = eventType
      for ((k, v) in extras.entries) {
        payload[k] = v
      }

      val nativeMap = try {
        Arguments.makeNativeMap(payload)
      } catch (e: Exception) {
        warnLog.w(
          key = "nativePlayerEvent:$eventType:makeNativeMap",
          message = "Failed to build nativePlayerEvent:$eventType payload",
          e = e
        )
        null
      }

      if (nativeMap == null) return@runOnUiThread

      reactEmitter.emitOnUiThread(
        "nativePlayerEvent",
        nativeMap,
        debugName = "nativePlayerEvent:$eventType"
      )
    }
  }
}
