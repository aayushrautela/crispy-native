import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import { ViewProps } from 'react-native';

// requireNativeModule will look for a module with the same name as in CrispyNativeCoreModule.kt
const CrispyNativeCore = requireNativeModule('CrispyNativeCore');

export interface CrispyMediaMetadata {
    title: string;
    subtitle: string;
    artworkUrl?: string;
}

export interface CrispyVideoViewProps extends ViewProps {
    source?: string;
    headers?: Record<string, string>;
    paused?: boolean;
    resizeMode?: 'contain' | 'cover' | 'stretch';
    metadata?: CrispyMediaMetadata;

    // Events
    onLoad?: (event: { nativeEvent: { duration: number, width: number, height: number } }) => void;
    onProgress?: (event: { nativeEvent: { position: number, duration: number } }) => void;
    onEnd?: () => void;
    onError?: (event: { nativeEvent: { error: string } }) => void;
    onTracksChanged?: (event: { nativeEvent: any }) => void;
}

export interface CrispyVideoViewRef {
    seek: (positionSec: number) => void;
    setAudioTrack: (trackId: number) => void;
    setSubtitleTrack: (trackId: number) => void;
    addExternalSubtitle: (url: string, title?: string, lang?: string) => void;
    setSubtitleDelay: (delay: number) => void;
}

export const CrispyVideoView: React.ComponentType<CrispyVideoViewProps> = requireNativeViewManager('CrispyNativeCore');



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
    async enterPiP(): Promise<void> {
        try {
            await CrispyNativeCore.enterPiP();
        } catch (e) {
            console.error('[CrispyNativeCore] enterPiP failed:', e);
        }
    }
};
