package aayush.crispy.core.player

import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.os.Build
import android.util.Log

/**
 * Proactive hardware decoder capability detection.
 *
 * This utility queries the Android MediaCodecList to determine whether hardware
 * decoding is likely to succeed for a given codec/profile/resolution BEFORE
 * attempting playback. This eliminates the need for timeout-based fallbacks.
 */
object HardwareCapabilityProber {

    private const val TAG = "HwCapabilityProber"

    // MIME types for video codecs
    private const val MIME_AV1 = "video/av01"
    private const val MIME_HEVC = "video/hevc"
    private const val MIME_H264 = "video/avc"
    private const val MIME_VP9 = "video/x-vnd.on2.vp9"
    private const val MIME_VP8 = "video/x-vnd.on2.vp8"

    // Resolution thresholds
    private const val WIDTH_4K = 3840
    private const val HEIGHT_4K = 2160
    private const val WIDTH_1080P = 1920
    private const val HEIGHT_1080P = 1080

    /**
     * Result of hardware capability probe.
     */
    data class ProbeResult(
        val isHardwareSupported: Boolean,
        val recommendedHwdec: String,
        val codecName: String?,
        val reason: String
    )

    /**
     * Known problematic device/codec combinations that should skip hardware decoding.
     * These are device-specific workarounds for known driver bugs.
     */
    private val deviceBlocklist: Map<String, Set<String>> by lazy {
        buildMap {
            // Example: Some MediaTek devices have buggy AV1 implementations
            put("mt6", setOf(MIME_AV1))
            // Exynos 9810 has issues with 10-bit HEVC
            put("exynos9810", setOf(MIME_HEVC))
        }
    }

    /**
     * Probes hardware decoder capability for the given codec.
     *
     * @param mimeType The MIME type of the video codec (e.g., "video/hevc")
     * @param width Video width in pixels
     * @param height Video height in pixels
     * @param is10Bit Whether the video uses 10-bit color depth
     * @return ProbeResult indicating whether hardware decoding should be attempted
     */
    fun probe(
        mimeType: String?,
        width: Int = 0,
        height: Int = 0,
        is10Bit: Boolean = false
    ): ProbeResult {
        val safeMime = mimeType ?: return ProbeResult(
            isHardwareSupported = false,
            recommendedHwdec = "no",
            codecName = null,
            reason = "unknown-codec"
        )

        // Check device blocklist first
        val blockedReason = checkDeviceBlocklist(safeMime)
        if (blockedReason != null) {
            Log.i(TAG, "Device blocklisted for $safeMime: $blockedReason")
            return ProbeResult(
                isHardwareSupported = false,
                recommendedHwdec = "no",
                codecName = null,
                reason = blockedReason
            )
        }

        // Query MediaCodecList for hardware decoder support
        val codecInfo = findHardwareDecoder(safeMime)
        if (codecInfo == null) {
            Log.i(TAG, "No hardware decoder found for $safeMime")
            return ProbeResult(
                isHardwareSupported = false,
                recommendedHwdec = "no",
                codecName = null,
                reason = "no-hardware-decoder"
            )
        }

        // Check resolution support
        val capabilities = try {
            codecInfo.getCapabilitiesForType(safeMime)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get capabilities for ${codecInfo.name}", e)
            return ProbeResult(
                isHardwareSupported = false,
                recommendedHwdec = "no",
                codecName = codecInfo.name,
                reason = "capability-query-failed"
            )
        }

        // Validate resolution if provided
        if (width > 0 && height > 0) {
            val videoCapabilities = capabilities.videoCapabilities
            if (videoCapabilities != null) {
                val supported = try {
                    videoCapabilities.isSizeSupported(width, height)
                } catch (e: Exception) {
                    false
                }

                if (!supported) {
                    Log.i(TAG, "${codecInfo.name} does not support ${width}x${height}")
                    return ProbeResult(
                        isHardwareSupported = false,
                        recommendedHwdec = "no",
                        codecName = codecInfo.name,
                        reason = "resolution-unsupported"
                    )
                }
            }
        }

        // Check 10-bit profile support for HEVC/AV1
        if (is10Bit && (safeMime == MIME_HEVC || safeMime == MIME_AV1)) {
            val supports10Bit = check10BitSupport(capabilities, safeMime)
            if (!supports10Bit) {
                Log.i(TAG, "${codecInfo.name} does not support 10-bit for $safeMime")
                return ProbeResult(
                    isHardwareSupported = false,
                    recommendedHwdec = "no",
                    codecName = codecInfo.name,
                    reason = "10bit-unsupported"
                )
            }
        }

        // Determine recommended hwdec mode
        val hwdecMode = determineHwdecMode(codecInfo, safeMime, width, height)

        Log.i(TAG, "Hardware decoder available: ${codecInfo.name}, mode=$hwdecMode")
        return ProbeResult(
            isHardwareSupported = true,
            recommendedHwdec = hwdecMode,
            codecName = codecInfo.name,
            reason = "supported"
        )
    }

    /**
     * Finds a hardware decoder for the given MIME type.
     */
    private fun findHardwareDecoder(mimeType: String): MediaCodecInfo? {
        val codecList = MediaCodecList(MediaCodecList.ALL_CODECS)

        return codecList.codecInfos.firstOrNull { info ->
            !info.isEncoder &&
                info.supportedTypes.any { it.equals(mimeType, ignoreCase = true) } &&
                isHardwareAccelerated(info)
        }
    }

