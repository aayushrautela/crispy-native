import { CrispyVideoView } from '@/modules/crispy-native-core';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

export interface MpvPlayerRef {
    seek: (positionSeconds: number) => void;
    setAudioTrack: (trackId: number) => void;
    setSubtitleTrack: (trackId: number) => void;
    addExternalSubtitle: (url: string, title?: string, lang?: string) => void;
    setSubtitleDelay: (delay: number) => void;
}

export interface MpvPlayerProps {
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
}

/**
 * Expo module-based native reference type.
 * Expo attaches AsyncFunctions defined in the View block directly to the ref object.
 */
interface ExpoNativeRef {
    seek?: (positionSec: number) => Promise<void>;
    setAudioTrack?: (trackId: number) => Promise<void>;
    setSubtitleTrack?: (trackId: number) => Promise<void>;
    addExternalSubtitle?: (url: string, title: string | null, lang: string | null) => Promise<void>;
    setSubtitleDelay?: (delay: number) => Promise<void>;
}

const MpvPlayer = forwardRef<MpvPlayerRef, MpvPlayerProps>((props, ref) => {
    const nativeRef = useRef<ExpoNativeRef | null>(null);

    useImperativeHandle(ref, () => ({
        seek: (positionSeconds: number) => {
            console.log('[MpvPlayer] seek called:', positionSeconds);
            nativeRef.current?.seek?.(positionSeconds);
        },
        setAudioTrack: (trackId: number) => {
            console.log('[MpvPlayer] setAudioTrack called:', trackId);
            nativeRef.current?.setAudioTrack?.(trackId);
        },
        setSubtitleTrack: (trackId: number) => {
            console.log('[MpvPlayer] setSubtitleTrack called:', trackId);
            nativeRef.current?.setSubtitleTrack?.(trackId);
        },
        addExternalSubtitle: (url: string, title?: string, lang?: string) => {
            console.log('[MpvPlayer] addExternalSubtitle called:', url, title, lang);
            nativeRef.current?.addExternalSubtitle?.(url, title ?? null, lang ?? null);
        },
        setSubtitleDelay: (delay: number) => {
            console.log('[MpvPlayer] setSubtitleDelay called:', delay);
            nativeRef.current?.setSubtitleDelay?.(delay);
        },
    }), []);

    if (Platform.OS !== 'android') {
        return <View style={[styles.container, props.style, { backgroundColor: 'black' }]} />;
    }

    const handleLoad = (event: any) => {
        console.log('[MpvPlayer] Native onLoad event:', event?.nativeEvent);
        props.onLoad?.(event?.nativeEvent);
    };

    const handleProgress = (event: any) => {
        // Map native event properties: { position, duration } -> { currentTime, duration }
        const nativeData = event?.nativeEvent;
        if (nativeData) {
            props.onProgress?.({
                currentTime: nativeData.position ?? nativeData.currentTime ?? 0,
                duration: nativeData.duration ?? 0,
            });
        }
    };

    const handleEnd = () => {
        console.log('[MpvPlayer] Native onEnd event');
        props.onEnd?.();
    };

    const handleError = (event: any) => {
        console.log('[MpvPlayer] Native onError event:', event?.nativeEvent);
        props.onError?.(event?.nativeEvent);
    };

    const handleTracksChanged = (event: any) => {
        console.log('[MpvPlayer] Native onTracksChanged event:', event?.nativeEvent);
        props.onTracksChanged?.(event?.nativeEvent);
    };

    return (
        <CrispyVideoView
            ref={nativeRef as any}
            style={[styles.container, props.style]}
            source={props.source}
            headers={props.headers}
            paused={props.paused ?? true}
            resizeMode={props.resizeMode ?? 'contain'}
            onLoad={handleLoad}
            onProgress={handleProgress}
            onEnd={handleEnd}
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

MpvPlayer.displayName = 'MpvPlayer';

export default MpvPlayer;
