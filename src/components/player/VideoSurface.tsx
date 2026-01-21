import { CrispyVideoView, CrispyVideoViewRef } from '@/modules/crispy-native-core';
import * as FileSystem from 'expo-file-system';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
    setSubtitleDelay?: (delay: number) => void;
}

interface VideoSurfaceProps {
    source: string;
    headers?: Record<string, string>;
    paused: boolean;
    volume?: number;
    rate?: number;
    resizeMode?: 'contain' | 'cover' | 'stretch';

    // Track selection
    selectedAudioTrack?: { type: 'index' | 'language' | 'title', value?: number | string };
    selectedTextTrack?: { type: 'index' | 'language' | 'title' | 'disabled', value?: number | string };
    subtitleDelay?: number;

    externalSubtitles?: Array<{
        url: string;
        title: string;
        language?: string;
    }>;

    // Engine selection
    useExoPlayer: boolean;
    onCodecError?: () => void;

    // Callbacks
    onLoad?: (data: { duration: number; width: number; height: number; audioTracks?: any[]; textTracks?: any[] }) => void;
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
        selectedAudioTrack,
        selectedTextTrack,
        subtitleDelay = 0,
        externalSubtitles = [],
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

    // Store current tracks to lookup IDs by title
    const [currentMpvTracks, setCurrentMpvTracks] = useState<{ audio: any[], sub: any[] }>({ audio: [], sub: [] });

    // Track download cache to avoid re-downloading same URL
    const downloadedSubs = useRef<Record<string, string>>({});

    // MPV handlers
    const handleMpvLoad = (event: any) => {
        const data = event.nativeEvent;
        onLoad?.({
            duration: data.duration || 0,
            width: data.width || 0,
            height: data.height || 0,
        });
    };

    const handleMpvProgress = (event: any) => {
        const data = event.nativeEvent;
        onProgress?.({
            currentTime: data.position || 0,
            duration: data.duration || 0,
        });
    };

    const handleMpvError = (event: any) => {
        const data = event.nativeEvent;
        onError?.({ message: data?.error || 'MPV playback error' });
    };

    const handleMpvTracksChanged = (event: any) => {
        const data = event.nativeEvent;
        if (data) {
            setCurrentMpvTracks({
                audio: data.audioTracks || [],
                sub: data.subtitleTracks || []
            });
        }
        onTracksChanged?.(data);
    };

    // Sync track selections for MPV
    useEffect(() => {
        if (!useExoPlayer && mpvPlayerRef.current) {
            if (selectedAudioTrack?.type === 'index' && typeof selectedAudioTrack.value === 'number') {
                mpvPlayerRef.current.setAudioTrack(selectedAudioTrack.value);
            }
        }
    }, [useExoPlayer, selectedAudioTrack]);

    useEffect(() => {
        if (!useExoPlayer && mpvPlayerRef.current) {
            if (selectedTextTrack?.type === 'index' && typeof selectedTextTrack.value === 'number') {
                mpvPlayerRef.current.setSubtitleTrack(selectedTextTrack.value);
            } else if (selectedTextTrack?.type === 'title' && typeof selectedTextTrack.value === 'string') {
                // Determine ID from title
                const titleToFind = selectedTextTrack.value;
                const track = currentMpvTracks.sub.find((t: any) =>
                    (t.name === titleToFind) || (t.title === titleToFind)
                );
                if (track && typeof track.id === 'number') {
                    console.log(`[VideoSurface] Selecting MPV sub track by title "${titleToFind}" -> ID ${track.id}`);
                    mpvPlayerRef.current.setSubtitleTrack(track.id);
                } else {
                    console.warn(`[VideoSurface] Could not find MPV sub track with title "${titleToFind}"`);
                }
            } else if (selectedTextTrack?.type === 'disabled') {
                mpvPlayerRef.current.setSubtitleTrack(-1);
            }
        }
    }, [useExoPlayer, selectedTextTrack, currentMpvTracks]);

    // Download and Add external subtitles to MPV
    useEffect(() => {
        if (!useExoPlayer && source && mpvPlayerRef.current && externalSubtitles.length > 0) {
            const addSubs = async () => {
                console.log(`[VideoSurface] Processing ${externalSubtitles.length} external subtitles for MPV`);
                for (const sub of externalSubtitles) {
                    try {
                        let finalUrl = sub.url;

                        // Check cache first
                        if (downloadedSubs.current[sub.url]) {
                            finalUrl = downloadedSubs.current[sub.url];
                        } else if (sub.url.startsWith('http')) {
                            // Download to local file for robustness
                            const filename = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}.srt`;
                            const fileUri = `${FileSystem.cacheDirectory}${filename}`;
                            await FileSystem.downloadAsync(sub.url, fileUri);
                            finalUrl = fileUri;
                            downloadedSubs.current[sub.url] = fileUri;
                            console.log(`[VideoSurface] Downloaded sub to ${finalUrl}`);
                        }

                        mpvPlayerRef.current?.addExternalSubtitle(finalUrl, sub.title, sub.language);
                    } catch (e) {
                        console.error(`[VideoSurface] Failed to load external sub ${sub.title}`, e);
                        // Fallback to URL if download fails
                        mpvPlayerRef.current?.addExternalSubtitle(sub.url, sub.title, sub.language);
                    }
                }
            };
            addSubs();
        }
    }, [useExoPlayer, source, externalSubtitles]);

    useEffect(() => {
        if (!useExoPlayer && mpvPlayerRef.current) {
            mpvPlayerRef.current.setSubtitleDelay?.(subtitleDelay);
        }
    }, [useExoPlayer, subtitleDelay]);

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
            duration: data.seekableDuration || data.playableDuration || data.duration || 0,
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

    const getExoResizeMode = (): ResizeMode => {
        switch (resizeMode) {
            case 'cover': return ResizeMode.COVER;
            case 'stretch': return ResizeMode.STRETCH;
            default: return ResizeMode.CONTAIN;
        }
    };

    if (Platform.OS !== 'android') {
        return (
            <View style={styles.container}>
                {/* iOS placeholder */}
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
                    selectedAudioTrack={selectedAudioTrack as any}
                    selectedTextTrack={selectedTextTrack as any}
                    textTracks={externalSubtitles.map(s => ({
                        uri: s.url,
                        title: s.title,
                        type: s.url.endsWith('.vtt') ? 'text/vtt' : 'application/x-subrip',
                        language: s.language || 'en'
                    }))}
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
