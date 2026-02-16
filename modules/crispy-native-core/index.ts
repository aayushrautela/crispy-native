import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import type React from 'react';
import { Platform, ViewProps } from 'react-native';

// requireNativeModule will look for a module with the same name as in CrispyNativeCoreModule.kt
const CrispyNativeCore = requireNativeModule('CrispyNativeCore');

export interface CrispyMediaMetadata {
    title: string;
    subtitle: string;
    artworkUrl?: string;
}

export interface CrispyPiPConfig {
    enabled: boolean;
    isPlaying: boolean;
    width?: number;
    height?: number;
}

export type CrispyPlayerEngine = 'exoplayer' | 'vlc';

export type CrispyResizeMode = 'contain' | 'cover' | 'original';
export type CrispyDecoderMode = 'auto' | 'sw' | 'hw' | 'hw+';
export type CrispyGpuMode = 'gpu' | 'gpu-next';

export interface CrispyOpenPlayerActivityParams {
    sessionId: string;
    url: string;
    headers?: Record<string, string>;
    engine?: CrispyPlayerEngine;
    paused?: boolean;
    metadata?: CrispyMediaMetadata;
}

export interface CrispyNativePlayerLoadParams {
    url?: string;
    headers?: Record<string, string>;
    paused?: boolean;
    metadata?: CrispyMediaMetadata;
}

export interface CrispyVideoViewProps extends ViewProps {
    source?: string;
    headers?: Record<string, string>;
    paused?: boolean;
    resizeMode?: CrispyResizeMode;
    decoderMode?: CrispyDecoderMode;
    gpuMode?: CrispyGpuMode;
    metadata?: CrispyMediaMetadata;
    playInBackground?: boolean;

    // Events
    onLoad?: (event: { nativeEvent: { duration: number, width: number, height: number } }) => void;
    onProgress?: (event: { nativeEvent: { position: number, duration: number } }) => void;
    onEnd?: () => void;
    onError?: (event: { nativeEvent: { error: string } }) => void;
    onTracksChanged?: (event: { nativeEvent: any }) => void;
    onBuffering?: (event: { nativeEvent: { buffering: boolean } }) => void;
    onReadyForDisplay?: () => void;
}

export interface CrispyVideoViewRef {
    seek: (positionSec: number) => void;
    setAudioTrack: (trackId: number) => void;
    setSubtitleTrack: (trackId: number) => void;
    addExternalSubtitle: (url: string, title?: string, lang?: string) => void;
    setSubtitleDelay: (delay: number) => void;
}

type NativeView<P> = React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<any>>;

// Helper for unavailable views
const UnavailableView = (_: any) => null;

export const CrispyVideoView = Platform.OS === 'android'
    ? (requireNativeViewManager('CrispyNativeCore') as NativeView<CrispyVideoViewProps>)
    : (UnavailableView as unknown as NativeView<CrispyVideoViewProps>);

// VLC view (native: CrispyVlcVideoView). Keep CrispyVideoView export for backwards compatibility.
export const CrispyVlcVideoView = CrispyVideoView;
export type CrispyVlcVideoViewProps = CrispyVideoViewProps;
export type CrispyVlcVideoViewRef = CrispyVideoViewRef;

export interface CrispyExoVideoViewProps extends ViewProps {
    source?: string;
    headers?: Record<string, string>;
    paused?: boolean;
    rate?: number;
    volume?: number;
    resizeMode?: CrispyResizeMode;
    metadata?: CrispyMediaMetadata;
    playInBackground?: boolean;

    // Events
    onLoad?: (event: { nativeEvent: { duration: number, width: number, height: number } }) => void;
    onProgress?: (event: { nativeEvent: { currentTime: number, duration: number } }) => void;
    onEnd?: () => void;
    onError?: (event: { nativeEvent: { error: string } }) => void;
    onTracksChanged?: (event: { nativeEvent: any }) => void;
    onBuffering?: (event: { nativeEvent: { buffering: boolean } }) => void;
    onReadyForDisplay?: () => void;
}

