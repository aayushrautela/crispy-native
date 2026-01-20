import CrispyNativeCore from '@/modules/crispy-native-core';
import { VideoSurface, VideoSurfaceRef } from '@/src/components/player/VideoSurface';
import { useTheme } from '@/src/core/ThemeContext';
import { useUserStore } from '@/src/core/stores/userStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ChevronLeft, Pause, Play, RotateCcw, RotateCw, Settings } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const SafeOrientation = ScreenOrientation || {};

export default function PlayerScreen() {
    const params = useLocalSearchParams();
    const { url, title, infoHash, fileIdx, headers: headersParam } = params;
    const { theme } = useTheme();
    const router = useRouter();
    const settings = useUserStore((s) => s.settings);

    const [finalUrl, setFinalUrl] = useState<string | null>(null);
    const [headers, setHeaders] = useState<Record<string, string> | undefined>(undefined);
    const [paused, setPaused] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [progress, setProgress] = useState({ position: 0, duration: 0 });

    // Dual-engine state
    const [useExoPlayer, setUseExoPlayer] = useState(() => {
        if (settings.videoPlayerEngine === 'mpv') return false;
        if (settings.videoPlayerEngine === 'exoplayer') return true;
        return true; // 'auto' defaults to ExoPlayer
    });

    const videoRef = useRef<VideoSurfaceRef>(null);
    const controlsTimer = useRef<NodeJS.Timeout | null>(null);

    // Parse headers if present
    useEffect(() => {
        if (headersParam && typeof headersParam === 'string') {
            try {
                setHeaders(JSON.parse(headersParam));
            } catch (e) {
                console.error("Failed to parse headers", e);
            }
        }
    }, [headersParam]);

    // Resolve stream logic
    useEffect(() => {
        let isMounted = true;
        const resolve = async () => {
            setLoading(true);
            const rawUrl = url as string;

            // 1. Magnet link or infoHash -> Torrent
            if (rawUrl?.startsWith('magnet:') || infoHash) {
                const hash = (infoHash as string) || extractInfoHash(rawUrl);
                const idx = fileIdx ? parseInt(fileIdx as string) : -1;

                if (hash) {
                    console.log("Resolving torrent module...", hash, idx);
                    const localUrl = await CrispyNativeCore.resolveStream(hash, idx);
                    if (isMounted && localUrl) {
                        console.log("Resolved to local URL:", localUrl);
                        setFinalUrl(localUrl);
                    }
                }
            }
            // 2. HTTP/HTTPS -> Debrid or Direct
            else {
                if (isMounted) setFinalUrl(rawUrl);
            }
            setLoading(false);
        };

        resolve();
        return () => { isMounted = false; };
    }, [url, infoHash, fileIdx]);

    useEffect(() => {
        // Lock to landscape
        SafeOrientation.lockAsync?.(SafeOrientation.OrientationLock.LANDSCAPE);
        StatusBar.setHidden(true);

        return () => {
            SafeOrientation.lockAsync?.(SafeOrientation.OrientationLock.PORTRAIT_UP);
            StatusBar.setHidden(false);
        };
    }, []);

    const resetControlsTimer = () => {
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        setShowControls(true);
        controlsTimer.current = setTimeout(() => setShowControls(false), 5000);
    };

    const togglePlay = () => {
        setPaused(!paused);
        resetControlsTimer();
    };

    const handleSeekForward = () => {
        const newPos = progress.position + 10;
        videoRef.current?.seek(newPos);
        resetControlsTimer();
    };

    const handleSeekBackward = () => {
        const newPos = Math.max(0, progress.position - 10);
        videoRef.current?.seek(newPos);
        resetControlsTimer();
    };

    // Handle codec errors - switch to MPV
    const handleCodecError = () => {
        if (useExoPlayer && settings.videoPlayerEngine === 'auto') {
            console.warn('[PlayerScreen] Codec error detected, switching to MPV');
            setUseExoPlayer(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const extractInfoHash = (magnet: string): string | null => {
        const match = magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    };

    return (
        <View style={[styles.container, { backgroundColor: '#000' }]}>
            {finalUrl ? (
                <VideoSurface
                    ref={videoRef}
                    source={finalUrl}
                    headers={headers}
                    paused={paused}
                    useExoPlayer={useExoPlayer}
                    onCodecError={handleCodecError}
                    onProgress={(data) => setProgress({ position: data.currentTime, duration: data.duration })}
                    onLoad={(data) => {
                        console.log("Video loaded", data);
                        setLoading(false);
                    }}
                    onEnd={() => router.back()}
                    onError={(e) => console.error("Playback error", e.message)}
                />
            ) : (
                <View style={styles.centerLoading}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={{ color: '#fff', marginTop: 10 }}>Resolving Stream...</Text>
                </View>
            )}

            <Pressable style={StyleSheet.absoluteFill} onPress={resetControlsTimer}>
                {showControls && (
                    <Animated.View
                        entering={FadeIn}
                        exiting={FadeOut}
                        style={styles.overlay}
                    >
                        {/* Top Bar */}
                        <View style={styles.topBar}>
                            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
                                <ChevronLeft color="#fff" size={28} />
                            </Pressable>
                            <Text style={styles.title} numberOfLines={1}>{title as string}</Text>
                            <View style={styles.row}>
                                <Pressable style={styles.iconBtn}>
                                    <Settings color="#fff" size={24} />
                                </Pressable>
                            </View>
                        </View>

                        {/* Center Controls */}
                        <View style={styles.centerControls}>
                            <Pressable onPress={handleSeekBackward} style={styles.sideBtn}>
                                <RotateCcw color="#fff" size={32} />
                            </Pressable>
                            <Pressable onPress={togglePlay} style={styles.playBtn}>
                                {paused ? <Play color="#fff" size={48} fill="#fff" /> : <Pause color="#fff" size={48} fill="#fff" />}
                            </Pressable>
                            <Pressable onPress={handleSeekForward} style={styles.sideBtn}>
                                <RotateCw color="#fff" size={32} />
                            </Pressable>
                        </View>

                        {/* Bottom Bar */}
                        <View style={styles.bottomBar}>
                            <View style={styles.progressRow}>
                                <Text style={styles.timeText}>{formatTime(progress.position)}</Text>
                                <View style={styles.progressBarContainer}>
                                    <View style={[styles.progressBar, { backgroundColor: theme.colors.surfaceVariant + '40' }]}>
                                        <View
                                            style={[
                                                styles.progressFill,
                                                {
                                                    backgroundColor: theme.colors.primary,
                                                    width: `${(progress.position / (Math.max(progress.duration, 1))) * 100}%`
                                                }
                                            ]}
                                        />
                                    </View>
                                </View>
                                <Text style={styles.timeText}>{formatTime(progress.duration)}</Text>
                            </View>
                        </View>
                    </Animated.View>
                )}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerLoading: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'space-between',
        padding: 24,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        flex: 1,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    iconBtn: {
        padding: 8,
    },
    centerControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 64,
    },
    playBtn: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sideBtn: {
        padding: 12,
    },
    bottomBar: {
        gap: 8,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    progressBarContainer: {
        flex: 1,
        height: 48,
        justifyContent: 'center',
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
    },
    timeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        minWidth: 40,
    },
});
