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
     * Resolves a stream (e.g. infoHash) into a localhost URL.
     * Auto-starts the torrent engine if needed.
     */
    async resolveStream(infoHash: string, fileIdx: number = -1): Promise<string | null> {
        try {
            return await CrispyNativeCore.resolveStream(infoHash, fileIdx);
        } catch (e) {
            console.error('[CrispyNativeCore] resolveStream failed:', e);
            return null;
        }
    },

    /**
     * Stops a torrent and deletes its ephemeral data.
     */
    async stopTorrent(infoHash: string): Promise<void> {
        try {
            await CrispyNativeCore.stopTorrent(infoHash);
        } catch (e) {
            console.error('[CrispyNativeCore] stopTorrent failed:', e);
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