export interface CrispyExoVideoViewRef {
    seek: (positionSec: number) => void;
    setAudioTrack: (trackId: number) => void;
    setSubtitleTrack: (trackId: number) => void;
}

export const CrispyExoVideoView = Platform.OS === 'android'
    ? (requireNativeViewManager('CrispyExoPlayer') as NativeView<CrispyExoVideoViewProps>)
    : (UnavailableView as unknown as NativeView<CrispyExoVideoViewProps>);

// KSPlayer view (iOS only)
export interface CrispyKSVideoViewProps extends ViewProps {
    source?: string;
    headers?: Record<string, string>;
    paused?: boolean;
    rate?: number;
    volume?: number;
    resizeMode?: CrispyResizeMode;
    metadata?: CrispyMediaMetadata;
    playInBackground?: boolean;

    // Events
    onLoad?: (event: { nativeEvent: { duration: number, width: number, height: number } }) => void;
    onProgress?: (event: { nativeEvent: { currentTime: number, duration: number } }) => void;
    onEnd?: () => void;
    onError?: (event: { nativeEvent: { error: string } }) => void;
    onTracksChanged?: (event: { nativeEvent: any }) => void;
    onBuffering?: (event: { nativeEvent: { buffering: boolean } }) => void;
    onReadyForDisplay?: () => void;
}

export interface CrispyKSVideoViewRef {
    seek: (positionSec: number) => void;
    setAudioTrack: (trackId: number) => void;
    setSubtitleTrack: (trackId: number) => void;
}

export const CrispyKSVideoView = Platform.OS === 'ios'
    ? (requireNativeViewManager('CrispyKSPlayer') as NativeView<CrispyKSVideoViewProps>)
    : (UnavailableView as unknown as NativeView<CrispyKSVideoViewProps>);

