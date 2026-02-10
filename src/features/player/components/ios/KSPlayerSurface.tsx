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
import { StyleSheet, View } from 'react-native';
import { CrispyKSVideoView, type CrispyKSVideoViewRef, type CrispyKSVideoViewProps } from '@/modules/crispy-native-core';

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
    resizeMode?: 'contain' | 'cover' | 'original';
    onLoad?: (data: { duration: number; width: number; height: number }) => void;
    onProgress?: (data: { currentTime: number; duration: number }) => void;
    onEnd?: () => void;
    onError?: (error: { message: string }) => void;
    onTracksChanged?: (data: { audioTracks: any[]; subtitleTracks: any[] }) => void;
    metadata?: any;
}

export const KSPlayerSurface = React.forwardRef<KSPlayerSurfaceRef, KSPlayerSurfaceProps>(function KSPlayerSurface(props, ref) {
    const nativeRef = React.useRef<CrispyKSVideoViewRef>(null);

    React.useImperativeHandle(ref, () => ({
        seek: (seconds: number) => {
            nativeRef.current?.seek(seconds);
        },
        setAudioTrack: (id: number) => {
            nativeRef.current?.setAudioTrack(id);
        },
        setSubtitleTrack: (id: number) => {
            nativeRef.current?.setSubtitleTrack(id);
        },
    }));

    const handleLoad = (event: any) => {
        const { duration, width, height } = event.nativeEvent;
        props.onLoad?.({ duration, width, height });
    };

    const handleProgress = (event: any) => {
        const { currentTime, duration } = event.nativeEvent;
        props.onProgress?.({ currentTime, duration });
    };

    const handleError = (event: any) => {
        const { error } = event.nativeEvent;
        props.onError?.({ message: error });
    };

    const handleTracksChanged = (event: any) => {
        props.onTracksChanged?.(event.nativeEvent);
    };

    return (
        <View style={styles.container}>
            <CrispyKSVideoView
                ref={nativeRef as any}
                style={styles.player}
                source={props.source}
                headers={props.headers}
                paused={props.paused}
                volume={props.volume}
                rate={props.rate}
                resizeMode={props.resizeMode}
                metadata={props.metadata}
                onLoad={handleLoad}
                onProgress={handleProgress}
                onEnd={props.onEnd}
                onError={handleError}
                onTracksChanged={handleTracksChanged}
            />
        </View>
    );
});

KSPlayerSurface.displayName = 'KSPlayerSurface';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    player: {
        flex: 1,
    },
});
