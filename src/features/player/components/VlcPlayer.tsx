import { CrispyVlcVideoView } from '@/modules/crispy-native-core';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

export interface VlcPlayerRef {
    seek: (positionSeconds: number) => void;
    setAudioTrack: (trackId: number) => void;
    setSubtitleTrack: (trackId: number) => void;
    setSubtitleSize: (size: number) => void;
    setSubtitleColor: (color: string) => void;
    setSubtitleBackgroundColor: (color: string, opacity: number) => void;
    setSubtitleBorderSize: (size: number) => void;
    setSubtitleBorderColor: (color: string) => void;
    setSubtitlePosition: (pos: number) => void;
    setSubtitleDelay: (delay: number) => void;
    setSubtitleBold: (bold: boolean) => void;
    setSubtitleItalic: (italic: boolean) => void;
    enterPiP: () => void;
}

export interface VlcPlayerProps {
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
    onBuffering?: (data: { buffering: boolean }) => void;
    onReadyForDisplay?: () => void;
    metadata?: import('@/modules/crispy-native-core').CrispyMediaMetadata;
    playInBackground?: boolean;
}

/**
 * Expo module-based native reference type.
 * Expo attaches AsyncFunctions defined in the View block directly to the ref object.
 */
interface ExpoNativeRef {
    seek?: (positionSec: number) => Promise<void>;
    setAudioTrack?: (trackId: number) => Promise<void>;
    setSubtitleTrack?: (trackId: number) => Promise<void>;
    setSubtitleSize?: (size: number) => Promise<void>;
    setSubtitleColor?: (color: string) => Promise<void>;
    setSubtitleBackgroundColor?: (color: string, opacity: number) => Promise<void>;
    setSubtitleBorderSize?: (size: number) => Promise<void>;
    setSubtitleBorderColor?: (color: string) => Promise<void>;
    setSubtitlePosition?: (pos: number) => Promise<void>;
    setSubtitleDelay?: (delay: number) => Promise<void>;
    setSubtitleBold?: (bold: boolean) => Promise<void>;
    setSubtitleItalic?: (italic: boolean) => Promise<void>;
    enterPiP?: () => Promise<void>;
}

const VlcPlayer = forwardRef<VlcPlayerRef, VlcPlayerProps>((props, ref) => {
    const nativeRef = useRef<ExpoNativeRef | null>(null);

    useImperativeHandle(ref, () => ({
        seek: (positionSeconds: number) => {
            console.log('[VlcPlayer] seek called:', positionSeconds);
            nativeRef.current?.seek?.(positionSeconds);
        },
        setAudioTrack: (trackId: number) => {
            console.log('[VlcPlayer] setAudioTrack called:', trackId);
            nativeRef.current?.setAudioTrack?.(trackId);
        },
        setSubtitleTrack: (trackId: number) => {
            nativeRef.current?.setSubtitleTrack?.(trackId);
        },
        setSubtitleSize: (size: number) => {
            nativeRef.current?.setSubtitleSize?.(size);
        },
        setSubtitleColor: (color: string) => {
            nativeRef.current?.setSubtitleColor?.(color);
        },
        setSubtitleBackgroundColor: (color: string, opacity: number) => {
            nativeRef.current?.setSubtitleBackgroundColor?.(color, opacity);
        },
        setSubtitleBorderSize: (size: number) => {
            nativeRef.current?.setSubtitleBorderSize?.(size);
        },
        setSubtitleBorderColor: (color: string) => {
            nativeRef.current?.setSubtitleBorderColor?.(color);
        },
        setSubtitlePosition: (pos: number) => {
            nativeRef.current?.setSubtitlePosition?.(pos);
        },
        setSubtitleDelay: (delay: number) => {
            nativeRef.current?.setSubtitleDelay?.(delay);
        },
        setSubtitleBold: (bold: boolean) => {
            nativeRef.current?.setSubtitleBold?.(bold);
        },
        setSubtitleItalic: (italic: boolean) => {
            nativeRef.current?.setSubtitleItalic?.(italic);
        },
        enterPiP: () => {
            nativeRef.current?.enterPiP?.();
        },
    }), []);

    if (Platform.OS !== 'android') {
        return <View style={[styles.container, props.style, { backgroundColor: 'black' }]} />;
    }

    const handleLoad = (event: any) => {
        console.log('[VlcPlayer] Native onLoad event:', event?.nativeEvent);
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
        console.log('[VlcPlayer] Native onEnd event');
        props.onEnd?.();
    };

    const handleError = (event: any) => {
        console.log('[VlcPlayer] Native onError event:', event?.nativeEvent);
        props.onError?.(event?.nativeEvent);
    };

    const handleTracksChanged = (event: any) => {
        console.log('[VlcPlayer] Native onTracksChanged event:', event?.nativeEvent);
        props.onTracksChanged?.(event?.nativeEvent);
    };

    // Encode URL to handle spaces and special characters that VLC can't process
    const encodedSource = props.source ? encodeURI(props.source) : props.source;

    return (
        <CrispyVlcVideoView
            ref={nativeRef as any}
            style={[styles.container, props.style]}
            source={encodedSource}
            headers={props.headers}
            paused={props.paused ?? true}
            resizeMode={props.resizeMode ?? 'contain'}
            metadata={props.metadata}
            playInBackground={props.playInBackground ?? false}
            onLoad={handleLoad}
            onProgress={handleProgress}
            onEnd={handleEnd}
            onError={handleError}
            onTracksChanged={handleTracksChanged}
            onBuffering={(e: any) => props.onBuffering?.(e.nativeEvent)}
            onReadyForDisplay={() => props.onReadyForDisplay?.()}
        />
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
});

VlcPlayer.displayName = 'VlcPlayer';

export default VlcPlayer;