export default {
    /**
     * Resolve a stream (e.g. infoHash) into a localhost URL.
     * Auto-starts the torrent engine if needed.
     * @deprecated Use startStream instead
     */
    async resolveStream(infoHash: string, fileIdx: number = -1): Promise<string | null> {
        return this.startStream(infoHash, fileIdx);
    },

    /**
     * Starts a torrent stream (e.g. infoHash) and resolves it to a localhost URL.
     * @param sessionId Unique ID for the current player session (prevents race conditions)
     */
    async startStream(infoHash: string, fileIdx: number = -1, sessionId: string = ''): Promise<string | null> {
        try {
            return await CrispyNativeCore.startStream(infoHash, fileIdx, sessionId);
        } catch (e) {
            console.error('[CrispyNativeCore] startStream failed:', e);
            return null;
        }
    },

    /**
     * Starts a torrent stream from a torrent link (magnet/hash/url) and resolves it to a localhost URL.
     */
    async startStreamFromLink(link: string, fileIdx: number = -1, sessionId: string = ''): Promise<string | null> {
        try {
            return await CrispyNativeCore.startStreamFromLink(link, fileIdx, sessionId);
        } catch (e) {
            console.error('[CrispyNativeCore] startStreamFromLink failed:', e);
            return null;
        }
    },

    /**
     * Destroys the current stream if the session ID matches.
     * @param sessionId Session ID to match against
     */
    async destroyStream(sessionId: string = ''): Promise<void> {
        try {
            // Check if the native method exists (it might not if native module is old during dev)
            if (CrispyNativeCore.destroyStream) {
                await CrispyNativeCore.destroyStream(sessionId);
            } else {
                console.warn('[CrispyNativeCore] destroyStream native method not found');
            }
        } catch (e) {
            console.error('[CrispyNativeCore] destroyStream failed:', e);
        }
    },

    /**
     * Stops a torrent but keeps the data.
     */
    async stopTorrent(infoHash: string): Promise<void> {
        try {
            await CrispyNativeCore.stopTorrent(infoHash);
        } catch (e) {
            console.error('[CrispyNativeCore] stopTorrent failed:', e);
        }
    },

    /**
     * Stops a torrent and deletes its data from disk.
     */
    async destroyTorrent(infoHash: string): Promise<void> {
        try {
            await CrispyNativeCore.destroyTorrent(infoHash);
        } catch (e) {
            console.error('[CrispyNativeCore] destroyTorrent failed:', e);
        }
    },

    /**
     * Clears all torrent data from the download directory.
     */
    async clearCache(): Promise<void> {
        try {
            await CrispyNativeCore.clearCache();
        } catch (e) {
            console.error('[CrispyNativeCore] clearCache failed:', e);
        }
    },

    /**
     * Notifies the torrent engine about a seek event for piece prioritization.
     */
    async handleSeek(infoHash: string, fileIdx: number, position: number): Promise<void> {
        try {
            await CrispyNativeCore.handleSeek(infoHash, fileIdx, position);
        } catch (e) {
            console.error('[CrispyNativeCore] handleSeek failed:', e);
        }
    },

    /**
     * Enters Picture-in-Picture mode.
     */
    async enterPiP(width?: number, height?: number): Promise<void> {
        try {
            await CrispyNativeCore.enterPiP(width ?? null, height ?? null);
        } catch (e) {
            console.error('[CrispyNativeCore] enterPiP failed:', e);
        }
    },

    /**
     * Updates PiP configuration without entering PiP.
     *
     * This is used so Android PiP can use the correct aspect ratio and so
     * MainActivity can decide whether it should enter PiP on user leave.
     */
    async setPiPConfig(config: CrispyPiPConfig): Promise<boolean> {
        try {
            return await CrispyNativeCore.setPiPConfig(
                config.enabled,
                config.isPlaying,
                config.width ?? null,
                config.height ?? null
            );
        } catch (e) {
            console.error('[CrispyNativeCore] setPiPConfig failed:', e);
            return false;
        }
    },

    /**
     * Returns whether the host activity is currently in PiP.
     * Android-only.
     */
    async isInPiPMode(): Promise<boolean> {
        try {
            if (CrispyNativeCore.isInPiPMode) {
                return await CrispyNativeCore.isInPiPMode();
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] isInPiPMode failed:', e);
            return false;
        }
    },

    /**
     * Opens the native PlayerActivity (Android only).
     * Video surface + PiP are owned by the Activity; JS renders as an overlay.
     */
    async openPlayerActivity(params: CrispyOpenPlayerActivityParams): Promise<boolean> {
        try {
            const md = params.metadata;
            return await CrispyNativeCore.openPlayerActivity(
                params.sessionId,
                params.url,
                params.headers ?? null,
                params.engine ?? 'exoplayer',
                params.paused ?? false,
                md?.title ?? '',
                md?.subtitle ?? '',
                md?.artworkUrl ?? null
            );
        } catch (e) {
            console.error('[CrispyNativeCore] openPlayerActivity failed:', e);
            return false;
        }
    },

    async closePlayerActivity(): Promise<boolean> {
        try {
            if (CrispyNativeCore.closePlayerActivity) {
                return await CrispyNativeCore.closePlayerActivity();
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] closePlayerActivity failed:', e);
            return false;
        }
    },

    async nativePlayerSetPaused(paused: boolean): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetPaused) {
                return await CrispyNativeCore.nativePlayerSetPaused(paused);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetPaused failed:', e);
            return false;
        }
    },

    async nativePlayerSeek(positionSec: number): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSeek) {
                return await CrispyNativeCore.nativePlayerSeek(positionSec);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSeek failed:', e);
            return false;
        }
    },

    async nativePlayerLoad(params: CrispyNativePlayerLoadParams): Promise<boolean> {
        try {
            if (!CrispyNativeCore.nativePlayerLoad) return false;
            const md = params.metadata;
            return await CrispyNativeCore.nativePlayerLoad(
                params.url ?? null,
                params.headers ?? null,
                params.paused ?? false,
                md?.title ?? '',
                md?.subtitle ?? '',
                md?.artworkUrl ?? null
            );
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerLoad failed:', e);
            return false;
        }
    },

    async nativePlayerSetRate(rate: number): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetRate) {
                return await CrispyNativeCore.nativePlayerSetRate(rate);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetRate failed:', e);
            return false;
        }
    },

    async nativePlayerSetVolume(volume: number): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetVolume) {
                return await CrispyNativeCore.nativePlayerSetVolume(volume);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetVolume failed:', e);
            return false;
        }
    },

    async nativePlayerSetResizeMode(mode: CrispyResizeMode): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetResizeMode) {
                return await CrispyNativeCore.nativePlayerSetResizeMode(mode);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetResizeMode failed:', e);
            return false;
        }
    },

    async nativePlayerSetAudioTrack(trackId: number): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetAudioTrack) {
                return await CrispyNativeCore.nativePlayerSetAudioTrack(trackId);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetAudioTrack failed:', e);
            return false;
        }
    },

    async nativePlayerSetSubtitleTrack(trackId: number): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetSubtitleTrack) {
                return await CrispyNativeCore.nativePlayerSetSubtitleTrack(trackId);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetSubtitleTrack failed:', e);
            return false;
        }
    },

    async nativePlayerSetSubtitleDelay(delaySec: number): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetSubtitleDelay) {
                return await CrispyNativeCore.nativePlayerSetSubtitleDelay(delaySec);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetSubtitleDelay failed:', e);
            return false;
        }
    },

    async nativePlayerSetSubtitleSize(size: number): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetSubtitleSize) {
                return await CrispyNativeCore.nativePlayerSetSubtitleSize(size);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetSubtitleSize failed:', e);
            return false;
        }
    },

    async nativePlayerSetSubtitleColor(color: string): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetSubtitleColor) {
                return await CrispyNativeCore.nativePlayerSetSubtitleColor(color);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetSubtitleColor failed:', e);
            return false;
        }
    },

    async nativePlayerSetSubtitleBackgroundColor(color: string, opacity: number): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetSubtitleBackgroundColor) {
                return await CrispyNativeCore.nativePlayerSetSubtitleBackgroundColor(color, opacity);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetSubtitleBackgroundColor failed:', e);
            return false;
        }
    },

    async nativePlayerSetSubtitleBorderSize(size: number): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetSubtitleBorderSize) {
                return await CrispyNativeCore.nativePlayerSetSubtitleBorderSize(size);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetSubtitleBorderSize failed:', e);
            return false;
        }
    },

    async nativePlayerSetSubtitleBorderColor(color: string): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetSubtitleBorderColor) {
                return await CrispyNativeCore.nativePlayerSetSubtitleBorderColor(color);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetSubtitleBorderColor failed:', e);
            return false;
        }
    },

    async nativePlayerSetSubtitlePosition(pos: number): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetSubtitlePosition) {
                return await CrispyNativeCore.nativePlayerSetSubtitlePosition(pos);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetSubtitlePosition failed:', e);
            return false;
        }
    },

    async nativePlayerSetSubtitleBold(bold: boolean): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetSubtitleBold) {
                return await CrispyNativeCore.nativePlayerSetSubtitleBold(bold);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetSubtitleBold failed:', e);
            return false;
        }
    },

    async nativePlayerSetSubtitleItalic(italic: boolean): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetSubtitleItalic) {
                return await CrispyNativeCore.nativePlayerSetSubtitleItalic(italic);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetSubtitleItalic failed:', e);
            return false;
        }
    },

    async nativePlayerSetDecoderMode(mode: CrispyDecoderMode): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetDecoderMode) {
                return await CrispyNativeCore.nativePlayerSetDecoderMode(mode);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetDecoderMode failed:', e);
            return false;
        }
    },

    async nativePlayerSetGpuMode(mode: CrispyGpuMode): Promise<boolean> {
        try {
            if (CrispyNativeCore.nativePlayerSetGpuMode) {
                return await CrispyNativeCore.nativePlayerSetGpuMode(mode);
            }
            return false;
        } catch (e) {
            console.error('[CrispyNativeCore] nativePlayerSetGpuMode failed:', e);
            return false;
        }
    },
};
