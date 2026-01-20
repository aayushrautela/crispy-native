import { CrispyVideoView, CrispyVideoViewRef } from '@/modules/crispy-native-core';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Video, { ResizeMode, VideoRef } from 'react-native-video';

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
}

interface VideoSurfaceProps {
    source: string;
    headers?: Record<string, string>;
    paused: boolean;
    volume?: number;
    rate?: number;
    resizeMode?: 'contain' | 'cover' | 'stretch';

    // Engine selection
    useExoPlayer: boolean;
    onCodecError?: () => void;

    // Callbacks
    onLoad?: (data: { duration: number; width: number; height: number }) => void;
    onProgress?: (data: { currentTime: number; duration: number }) => void;
    onEnd?: () => void;
    onError?: (error: { message: string }) => void;
    onTracksChanged?: (data: { audioTracks: any[]; subtitleTracks: any[] }) => void;
}

export const VideoSurface = forwardRef<VideoSurfaceRef, VideoSurfaceProps>((props, ref) => {
    const {
        source,
        headers,
        paused,
        volume = 1.0,
        rate = 1.0,
        resizeMode = 'contain',
        useExoPlayer,
        onCodecError,
        onLoad,
        onProgress,
        onEnd,
        onError,
        onTracksChanged,
    } = props;

    const exoPlayerRef = useRef<VideoRef>(null);
    const mpvPlayerRef = useRef<CrispyVideoViewRef>(null);

    useImperativeHandle(ref, () => ({
        seek: (seconds: number) => {
            if (useExoPlayer) {
                exoPlayerRef.current?.seek(seconds);
            } else {
                mpvPlayerRef.current?.seek(seconds);
            }
        },
        setAudioTrack: (id: number) => {
            if (!useExoPlayer) {
                mpvPlayerRef.current?.setAudioTrack(id);
            }
        },
        setSubtitleTrack: (id: number) => {
            if (!useExoPlayer) {
                mpvPlayerRef.current?.setSubtitleTrack(id);
            }
        },
    }));

    // ExoPlayer handlers
    const handleExoLoad = (data: any) => {
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
        let errorString = 'Unknown error';

        if (typeof error?.error === 'string') {
            errorString = error.error;
        } else if (error?.error?.errorString) {
            errorString = error.error.errorString;
        } else if (error?.message) {
            errorString = error.message;
        }

        // Check for codec errors that should trigger MPV fallback
        if (isCodecError(errorString)) {
            console.warn('[VideoSurface] Codec error detected, triggering MPV fallback');
            onCodecError?.();
            return;
        }

        onError?.({ message: errorString });
    };

    // MPV handlers
    const handleMpvLoad = (event: any) => {
        onLoad?.(event.nativeEvent);
    };

    const handleMpvProgress = (event: any) => {
        onProgress?.(event.nativeEvent);
    };

    const handleMpvError = (event: any) => {
        onError?.({ message: event.nativeEvent?.error || 'MPV playback error' });
    };

    const handleMpvTracksChanged = (event: any) => {
        onTracksChanged?.(event.nativeEvent);
    };

    const getExoResizeMode = (): ResizeMode => {
        switch (resizeMode) {
            case 'cover': return ResizeMode.COVER;
            case 'stretch': return ResizeMode.STRETCH;
            default: return ResizeMode.CONTAIN;
        }
    };

    if (Platform.OS !== 'android') {
        // iOS placeholder - will use KSPlayer in future
        return (
            <View style={styles.container}>
                {/* KSPlayer will be integrated here */}
            </View>
        );
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
                    style={styles.player}
                    onLoad={handleExoLoad}
                    onProgress={handleExoProgress}
                    onEnd={onEnd}
                    onError={handleExoError}
                    progressUpdateInterval={500}
                    useTextureView={true}
                />
            ) : (
                <CrispyVideoView
                    ref={mpvPlayerRef}
                    source={source}
                    headers={headers}
                    paused={paused}
                    resizeMode={resizeMode}
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
