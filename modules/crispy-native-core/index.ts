import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import { ViewProps } from 'react-native';

// requireNativeModule will look for a module with the same name as in CrispyNativeCoreModule.kt
const CrispyNativeCore = requireNativeModule('CrispyNativeCore');

export interface CrispyVideoViewProps extends ViewProps {
    source?: string;
    paused?: boolean;
    onLoad?: (event: { nativeEvent: { status: string } }) => void;
    onProgress?: (event: { nativeEvent: { position: number, duration: number } }) => void;
    onEnd?: () => void;
}

export const CrispyVideoView: React.ComponentType<CrispyVideoViewProps> = requireNativeViewManager('CrispyNativeCore');

export interface LoadingIndicatorViewProps extends ViewProps {
    color?: number;
    containerColor?: number;
    size?: number;
    containerSize?: number;
}

export const LoadingIndicatorView: React.ComponentType<LoadingIndicatorViewProps> = requireNativeViewManager('CrispyNativeCore');

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
    }
};
