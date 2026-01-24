import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Video, { ResizeMode, VideoRef } from 'react-native-video';
import MpvPlayer, { MpvPlayerRef } from './MpvPlayer';
import { usePlayerControls } from './usePlayerControls';

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

    const exoPlayerRef = useRef<VideoRef>(null);
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
            if (useExoPlayer) {
                // ExoPlayer handles track selection differently via props, but we can expose it if needed
            } else {
                mpvPlayerRef.current?.setAudioTrack(id);
            }
        },
        setSubtitleTrack: (id: number) => {
            if (!useExoPlayer) {
                mpvPlayerRef.current?.setSubtitleTrack(id);
            }
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

    // ========== ExoPlayer Handlers ==========
    const handleExoLoad = (data: any) => {
        console.log('[VideoSurface] ExoPlayer onLoad:', data);

        // Extract tracks - IMPORTANT: use 0-based array index for react-native-video
        const audioTracks = data.audioTracks?.map((t: any, i: number) => ({
            id: i,
            name: t.title || t.language || `Track ${i + 1}`,
            language: t.language,
        })) ?? [];

        const subtitleTracks = data.textTracks?.map((t: any, i: number) => ({
            id: i,
            name: t.title || t.language || `Track ${i + 1}`,
            language: t.language,
        })) ?? [];

        if (onTracksChanged && (audioTracks.length > 0 || subtitleTracks.length > 0)) {
            onTracksChanged({ audioTracks, subtitleTracks });
        }

        onLoad?.({
            duration: data.duration,
            width: data.naturalSize?.width || 1920,
            height: data.naturalSize?.height || 1080,
        });
    };

    const handleExoProgress = (data: any) => {
        onProgress?.({
            currentTime: data.currentTime,
            duration: data.playableDuration || data.currentTime,
        });
    };

    const handleExoError = (error: any) => {
        console.log('[VideoSurface] ExoPlayer onError:', JSON.stringify(error, null, 2));

        // Extract error string from multiple possible paths
        const errorParts: string[] = [];
        if (typeof error?.error === 'string') errorParts.push(error.error);
        if (error?.error?.errorString) errorParts.push(error.error.errorString);
        if (error?.error?.errorCode) errorParts.push(String(error.error.errorCode));
        if (error?.nativeStackAndroid) errorParts.push(error.nativeStackAndroid.join(' '));
        if (error?.message) errorParts.push(error.message);

        const errorString = errorParts.length > 0 ? errorParts.join(' ') : JSON.stringify(error);

        if (isCodecError(errorString)) {
            console.warn('[VideoSurface] Codec error, triggering MPV fallback');
            onCodecError?.();
            return;
        }

        onError?.({ message: errorString });
    };

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

    const getExoResizeMode = (): ResizeMode => {
        switch (resizeMode) {
            case 'cover': return ResizeMode.COVER;
            case 'stretch': return ResizeMode.STRETCH;
            default: return ResizeMode.CONTAIN;
        }
    };

    if (Platform.OS !== 'android') {
        return <View style={styles.container} />;
    }

    return (
        <View style={styles.container}>
            {useExoPlayer ? (
                <Video
                    ref={exoPlayerRef}
                    source={{ uri: source, headers }}
                    paused={paused}
                    volume={volume}
                    rate={rate}
                    resizeMode={getExoResizeMode()}
                    selectedAudioTrack={selectedAudioTrack as any}
                    selectedTextTrack={selectedTextTrack as any}
                    style={styles.player}
                    onLoad={handleExoLoad}
                    onProgress={handleExoProgress}
                    onEnd={onEnd}
                    onError={handleExoError}
                    progressUpdateInterval={500}
                    playInBackground={false}
                    playWhenInactive={false}
                    ignoreSilentSwitch="ignore"
                    automaticallyWaitsToMinimizeStalling={true}
                    useTextureView={true}
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
