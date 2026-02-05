import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, Text, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ArrowLeft, Play, Pause, StepBack, StepForward, Headphones, Languages, Layers, Settings, Info } from 'lucide-react-native';
import { useTheme } from '@/src/core/ThemeContext';
import { Typography } from '@/src/core/ui/Typography';
import CrispyNativeCore from '@/modules/crispy-native-core';

interface PlayerControlsProps {
    visible: boolean;
    paused: boolean;
    derivedTitle: string;
    episodeTitle?: string;
    lastError?: string | null;
    progress: { position: number; duration: number };
    stableDuration: number;
    isSeeking: boolean;
    setIsSeeking: (seeking: boolean) => void;
    setProgress: (progress: any) => void;
    resetControlsTimer: () => void;
    togglePlay: () => void;
    onClose: () => void;
    onTabOpen: (tab: string) => void;
    seekAccumulation: { amount: number; direction: 'forward' | 'backward' | null };
    playPauseAnimatedStyle: any;
    feedbackAnimatedStyle: any;
    formatTime: (seconds: number) => string;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
    visible,
    paused,
    derivedTitle,
    episodeTitle,
    lastError,
    progress,
    stableDuration,
    isSeeking,
    setIsSeeking,
    setProgress,
    resetControlsTimer,
    togglePlay,
    onClose,
    onTabOpen,
    seekAccumulation,
    playPauseAnimatedStyle,
    feedbackAnimatedStyle,
    formatTime,
}) => {
    const { theme } = useTheme();
    const { width } = useWindowDimensions();

    const duration = useMemo(() => stableDuration || progress.duration || 1, [stableDuration, progress.duration]);

    if (!visible) return null;

    return (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.overlay}>
            {/* Top Bar */}
            <View style={styles.topBar}>
                <Pressable onPress={onClose} style={styles.backBtn}>
                    <ArrowLeft color="#fff" size={24} />
                </Pressable>
                <View style={styles.titlesContainer}>
                    <Text style={styles.mainTitle} numberOfLines={1}>
                        {derivedTitle}
                    </Text>
                    {!!episodeTitle && (
                        <Text style={styles.subTitle} numberOfLines={1}>
                            {episodeTitle}
                        </Text>
                    )}
                    {!!lastError && (
                        <Text style={[styles.subTitle, { color: 'rgba(255,120,120,0.95)' }]} numberOfLines={2}>
                            {lastError}
                        </Text>
                    )}
                </View>
            </View>

            {/* Center Area */}
            <View style={styles.centerArea} pointerEvents="box-none">
                {seekAccumulation.direction === 'backward' && (
                    <Animated.View style={[styles.seekFeedbackLeft, feedbackAnimatedStyle]}>
                        <StepBack color="#fff" size={24} />
                        <Text style={styles.seekFeedbackText}>{seekAccumulation.amount}s</Text>
                    </Animated.View>
                )}

                {seekAccumulation.direction === 'forward' && (
                    <Animated.View style={[styles.seekFeedbackRight, feedbackAnimatedStyle]}>
                        <StepForward color="#fff" size={24} />
                        <Text style={styles.seekFeedbackText}>{seekAccumulation.amount}s</Text>
                    </Animated.View>
                )}

                <Animated.View style={[styles.centerPlayBtn, playPauseAnimatedStyle]}>
                    <Pressable onPress={togglePlay} style={styles.centerPlayPressable}>
                        {paused ? <Play color="#fff" size={32} fill="#fff" style={{ marginLeft: 3 }} /> : <Pause color="#fff" size={32} fill="#fff" />}
                    </Pressable>
                </Animated.View>
            </View>

            {/* Bottom Controls */}
            <View style={styles.bottomArea}>
                <View
                    style={styles.progressContainer}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={(e) => {
                        setIsSeeking(true);
                        const { pageX } = e.nativeEvent;
                        const percentage = Math.max(0, Math.min(1, pageX / width));
                        const targetPos = duration * percentage;
                        void CrispyNativeCore.nativePlayerSeek(targetPos);
                        resetControlsTimer();
                        setProgress((p: any) => ({ ...p, position: targetPos }));
                    }}
                    onResponderMove={(e) => {
                        const { pageX } = e.nativeEvent;
                        const percentage = Math.max(0, Math.min(1, pageX / width));
                        const targetPos = duration * percentage;
                        void CrispyNativeCore.nativePlayerSeek(targetPos);
                        resetControlsTimer();
                        setProgress((p: any) => ({ ...p, position: targetPos }));
                    }}
                    onResponderRelease={() => {
                        setTimeout(() => setIsSeeking(false), 500);
                    }}
                >
                    {(() => {
                        const percent = Math.max(0, Math.min(100, (progress.position / duration) * 100));
                        const fillWidth = Math.max(0, percent - 0.8);
                        const inactiveLeft = Math.min(100, percent + 0.8);

                        return (
                            <View style={styles.progressBackground}>
                                <View style={[styles.progressFill, { backgroundColor: theme.colors.primary, width: `${fillWidth}%` }]} />
                                <View style={[styles.progressInactive, { left: `${inactiveLeft}%`, right: 0 }]} />
                                <View style={[styles.progressThumb, { left: `${percent}%`, backgroundColor: '#fff' }]} />
                            </View>
                        );
                    })()}
                </View>

                <View style={styles.controlsRow}>
                    <View style={styles.timePill}>
                        <Text style={styles.timeText}>{formatTime(progress.position)}</Text>
                        <Text style={[styles.timeText, { opacity: 0.5, marginHorizontal: 4 }]}>/</Text>
                        <Text style={styles.timeText}>{formatTime(duration)}</Text>
                    </View>

                    <View style={styles.actionsPill}>
                        {[
                            { icon: Headphones, key: 'audio' },
                            { icon: Languages, key: 'subtitles' },
                            { icon: Layers, key: 'streams' },
                            { icon: Settings, key: 'settings' },
                            { icon: Info, key: 'info' },
                        ].map((item, i) => (
                            <Pressable
                                key={i}
                                style={styles.actionIconBtn}
                                onPress={() => onTabOpen(item.key)}
                            >
                                <item.icon color="#fff" size={20} />
                            </Pressable>
                        ))}
                    </View>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'space-between',
    },
    topBar: {
        flexDirection: 'row',
        paddingTop: 40,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    titlesContainer: {
        marginLeft: 16,
        flex: 1,
    },
    mainTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    subTitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
    },
    centerArea: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerPlayBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerPlayPressable: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    seekFeedbackLeft: {
        position: 'absolute',
        left: '15%',
        alignItems: 'center',
    },
    seekFeedbackRight: {
        position: 'absolute',
        right: '15%',
        alignItems: 'center',
    },
    seekFeedbackText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        marginTop: 4,
    },
    bottomArea: {
        paddingBottom: 40,
    },
    progressContainer: {
        height: 40,
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    progressBackground: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    progressInactive: {
        height: '100%',
        backgroundColor: 'transparent',
    },
    progressThumb: {
        width: 12,
        height: 12,
        borderRadius: 6,
        position: 'absolute',
        marginLeft: -6,
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 8,
    },
    timePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    timeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    actionsPill: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
        paddingHorizontal: 4,
    },
    actionIconBtn: {
        padding: 10,
    },
});
