import React from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { StepForward } from 'lucide-react-native';
import { useTheme } from '@/src/core/ThemeContext';
import { Typography } from '@/src/core/ui/Typography';
import CrispyNativeCore from '@/modules/crispy-native-core';

interface PlayerSkipIntroProps {
    visible: boolean;
    introEnd: number;
    setProgress: (fn: (p: any) => any) => void;
    resetControlsTimer: () => void;
}

export const PlayerSkipIntro: React.FC<PlayerSkipIntroProps> = ({
    visible,
    introEnd,
    setProgress,
    resetControlsTimer,
}) => {
    const { theme } = useTheme();

    if (!visible) return null;

    return (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.skipIntroContainer}>
            <Pressable
                style={[styles.skipIntroBtn, { backgroundColor: theme.colors.primary, borderColor: theme.colors.outline }]}
                onPress={() => {
                    void CrispyNativeCore.nativePlayerSeek(introEnd);
                    setProgress((p: any) => ({ ...p, position: introEnd }));
                    resetControlsTimer();
                }}
            >
                <StepForward size={20} color={theme.colors.onPrimary} style={{ marginRight: 8 }} />
                <Typography variant="label" style={{ color: theme.colors.onPrimary }}>
                    SKIP INTRO
                </Typography>
            </Pressable>
        </Animated.View>
    );
};

interface PlayerUpNextProps {
    visible: boolean;
    poster?: string;
    derivedTitle: string;
    onPlayNext: () => void;
    onCancel: () => void;
}

export const PlayerUpNext: React.FC<PlayerUpNextProps> = ({
    visible,
    poster,
    derivedTitle,
    onPlayNext,
    onCancel,
}) => {
    const { theme } = useTheme();

    if (!visible) return null;

    return (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.upNextContainer}>
            <View style={[styles.upNextCard, { backgroundColor: 'rgba(30,30,30,0.95)' }]}> 
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    {!!poster && <Image source={{ uri: poster }} style={styles.upNextPoster} />}
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Typography variant="label-small" style={{ color: theme.colors.primary }}>
                            UP NEXT
                        </Typography>
                        <Typography variant="title-medium" style={{ color: 'white' }} numberOfLines={1}>
                            {derivedTitle}
                        </Typography>
                        <Typography variant="body-small" style={{ color: 'rgba(255,255,255,0.7)' }} numberOfLines={1}>
                            Next Episode
                        </Typography>
                    </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <Pressable
                        style={[styles.upNextActionBtn, { backgroundColor: theme.colors.primary, flex: 2 }]}
                        onPress={onPlayNext}
                    >
                        <Typography variant="label" style={{ color: theme.colors.onPrimary }}>
                            PLAY NEXT
                        </Typography>
                    </Pressable>
                    <Pressable style={[styles.upNextActionBtn, { backgroundColor: 'rgba(255,255,255,0.1)', flex: 1 }]} onPress={onCancel}>
                        <Typography variant="label" style={{ color: 'white' }}>
                            CANCEL
                        </Typography>
                    </Pressable>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    skipIntroContainer: {
        position: 'absolute',
        bottom: 120,
        right: 40,
        zIndex: 5,
    },
    skipIntroBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    upNextContainer: {
        position: 'absolute',
        bottom: 120,
        right: 40,
        width: 300,
        zIndex: 5,
    },
    upNextCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    upNextPoster: {
        width: 50,
        height: 75,
        borderRadius: 4,
    },
    upNextActionBtn: {
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
});