    /**
     * Checks if a codec is hardware accelerated.
     */
    private fun isHardwareAccelerated(info: MediaCodecInfo): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            info.isHardwareAccelerated
        } else {
            // Fallback for older APIs: check codec name patterns
            val name = info.name.lowercase()
            !name.startsWith("omx.google.") &&
                !name.startsWith("c2.android.") &&
                !name.contains("sw") &&
                (name.contains("omx.") || name.contains("c2."))
        }
    }

    /**
     * Checks device blocklist for known problematic combinations.
     */
    private fun checkDeviceBlocklist(mimeType: String): String? {
        val hardware = Build.HARDWARE.lowercase()
        val board = Build.BOARD.lowercase()
        val soc = Build.SOC_MODEL.lowercase()

        for ((pattern, blockedCodecs) in deviceBlocklist) {
            if (hardware.contains(pattern) || board.contains(pattern) || soc.contains(pattern)) {
                if (blockedCodecs.contains(mimeType)) {
                    return "device-blocklisted:$pattern"
                }
            }
        }
        return null
    }

    /**
     * Checks if the codec supports 10-bit color profiles.
     */
    private fun check10BitSupport(
        capabilities: MediaCodecInfo.CodecCapabilities,
        mimeType: String
    ): Boolean {
        val profileLevels = capabilities.profileLevels ?: return false

        return when (mimeType) {
            MIME_HEVC -> {
                profileLevels.any { pl ->
                    pl.profile == MediaCodecInfo.CodecProfileLevel.HEVCProfileMain10 ||
                        pl.profile == MediaCodecInfo.CodecProfileLevel.HEVCProfileMain10HDR10 ||
                        pl.profile == MediaCodecInfo.CodecProfileLevel.HEVCProfileMain10HDR10Plus
                }
            }
            MIME_AV1 -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    profileLevels.any { pl ->
                        pl.profile == MediaCodecInfo.CodecProfileLevel.AV1ProfileMain10 ||
                            pl.profile == MediaCodecInfo.CodecProfileLevel.AV1ProfileMain10HDR10 ||
                            pl.profile == MediaCodecInfo.CodecProfileLevel.AV1ProfileMain10HDR10Plus
                    }
                } else {
                    // Assume 10-bit is not supported on older APIs
                    false
                }
            }
            else -> true
        }
    }

    /**
     * Determines the best hwdec mode based on codec and resolution.
     *
     * - "mediacodec": Direct rendering (best performance, may have driver issues)
     * - "mediacodec-copy": Copy-back mode (more stable, slightly higher CPU)
     */
    private fun determineHwdecMode(
        codecInfo: MediaCodecInfo,
        mimeType: String,
        width: Int,
        height: Int
    ): String {
        val codecName = codecInfo.name.lowercase()

        // Use copy mode for potentially unstable codecs
        val preferCopyMode = when {
            // AV1 is newer and more prone to driver issues
            mimeType == MIME_AV1 -> true
            // 4K+ content is more likely to hit driver limits
            width >= WIDTH_4K || height >= HEIGHT_4K -> true
            // Google software codecs masquerading as hardware
            codecName.contains("c2.google.") -> true
            // Some vendor-specific patterns known to be unstable
            codecName.contains("qti") && mimeType == MIME_AV1 -> true
            else -> false
        }

        return if (preferCopyMode) "mediacodec-copy" else "mediacodec"
    }

    /**
     * Extracts MIME type from a file URL or codec string.
     */
    fun guessMimeType(url: String?, codecString: String? = null): String? {
        // First try codec string if available
        codecString?.lowercase()?.let { codec ->
            return when {
                codec.startsWith("av01") || codec.contains("av1") -> MIME_AV1
                codec.startsWith("hvc1") || codec.startsWith("hev1") || codec.contains("hevc") -> MIME_HEVC
                codec.startsWith("avc1") || codec.contains("h264") || codec.contains("avc") -> MIME_H264
                codec.startsWith("vp09") || codec.contains("vp9") -> MIME_VP9
                codec.startsWith("vp08") || codec.contains("vp8") -> MIME_VP8
                else -> null
            }
        }

        // Fallback to URL extension
        url?.lowercase()?.let { u ->
            return when {
                u.contains(".av1") -> MIME_AV1
                u.contains(".hevc") || u.contains(".h265") -> MIME_HEVC
                u.contains(".h264") || u.contains(".avc") -> MIME_H264
                u.contains(".vp9") -> MIME_VP9
                u.contains(".vp8") -> MIME_VP8
                // Common container formats - can't determine codec from extension alone
                u.endsWith(".mp4") || u.endsWith(".mkv") || u.endsWith(".webm") -> null
                else -> null
            }
        }

        return null
    }

    /**
     * Quick check if any hardware decoder exists for common codecs.
     * Useful for feature gating in the UI.
     */
    fun hasAnyHardwareDecoder(): Boolean {
        return listOf(MIME_H264, MIME_HEVC, MIME_VP9, MIME_AV1).any { mime ->
            findHardwareDecoder(mime) != null
        }
    }

    /**
     * Gets a summary of hardware decoder support for logging/debugging.
     */
    fun getSupportSummary(): Map<String, Boolean> {
        return mapOf(
            "h264" to (findHardwareDecoder(MIME_H264) != null),
            "hevc" to (findHardwareDecoder(MIME_HEVC) != null),
            "vp9" to (findHardwareDecoder(MIME_VP9) != null),
            "av1" to (findHardwareDecoder(MIME_AV1) != null)
        )
    }
}
