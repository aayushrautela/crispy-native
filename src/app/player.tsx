import { CrispyVideoView } from '@/modules/crispy-native-core';
import { useTheme } from '@/src/core/ThemeContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ChevronLeft, Pause, Play, RotateCcw, RotateCw, Settings } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
const SafeOrientation = ScreenOrientation || {};

export default function PlayerScreen() {
    const { url, title } = useLocalSearchParams();
    const { theme } = useTheme();
    const router = useRouter();

    const [paused, setPaused] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [progress, setProgress] = useState({ position: 0, duration: 0 });
    const controlsTimer = useRef<NodeJS.Timeout | null>(null);

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

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <View style={[styles.container, { backgroundColor: '#000' }]}>
            <CrispyVideoView
                style={styles.video}
                source={url as string}
                paused={paused}
                onProgress={(e) => setProgress(e.nativeEvent)}
            />

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
                            <Pressable onPress={() => { }} style={styles.sideBtn}>
                                <RotateCcw color="#fff" size={32} />
                            </Pressable>
                            <Pressable onPress={togglePlay} style={styles.playBtn}>
                                {paused ? <Play color="#fff" size={48} fill="#fff" /> : <Pause color="#fff" size={48} fill="#fff" />}
                            </Pressable>
                            <Pressable onPress={() => { }} style={styles.sideBtn}>
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
                                                    width: `${(progress.position / (progress.duration || 1)) * 100}%`
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
    video: {
        flex: 1,
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
