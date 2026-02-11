import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    isLoading?: boolean;
}

const PROGRESS_TRACK_HEIGHT = 8;
const PROGRESS_TRACK_GAP_PX = 4;
const PROGRESS_TRACK_OUTER_RADIUS = PROGRESS_TRACK_HEIGHT / 2;
const PROGRESS_TRACK_INNER_RADIUS = 1;
const PROGRESS_THUMB_HEIGHT = 34;
const PROGRESS_THUMB_WIDTH = 6;
const PROGRESS_THUMB_TOP = -((PROGRESS_THUMB_HEIGHT - PROGRESS_TRACK_HEIGHT) / 2);

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
    isLoading = false,
}) => {
    const { theme } = useTheme();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const duration = useMemo(() => {
        const next = stableDuration > 0 ? stableDuration : progress.duration;
        if (!Number.isFinite(next) || next <= 0) return 0;
        return next;
    }, [stableDuration, progress.duration]);
    const seekableDuration = duration > 0 ? duration : 1;

    if (!visible) return null;

    return (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.overlay}>
            {/* Top Bar */}
            <View style={[styles.topBar, { 
                paddingLeft: Math.max(20, insets.left), 
                paddingRight: Math.max(20, insets.right),
                paddingTop: Math.max(20, insets.top)
            }]}>
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

                {!isLoading && (
                    <Animated.View style={[styles.centerPlayBtn, playPauseAnimatedStyle]}>
                        <Pressable onPress={togglePlay} style={styles.centerPlayPressable}>
                            {paused ? <Play color="#fff" size={32} fill="#fff" style={{ marginLeft: 3 }} /> : <Pause color="#fff" size={32} fill="#fff" />}
                        </Pressable>
                    </Animated.View>
                )}
            </View>

            {/* Bottom Controls */}
            <View style={[styles.bottomArea, { paddingBottom: Math.max(20, insets.bottom) }]}>
                <View
                    style={[styles.progressContainer, { 
                        paddingLeft: Math.max(20, insets.left), 
                        paddingRight: Math.max(20, insets.right) 
                    }]}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={(e) => {
                        setIsSeeking(true);
                        const { pageX } = e.nativeEvent;
                        const paddingL = Math.max(20, insets.left);
                        const paddingR = Math.max(20, insets.right);
                        const barWidth = width - paddingL - paddingR;
                        const percentage = Math.max(0, Math.min(1, (pageX - paddingL) / barWidth));
                        const targetPos = seekableDuration * percentage;
                        void CrispyNativeCore.nativePlayerSeek(targetPos);
                        resetControlsTimer();
                        setProgress((p: any) => ({ ...p, position: targetPos }));
                    }}
                    onResponderMove={(e) => {
                        const { pageX } = e.nativeEvent;
                        const paddingL = Math.max(20, insets.left);
                        const paddingR = Math.max(20, insets.right);
                        const barWidth = width - paddingL - paddingR;
                        const percentage = Math.max(0, Math.min(1, (pageX - paddingL) / barWidth));
                        const targetPos = seekableDuration * percentage;
                        void CrispyNativeCore.nativePlayerSeek(targetPos);
                        resetControlsTimer();
                        setProgress((p: any) => ({ ...p, position: targetPos }));
                    }}
                    onResponderRelease={() => {
                        setTimeout(() => setIsSeeking(false), 500);
                    }}
                >
                    {(() => {
                        const paddingL = Math.max(20, insets.left);
                        const paddingR = Math.max(20, insets.right);
                        const trackW = Math.max(1, width - paddingL - paddingR);
                        const safePos = Math.max(0, Math.min(seekableDuration, progress.position));
                        const thumbX = (safePos / seekableDuration) * trackW;
                        const halfThumb = PROGRESS_THUMB_WIDTH / 2;

                        const fillW = Math.max(0, thumbX - halfThumb - PROGRESS_TRACK_GAP_PX);
                        const inactiveX = Math.min(trackW, thumbX + halfThumb + PROGRESS_TRACK_GAP_PX);

                        const hasFill = fillW > 0.5;
                        const hasInactive = inactiveX < trackW - 0.5;

                        const fillRightRadius = hasInactive ? PROGRESS_TRACK_INNER_RADIUS : PROGRESS_TRACK_OUTER_RADIUS;
                        const inactiveLeftRadius = hasFill ? PROGRESS_TRACK_INNER_RADIUS : PROGRESS_TRACK_OUTER_RADIUS;

                        return (
                            <View style={styles.progressBackground}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            backgroundColor: theme.colors.primary,
                                            width: fillW,
                                            borderTopRightRadius: fillRightRadius,
                                            borderBottomRightRadius: fillRightRadius,
                                        },
                                    ]}
                                />
                                <View
                                    style={[
                                        styles.progressInactive,
                                        {
                                            left: inactiveX,
                                            right: 0,
                                            borderTopLeftRadius: inactiveLeftRadius,
                                            borderBottomLeftRadius: inactiveLeftRadius,
                                        },
                                    ]}
                                />
                                <View style={[styles.progressThumb, { left: thumbX, backgroundColor: theme.colors.primary }]} />
                            </View>
                        );
                    })()}
                </View>

                <View style={[styles.controlsRow, { 
                    paddingLeft: Math.max(20, insets.left), 
                    paddingRight: Math.max(20, insets.right) 
                }]}>
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
        height: 48,
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    progressBackground: {
        height: PROGRESS_TRACK_HEIGHT,
        borderRadius: PROGRESS_TRACK_OUTER_RADIUS,
        position: 'relative',
        width: '100%',
        overflow: 'visible',
    },
    progressFill: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        borderTopLeftRadius: PROGRESS_TRACK_OUTER_RADIUS,
        borderBottomLeftRadius: PROGRESS_TRACK_OUTER_RADIUS,
        borderTopRightRadius: PROGRESS_TRACK_INNER_RADIUS,
        borderBottomRightRadius: PROGRESS_TRACK_INNER_RADIUS,
    },
    progressInactive: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderTopLeftRadius: PROGRESS_TRACK_INNER_RADIUS,
        borderBottomLeftRadius: PROGRESS_TRACK_INNER_RADIUS,
        borderTopRightRadius: PROGRESS_TRACK_OUTER_RADIUS,
        borderBottomRightRadius: PROGRESS_TRACK_OUTER_RADIUS,
    },
    progressThumb: {
        position: 'absolute',
        top: PROGRESS_THUMB_TOP,
        height: PROGRESS_THUMB_HEIGHT,
        width: PROGRESS_THUMB_WIDTH,
        borderRadius: PROGRESS_THUMB_WIDTH / 2,
        marginLeft: -(PROGRESS_THUMB_WIDTH / 2),
        zIndex: 2,
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
