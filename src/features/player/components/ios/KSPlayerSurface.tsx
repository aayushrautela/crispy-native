/**
 * KSPlayer Surface - iOS Video Player
 * 
 * This is a placeholder for future KSPlayer integration on iOS.
 * KSPlayer is a high-performance video player framework for iOS/macOS
 * built on FFmpeg and Metal.
 * 
 * When implemented, this component will:
 * - Wrap KSPlayer's native iOS view
 * - Provide a React Native interface matching VideoSurface
 * - Support HLS, MKV, and advanced subtitle rendering
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface KSPlayerSurfaceRef {
    seek: (seconds: number) => void;
    setAudioTrack: (id: number) => void;
    setSubtitleTrack: (id: number) => void;
}

interface KSPlayerSurfaceProps {
    source: string;
    headers?: Record<string, string>;
    paused: boolean;
    volume?: number;
    rate?: number;
    resizeMode?: 'contain' | 'cover' | 'stretch';
    onLoad?: (data: { duration: number; width: number; height: number }) => void;
    onProgress?: (data: { currentTime: number; duration: number }) => void;
    onEnd?: () => void;
    onError?: (error: { message: string }) => void;
    onTracksChanged?: (data: { audioTracks: any[]; subtitleTracks: any[] }) => void;
}

export const KSPlayerSurface = React.forwardRef<KSPlayerSurfaceRef, KSPlayerSurfaceProps>((props, ref) => {
    // TODO: Implement native iOS module bridge to KSPlayer

    React.useImperativeHandle(ref, () => ({
        seek: (seconds: number) => {
            console.log('[KSPlayerSurface] seek not implemented:', seconds);
        },
        setAudioTrack: (id: number) => {
            console.log('[KSPlayerSurface] setAudioTrack not implemented:', id);
        },
        setSubtitleTrack: (id: number) => {
            console.log('[KSPlayerSurface] setSubtitleTrack not implemented:', id);
        },
    }));

    return (
        <View style={styles.container}>
            <Text style={styles.text}>KSPlayer not yet implemented</Text>
            <Text style={styles.subtext}>iOS video playback coming soon</Text>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    subtext: {
        color: '#888',
        fontSize: 14,
        marginTop: 8,
    },
});
