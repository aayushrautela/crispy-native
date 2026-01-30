import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { usePlayerControls } from '../hooks/usePlayerControls';
import ExoPlayerNative, { ExoPlayerNativeRef } from './ExoPlayerNative';
import MpvPlayer, { MpvPlayerRef } from './MpvPlayer';
import { KSPlayerSurface, type KSPlayerSurfaceRef } from './ios/KSPlayerSurface';

// Codec error patterns that should trigger MPV fallback
const CODEC_ERROR_PATTERNS = [
    'exceeds_capabilities',
    'decoder_exception',
    'codec.*error',
    'unsupported.*codec',
    'mediacodec.*exception',
    'dolby.*vision',
    'hevc.*error',
    'no suitable decoder',
    'decoder initialization failed',
    'format.no_decoder',
    'decoding_failed',
    'exoplaybackexception',
];

const isCodecError = (errorString: string): boolean => {
    const lowerError = errorString.toLowerCase();
    return CODEC_ERROR_PATTERNS.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(lowerError);
    });
};

export interface VideoSurfaceRef {
    seek: (seconds: number) => void;
    setAudioTrack?: (id: number) => void;
    setSubtitleTrack?: (id: number) => void;
    setSubtitleSize?: (size: number) => void;
    setSubtitleColor?: (color: string) => void;
    setSubtitleBackgroundColor?: (color: string, opacity: number) => void;
    setSubtitleBorderSize?: (size: number) => void;
    setSubtitleBorderColor?: (color: string) => void;
    setSubtitlePosition?: (pos: number) => void;
    setSubtitleDelay?: (delay: number) => void;
    setSubtitleBold?: (bold: boolean) => void;
    setSubtitleItalic?: (italic: boolean) => void;
}

interface VideoSurfaceProps {
    source: string;
    headers?: Record<string, string>;
    paused: boolean;
    volume?: number;
    rate?: number;
    resizeMode?: 'contain' | 'cover' | 'stretch';

    // Track selection - react-native-video format
    selectedAudioTrack?: { type: 'index' | 'disabled', value?: number };
    selectedTextTrack?: { type: 'index' | 'disabled', value?: number };
    subtitleDelay?: number;

    // Engine selection
    useExoPlayer: boolean;
    decoderMode?: 'auto' | 'sw' | 'hw' | 'hw+';
    gpuMode?: 'gpu' | 'gpu-next';
    onCodecError?: () => void;

    // Callbacks
    onLoad?: (data: { duration: number; width: number; height: number }) => void;
    onProgress?: (data: { currentTime: number; duration: number }) => void;
    onEnd?: () => void;
    onError?: (error: { message: string }) => void;
    onTracksChanged?: (data: { audioTracks: any[]; subtitleTracks: any[] }) => void;
    metadata?: import('@/modules/crispy-native-core').CrispyMediaMetadata;
}

