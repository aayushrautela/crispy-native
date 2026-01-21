import CrispyNativeCore from '@/modules/crispy-native-core';
import { LoadingIndicator } from '@/src/cdk/components/LoadingIndicator';
import { SideSheet } from '@/src/cdk/components/SideSheet';
import { Typography } from '@/src/cdk/components/Typography';
import { AudioTab } from '@/src/components/player/tabs/AudioTab';
import { EpisodesTab } from '@/src/components/player/tabs/EpisodesTab';
import { SettingsTab } from '@/src/components/player/tabs/SettingsTab';
import { StreamsTab } from '@/src/components/player/tabs/StreamsTab';
import { SubtitlesTab } from '@/src/components/player/tabs/SubtitlesTab';
import { VideoSurface, VideoSurfaceRef } from '@/src/components/player/VideoSurface';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
    ArrowLeft,
    Headphones,
    Info,
    Languages,
    Layers,
    Pause,
    Play,
    Settings,
    StepBack,
    StepForward
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming
} from 'react-native-reanimated';

const SafeOrientation = ScreenOrientation || {};

type ActiveTab = 'none' | 'audio' | 'subtitles' | 'streams' | 'settings' | 'info';

export default function PlayerScreen() {
    const params = useLocalSearchParams();
    const { url, title, infoHash, fileIdx, headers: headersParam, streams: streamsParam } = params;
    const { theme } = useTheme();
    const router = useRouter();
    const settings = useUserStore((s) => s.settings);

    const [finalUrl, setFinalUrl] = useState<string | null>(null);
    const [headers, setHeaders] = useState<Record<string, string> | undefined>(undefined);

    // Internal state for seamless switching (overrides params)
    const [activeStream, setActiveStream] = useState<{ url: string; infoHash?: string; fileIdx?: string } | null>(null);
    const [resumePosition, setResumePosition] = useState<number | null>(null);

    const [availableStreams, setAvailableStreams] = useState<any[]>([]); // For StreamsTab
    const [paused, setPaused] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [progress, setProgress] = useState({ position: 0, duration: 0 });
    const [stableDuration, setStableDuration] = useState(0); // Prevent duration flicker
    const [isSeeking, setIsSeeking] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>('none');

    // Tracks State
    const [audioTracks, setAudioTracks] = useState<any[]>([]);
    const [subtitleTracks, setSubtitleTracks] = useState<any[]>([]);
    const [selectedAudioId, setSelectedAudioId] = useState<number | string>(0); // Default to first?
    const [selectedSubtitleId, setSelectedSubtitleId] = useState<number | string | null>(null); // Default to Off

    // Gesture & Feedback State
    const [seekAccumulation, setSeekAccumulation] = useState<{ amount: number; direction: 'forward' | 'backward' | null }>({ amount: 0, direction: null });
    const seekAccumulationTimer = useRef<NodeJS.Timeout | null>(null);
    const seekBasePosition = useRef<number | null>(null);
    const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
    const { width } = useWindowDimensions();

    // Play/Pause Animation State
    const playPauseScale = useSharedValue(1);
    const [isIconAnimating, setIsIconAnimating] = useState(false);


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
        if (streamsParam && typeof streamsParam === 'string') {
            try {
                setAvailableStreams(JSON.parse(streamsParam));
            } catch (e) {
                console.error("Failed to parse streams", e);
            }
        }
    }, [headersParam]);

    // Resolve stream logic
    useEffect(() => {
        let isMounted = true;

        // Use activeStream if set, otherwise fall back to params
        const currentUrl = activeStream?.url || url as string;
        const currentInfoHash = activeStream?.infoHash || infoHash;
        const currentFileIdx = activeStream?.fileIdx || fileIdx;

        const resolve = async () => {
            setLoading(true);
            setFinalUrl(null); // Clear previous URL to ensure reload/feedback
            setStableDuration(0); // Reset duration for new stream

            // 1. Magnet link or infoHash -> Torrent
            if (currentUrl?.startsWith('magnet:') || currentInfoHash) {
                const hash = (currentInfoHash as string) || extractInfoHash(currentUrl);
                const idx = currentFileIdx ? parseInt(currentFileIdx as string) : -1;

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
                if (isMounted) setFinalUrl(currentUrl);
            }
            setLoading(false);
        };

        resolve();
        return () => { isMounted = false; };
    }, [url, infoHash, fileIdx, activeStream]); // Re-run when activeStream changes

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
        // Only auto-hide if no tab is active
        if (activeTab === 'none') {
            controlsTimer.current = setTimeout(() => setShowControls(false), 5000);
        }
    };

    // Keep controls visible when tab is active
    useEffect(() => {
        if (activeTab !== 'none') {
            if (controlsTimer.current) clearTimeout(controlsTimer.current);
            setShowControls(true);
        } else {
            resetControlsTimer();
        }
    }, [activeTab]);

    const togglePlay = () => {
        const nextPaused = !paused;
        setPaused(nextPaused);

        // Simple single bounce animation (no oscillation)
        playPauseScale.value = withSequence(
            withTiming(0.85, { duration: 100 }),
            withTiming(1, { duration: 150 })
        );

        resetControlsTimer();
    };

    const handleSeek = (direction: 'forward' | 'backward') => {
        if (seekAccumulationTimer.current) clearTimeout(seekAccumulationTimer.current);

        setSeekAccumulation(prev => {
            const isSameDirection = prev.direction === direction;
            const newAmount = isSameDirection ? prev.amount + 10 : 10;

            if (seekBasePosition.current === null || !isSameDirection) {
                seekBasePosition.current = progress.position;
            }

            const totalDelta = direction === 'forward' ? newAmount : -newAmount;
            const targetPos = Math.max(0, Math.min(stableDuration || progress.duration, seekBasePosition.current + totalDelta));

            // Convert to milliseconds for the player
            videoRef.current?.seek(targetPos * 1000);
            setProgress(p => ({ ...p, position: targetPos }));

            return { amount: newAmount, direction };
        });

        seekAccumulationTimer.current = setTimeout(() => {
            setSeekAccumulation({ amount: 0, direction: null });
            seekBasePosition.current = null;
        }, 800);

        resetControlsTimer();
    };

    const handleTouchEnd = (e: any) => {
        const now = Date.now();
        const { locationX: x } = e.nativeEvent;

        if (now - lastTapRef.current.time < 300) {
            // Double Tap Detected
            if (x < width * 0.3) {
                handleSeek('backward');
            } else if (x > width * 0.7) {
                handleSeek('forward');
            }
        } else {
            // Single Tap - Toggle Controls
            if (showControls) {
                setShowControls(false);
                if (controlsTimer.current) clearTimeout(controlsTimer.current);
            } else {
                resetControlsTimer();
            }
        }

        lastTapRef.current = { time: now, x };
    };

    const playPauseAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: playPauseScale.value }],
    }));

    const feedbackAnimatedStyle = useAnimatedStyle(() => ({
        opacity: withTiming(seekAccumulation.direction ? 1 : 0, { duration: 150 }),
    }));

    // Handle codec errors - switch to MPV
    const handleCodecError = () => {
        if (useExoPlayer && settings.videoPlayerEngine === 'auto') {
            console.warn('[PlayerScreen] Codec error detected, switching to MPV');
            setUseExoPlayer(false);
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds || !isFinite(seconds) || isNaN(seconds)) return '0:00';
        const totalSecs = Math.floor(seconds);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
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
                    onTracksChanged={(data) => {
                        console.log("Tracks changed", data);
                        setAudioTracks(data.audioTracks?.map((t: any) => ({ ...t, title: t.name || t.title || t.language || `Track ${t.id}` })) || []);
                        setSubtitleTracks(data.subtitleTracks?.map((t: any) => ({ ...t, title: t.name || t.title || t.language || 'Unknown' })) || []);
                    }}
                    onProgress={(data) => {
                        // Don't overwrite progress while user is seeking
                        if (!isSeeking) {
                            // Values are in SECONDS from react-native-video / MPV
                            const positionSec = data.position ?? data.currentTime ?? 0;
                            const durationSec = data.duration ?? 0;
                            setProgress({ position: positionSec, duration: durationSec });
                        }
                    }}
                    onLoad={(data) => {
                        setLoading(false);
                        // Duration is in SECONDS from react-native-video / MPV
                        const durationSec = data.duration ?? 0;
                        if (durationSec > 0) {
                            setStableDuration(durationSec);
                        }

                        // Handle Resume - seek expects seconds
                        if (resumePosition !== null && resumePosition > 0) {
                            console.log("Resuming at:", resumePosition);
                            videoRef.current?.seek(resumePosition);
                            setResumePosition(null); // Consumed
                        }
                    }}
                    onEnd={() => router.back()}
                    onError={(e) => console.error("Playback error", e.message)}
                />
            ) : (
                <View style={styles.centerLoading}>
                    <LoadingIndicator size="large" color={theme.colors.primary} />
                    <Typography variant="body" className="text-white mt-4">Resolving Stream...</Typography>
                </View>
            )}

            {/* Gesture Layer & Main UI Wrapper */}
            <Pressable style={StyleSheet.absoluteFill} onPress={handleTouchEnd}>
                {showControls && (
                    <Animated.View
                        entering={FadeIn.duration(300)}
                        exiting={FadeOut.duration(300)}
                        style={styles.overlay}
                    >
                        {/* 1. Top Bar - Simple Row (No Pill) */}
                        <View style={styles.topBar}>
                            <Pressable onPress={() => router.back()} style={styles.backBtn}>
                                <ArrowLeft color="#fff" size={24} />
                            </Pressable>
                            <View style={styles.titlesContainer}>
                                <Text style={styles.mainTitle} numberOfLines={1}>
                                    {title as string}
                                </Text>
                                {params.episodeTitle && (
                                    <Text style={styles.subTitle} numberOfLines={1}>
                                        {params.episodeTitle as string}
                                    </Text>
                                )}
                            </View>
                        </View>

                        {/* 2. Center Area: Feedback & Play/Pause */}
                        <View style={styles.centerArea} pointerEvents="box-none">
                            {/* YouTube-style Seek Feedback - Left */}
                            {seekAccumulation.direction === 'backward' && (
                                <Animated.View style={[styles.seekFeedbackLeft, feedbackAnimatedStyle]}>
                                    <StepBack color="#fff" size={24} />
                                    <Text style={styles.seekFeedbackText}>{seekAccumulation.amount}s</Text>
                                </Animated.View>
                            )}

                            {/* YouTube-style Seek Feedback - Right */}
                            {seekAccumulation.direction === 'forward' && (
                                <Animated.View style={[styles.seekFeedbackRight, feedbackAnimatedStyle]}>
                                    <StepForward color="#fff" size={24} />
                                    <Text style={styles.seekFeedbackText}>{seekAccumulation.amount}s</Text>
                                </Animated.View>
                            )}

                            {/* Play/Pause Pop */}
                            {!loading && (
                                <Animated.View style={[styles.centerPlayBtn, playPauseAnimatedStyle]}>
                                    <Pressable onPress={togglePlay} style={styles.centerPlayPressable}>
                                        {paused ? (
                                            <Play color="#fff" size={32} fill="#fff" style={{ marginLeft: 3 }} />
                                        ) : (
                                            <Pause color="#fff" size={32} fill="#fff" />
                                        )}
                                    </Pressable>
                                </Animated.View>
                            )}
                        </View>

                        {/* 3. Bottom Controls */}
                        <View style={styles.bottomArea}>
                            {/* Material 3 Expressive Slider */}
                            <View
                                style={styles.progressContainer}
                                onStartShouldSetResponder={() => true}
                                onMoveShouldSetResponder={() => true}
                                onResponderGrant={(e) => {
                                    setIsSeeking(true);
                                    const { pageX } = e.nativeEvent;
                                    const percentage = Math.max(0, Math.min(1, pageX / width));
                                    const targetPos = (stableDuration || progress.duration) * percentage;
                                    // Convert to milliseconds for the player
                                    videoRef.current?.seek(targetPos * 1000);
                                    resetControlsTimer();
                                    setProgress(p => ({ ...p, position: targetPos }));
                                }}
                                onResponderMove={(e) => {
                                    const { pageX } = e.nativeEvent;
                                    const percentage = Math.max(0, Math.min(1, pageX / width));
                                    const targetPos = (stableDuration || progress.duration) * percentage;
                                    // Convert to milliseconds for the player
                                    videoRef.current?.seek(targetPos * 1000);
                                    resetControlsTimer();
                                    setProgress(p => ({ ...p, position: targetPos }));
                                }}
                                onResponderRelease={() => {
                                    // Allow a small delay for the video to catch up before re-enabling progress updates
                                    setTimeout(() => setIsSeeking(false), 500);
                                }}
                            >
                                {(() => {
                                    // Pre-compute safe percentage values
                                    const duration = stableDuration || progress.duration || 1;
                                    const rawPercent = (progress.position / duration) * 100;
                                    const percent = Math.max(0, Math.min(100, rawPercent));
                                    const fillWidth = Math.max(0, percent - 0.8);
                                    const inactiveLeft = Math.min(100, percent + 0.8);

                                    return (
                                        <View style={styles.progressBackground}>
                                            {/* Active Track with Gap */}
                                            <View
                                                style={[
                                                    styles.progressFill,
                                                    {
                                                        backgroundColor: theme.colors.primary,
                                                        width: `${fillWidth}%`
                                                    }
                                                ]}
                                            />
                                            {/* Inactive Track with Gap */}
                                            <View
                                                style={[
                                                    styles.progressInactive,
                                                    {
                                                        left: `${inactiveLeft}%`,
                                                        right: 0
                                                    }
                                                ]}
                                            />
                                            {/* Expressive Thumb (Vertical Handle) */}
                                            <View
                                                style={[
                                                    styles.progressThumb,
                                                    {
                                                        left: `${percent}%`,
                                                        backgroundColor: '#fff'
                                                    }
                                                ]}
                                            />
                                        </View>
                                    );
                                })()}
                            </View>

                            {/* Control Pills Row */}
                            <View style={styles.controlsRow}>
                                {/* Time Pill - Simple View */}
                                <View style={styles.timePill}>
                                    <Text style={styles.timeText}>
                                        {formatTime(progress.position)}
                                    </Text>
                                    <Text style={[styles.timeText, { opacity: 0.5, marginHorizontal: 4 }]}>
                                        /
                                    </Text>
                                    <Text style={styles.timeText}>
                                        {formatTime(stableDuration || progress.duration)}
                                    </Text>
                                </View>

                                {/* Actions Pill - Simple View */}
                                <View style={styles.actionsPill}>
                                    {[
                                        { icon: Headphones, key: 'audio' },
                                        { icon: Languages, key: 'subtitles' },
                                        { icon: Layers, key: 'streams' },
                                        { icon: Settings, key: 'settings' },
                                        { icon: Info, key: 'info' }
                                    ].map((item, i) => (
                                        <Pressable
                                            key={i}
                                            style={styles.actionIconBtn}
                                            onPress={() => {
                                                setActiveTab(item.key as ActiveTab);
                                                // resetControlsTimer handled by effect
                                            }}
                                        >
                                            <item.icon color="#fff" size={20} />
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        </View>
                    </Animated.View>
                )}
            </Pressable>

            {/* Side Sheet */}
            <SideSheet
                isVisible={activeTab !== 'none'}
                onClose={() => setActiveTab('none')}
                title={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            >
                <View style={{ flex: 1 }}>
                    {activeTab === 'audio' && (
                        <AudioTab
                            tracks={audioTracks}
                            selectedTrackId={selectedAudioId}
                            onSelectTrack={(track) => {
                                videoRef.current?.setAudioTrack?.(Number(track.id));
                                setSelectedAudioId(track.id);
                                setActiveTab('none');
                            }}
                        />
                    )}
                    {activeTab === 'subtitles' && (
                        <SubtitlesTab
                            tracks={subtitleTracks}
                            selectedTrackId={selectedSubtitleId}
                            onSelectTrack={(track) => {
                                videoRef.current?.setSubtitleTrack?.(Number(track?.id ?? -1));
                                setSelectedSubtitleId(track?.id ?? null);
                                setActiveTab('none');
                            }}
                        />
                    )}
                    {activeTab === 'settings' && (
                        <SettingsTab
                            playbackSpeed={1.0}
                            onSelectSpeed={(speed) => {
                                console.log("Speed selected", speed);
                                // Wiring speed needs VideoSurface update or ref method, leaving for now
                                setActiveTab('none');
                            }}
                        />
                    )}
                    {activeTab === 'streams' && (
                        <StreamsTab
                            streams={availableStreams}
                            currentStreamUrl={(activeStream?.url || url) as string}
                            onSelectStream={(stream) => {
                                console.log("Switching to stream:", stream);
                                // Save current position
                                setResumePosition(progress.position);

                                // Update headers
                                if (stream.behaviorHints?.headers) {
                                    setHeaders(stream.behaviorHints.headers);
                                } else {
                                    setHeaders(undefined);
                                }

                                // Update Active Stream (triggers resolve effect)
                                setActiveStream({
                                    url: stream.url,
                                    infoHash: stream.infoHash,
                                    fileIdx: stream.fileIdx
                                });

                                setActiveTab('none');
                            }}
                        />
                    )}
                    {activeTab === 'info' && (
                        <EpisodesTab
                            episodes={[]}
                            onSelectEpisode={() => setActiveTab('none')}
                        />
                    )}
                </View>
            </SideSheet>
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'space-between',
        paddingVertical: 24,
        paddingHorizontal: Platform.OS === 'ios' ? 48 : 32, // Accommodate safe area/notches
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    titlesContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    mainTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    subTitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        marginTop: 2,
    },
    centerArea: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    seekFeedbackLeft: {
        position: 'absolute',
        left: '15%',
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,0,0,0.4)',
        gap: 4,
    },
    seekFeedbackRight: {
        position: 'absolute',
        right: '15%',
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,0,0,0.4)',
        gap: 4,
    },
    seekFeedbackText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    centerPlayBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerPlayPressable: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomArea: {
        gap: 8, // Reduced gap as requested
    },
    progressContainer: {
        height: 44,
        justifyContent: 'center',
        // No negative margins - keep within the overlay padding
    },
    progressBackground: {
        height: 10, // Thicker expressive track
        borderRadius: 5,
        position: 'relative',
        width: '100%',
    },
    progressFill: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        borderTopLeftRadius: 5,
        borderBottomLeftRadius: 5,
        borderTopRightRadius: 2, // Less rounded next to handle
        borderBottomRightRadius: 2, // Less rounded next to handle
    },
    progressInactive: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderTopLeftRadius: 2, // Less rounded next to handle
        borderBottomLeftRadius: 2, // Less rounded next to handle
        borderTopRightRadius: 5,
        borderBottomRightRadius: 5,
    },
    progressThumb: {
        position: 'absolute',
        top: -8, // Center 26px handle on 10px track
        height: 26,
        width: 4,
        borderRadius: 2,
        marginLeft: -2,
        zIndex: 2,
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    timePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    timeText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    actionsPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    actionIconBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 2,
    },
});
