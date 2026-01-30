import { CrispyExoVideoView } from '@/modules/crispy-native-core';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

export interface ExoPlayerNativeRef {
    seek: (positionSeconds: number) => void;
    setAudioTrack: (trackId: number) => void;
    setSubtitleTrack: (trackId: number) => void;
}

export interface ExoPlayerNativeProps {
    source: string;
    headers?: Record<string, string>;
    paused?: boolean;
    volume?: number;
    rate?: number;
    resizeMode?: 'contain' | 'cover' | 'stretch';
    style?: any;
    onLoad?: (data: { duration: number; width: number; height: number }) => void;
    onProgress?: (data: { currentTime: number; duration: number }) => void;
    onEnd?: () => void;
    onError?: (error: { error: string }) => void;
    onTracksChanged?: (data: { audioTracks: any[]; subtitleTracks: any[] }) => void;
    metadata?: import('@/modules/crispy-native-core').CrispyMediaMetadata;
    playInBackground?: boolean;
}

interface ExpoNativeRef {
    seek?: (positionSec: number) => Promise<void>;
    setAudioTrack?: (trackId: number) => Promise<void>;
    setSubtitleTrack?: (trackId: number) => Promise<void>;
}

const ExoPlayerNative = forwardRef<ExoPlayerNativeRef, ExoPlayerNativeProps>((props, ref) => {
    const nativeRef = useRef<ExpoNativeRef | null>(null);

    // expo view managers expose imperative methods on the ref; TS types don't model this well.
    const NativeExoView = CrispyExoVideoView as any;

    useImperativeHandle(ref, () => ({
        seek: (positionSeconds: number) => {
            nativeRef.current?.seek?.(positionSeconds);
        },
        setAudioTrack: (trackId: number) => {
            nativeRef.current?.setAudioTrack?.(trackId);
        },
        setSubtitleTrack: (trackId: number) => {
            nativeRef.current?.setSubtitleTrack?.(trackId);
        },
    }), []);

    if (Platform.OS !== 'android') {
        return <View style={[styles.container, props.style, { backgroundColor: 'black' }]} />;
    }

    const handleLoad = (event: any) => {
        props.onLoad?.(event?.nativeEvent);
    };

    const handleProgress = (event: any) => {
        const nativeData = event?.nativeEvent;
        if (nativeData) {
            props.onProgress?.({
                currentTime: nativeData.currentTime ?? 0,
                duration: nativeData.duration ?? 0,
            });
        }
    };

    const handleError = (event: any) => {
        props.onError?.(event?.nativeEvent);
    };

    const handleTracksChanged = (event: any) => {
        props.onTracksChanged?.(event?.nativeEvent);
    };

    return (
        <NativeExoView
            ref={nativeRef as any}
            style={[styles.container, props.style]}
            source={props.source}
            headers={props.headers}
            paused={props.paused ?? true}
            rate={props.rate ?? 1.0}
            volume={props.volume ?? 1.0}
            resizeMode={props.resizeMode ?? 'contain'}
            metadata={props.metadata}
            playInBackground={props.playInBackground ?? false}
            onLoad={handleLoad}
            onProgress={handleProgress}
            onEnd={props.onEnd}
            onError={handleError}
            onTracksChanged={handleTracksChanged}
        />
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
});

ExoPlayerNative.displayName = 'ExoPlayerNative';

export default ExoPlayerNative;