export const VideoSurface = forwardRef<VideoSurfaceRef, VideoSurfaceProps>((props, ref) => {
    const {
        source,
        headers,
        paused,
        volume = 1.0,
        rate = 1.0,
        resizeMode = 'contain',
        selectedAudioTrack,
        selectedTextTrack,
        subtitleDelay = 0,
        useExoPlayer,
        onCodecError,
        onLoad,
        onProgress,
        onEnd,
        onError,
        onTracksChanged,
    } = props;

    // Log metadata for debugging notifications
    React.useEffect(() => {
        console.log('[VideoSurface] Received metadata:', props.metadata);
    }, [props.metadata]);

    const exoPlayerRef = useRef<ExoPlayerNativeRef>(null);
    const mpvPlayerRef = useRef<MpvPlayerRef>(null);

    const isSeeking = useRef(false);
    const isMounted = useRef(true);

    const { seekToTime } = usePlayerControls(
        mpvPlayerRef,
        paused,
        () => { }, // setPaused placeholder as props handles it
        0, // currentTime placeholder
        1000000, // duration placeholder (controls check duration > 0)
        isSeeking,
        isMounted,
        exoPlayerRef,
        useExoPlayer
    );

    // Imperative handle - expose methods
    useImperativeHandle(ref, () => ({
        seek: (seconds: number) => {
            seekToTime(seconds);
        },
        setAudioTrack: (id: number) => {
            if (useExoPlayer) exoPlayerRef.current?.setAudioTrack(id);
            else mpvPlayerRef.current?.setAudioTrack(id);
        },
        setSubtitleTrack: (id: number) => {
            if (useExoPlayer) exoPlayerRef.current?.setSubtitleTrack(id);
            else mpvPlayerRef.current?.setSubtitleTrack(id);
        },
        setSubtitleSize: (size: number) => {
            if (!useExoPlayer) mpvPlayerRef.current?.setSubtitleSize(size);
        },
        setSubtitleColor: (color: string) => {
            if (!useExoPlayer) mpvPlayerRef.current?.setSubtitleColor(color);
        },
        setSubtitleBackgroundColor: (color: string, opacity: number) => {
            if (!useExoPlayer) mpvPlayerRef.current?.setSubtitleBackgroundColor(color, opacity);
        },
        setSubtitleBorderSize: (size: number) => {
            if (!useExoPlayer) mpvPlayerRef.current?.setSubtitleBorderSize(size);
        },
        setSubtitleBorderColor: (color: string) => {
            if (!useExoPlayer) mpvPlayerRef.current?.setSubtitleBorderColor(color);
        },
        setSubtitlePosition: (pos: number) => {
            if (!useExoPlayer) mpvPlayerRef.current?.setSubtitlePosition(pos);
        },
        setSubtitleDelay: (delay: number) => {
            if (!useExoPlayer) {
                mpvPlayerRef.current?.setSubtitleDelay(delay);
            }
        },
        setSubtitleBold: (bold: boolean) => {
            if (!useExoPlayer) mpvPlayerRef.current?.setSubtitleBold(bold);
        },
        setSubtitleItalic: (italic: boolean) => {
            if (!useExoPlayer) mpvPlayerRef.current?.setSubtitleItalic(italic);
        },
    }));

    // Apply track selection for native Exo.
    useEffect(() => {
        if (!useExoPlayer) return;

        if (selectedAudioTrack?.type === 'index' && typeof selectedAudioTrack.value === 'number') {
            exoPlayerRef.current?.setAudioTrack(selectedAudioTrack.value);
        } else if (selectedAudioTrack?.type === 'disabled') {
            exoPlayerRef.current?.setAudioTrack(-1);
        }

        if (selectedTextTrack?.type === 'index' && typeof selectedTextTrack.value === 'number') {
            exoPlayerRef.current?.setSubtitleTrack(selectedTextTrack.value);
        } else if (selectedTextTrack?.type === 'disabled') {
            exoPlayerRef.current?.setSubtitleTrack(-1);
        }
    }, [useExoPlayer, selectedAudioTrack?.type, selectedAudioTrack?.value, selectedTextTrack?.type, selectedTextTrack?.value]);

    // ========== MPV Handlers ==========
    const handleMpvLoad = (data: any) => {
        console.log('[VideoSurface] MPV onLoad:', data);
        onLoad?.({
            duration: data?.duration || 0,
            width: data?.width || 1920,
            height: data?.height || 1080,
        });
    };

    const handleMpvProgress = (data: any) => {
        onProgress?.({
            currentTime: data?.position || data?.currentTime || 0,
            duration: data?.duration || 0,
        });
    };

    const handleMpvError = (error: any) => {
        console.log('[VideoSurface] MPV onError:', error);
        onError?.({ message: error?.error || 'MPV error' });
    };

    const handleMpvTracksChanged = (data: any) => {
        console.log('[VideoSurface] MPV onTracksChanged:', data);
        onTracksChanged?.({
            audioTracks: data?.audioTracks || [],
            subtitleTracks: data?.subtitleTracks || [],
        });
    };

    if (Platform.OS !== 'android') {
        return (
            <KSPlayerSurface
                ref={useRef<KSPlayerSurfaceRef>(null) as any}
                source={source}
                headers={headers}
                paused={paused}
                volume={volume}
                rate={rate}
                resizeMode={resizeMode}
                onLoad={onLoad}
                onProgress={onProgress}
                onEnd={onEnd}
                onError={onError}
                onTracksChanged={onTracksChanged}
            />
        );
    }

    return (
        <View style={styles.container}>
            {useExoPlayer ? (
                <ExoPlayerNative
                    ref={exoPlayerRef}
                    source={source}
                    headers={headers}
                    paused={paused}
                    volume={volume}
                    rate={rate}
                    style={styles.player}
                    onEnd={onEnd}
                    resizeMode={resizeMode}
                    metadata={props.metadata}
                    playInBackground={true}
                    onLoad={(data) => onLoad?.(data)}
                    onProgress={(data) => onProgress?.(data)}
                    onTracksChanged={(data) => onTracksChanged?.(data)}
                    onError={(e) => {
                        const msg = e?.error || 'ExoPlayer error';
                        if (isCodecError(msg)) {
                            console.warn('[VideoSurface] Codec error, triggering MPV fallback');
                            onCodecError?.();
                            return;
                        }
                        onError?.({ message: msg });
                    }}
                />
            ) : (
                <MpvPlayer
                    ref={mpvPlayerRef}
                    source={source}
                    headers={headers}
                    paused={paused}
                    resizeMode={resizeMode}
                    decoderMode={props.decoderMode}
                    gpuMode={props.gpuMode}
                    metadata={props.metadata}
                    playInBackground={true}
                    style={styles.player}
                    onLoad={handleMpvLoad}
                    onProgress={handleMpvProgress}
                    onEnd={onEnd}
                    onError={handleMpvError}
                    onTracksChanged={handleMpvTracksChanged}
                />
            )}
        </View>
    );
});

VideoSurface.displayName = 'VideoSurface';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    player: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
});
