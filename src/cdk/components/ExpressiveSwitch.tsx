import { useTheme } from '@/src/core/ThemeContext';
import { Check } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

interface ExpressiveSwitchProps {
    value: boolean;
    onValueChange: (value: boolean) => void;
    trackColor?: { false: string; true: string };
    thumbColor?: { false: string; true: string };
}

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const THUMB_SIZE = 24;
const PADDING = 4;

export function ExpressiveSwitch({
    value,
    onValueChange,
    trackColor,
    thumbColor
}: ExpressiveSwitchProps) {
    const { theme } = useTheme();
    const progress = useSharedValue(value ? 1 : 0);
    const pressProgress = useSharedValue(0);

    useEffect(() => {
        progress.value = withSpring(value ? 1 : 0, {
            mass: 0.8,
            damping: 15,
            stiffness: 150,
        });
    }, [value]);

    const activeTrackColor = trackColor?.true ?? theme.colors.primary;
    const inactiveTrackColor = trackColor?.false ?? theme.colors.surfaceContainerHighest;
    const activeThumbColor = thumbColor?.true ?? theme.colors.onPrimary;
    const inactiveThumbColor = thumbColor?.false ?? theme.colors.outline;
    const outlineColor = theme.colors.outline;

    const rTrackStyle = useAnimatedStyle(() => {
        // Subtle scale on press
        const scale = interpolate(pressProgress.value, [0, 1], [1, 1.05]);
        const borderW = interpolate(progress.value, [0, 1], [2, 0]);

        return {
            transform: [{ scale }],
            borderWidth: borderW,
        };
    });

    // Compute interpolated colors as regular styles (not animated)
    // This avoids accessing theme colors inside worklets
    const trackBgStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            progress.value,
            [0, 1],
            [inactiveTrackColor, activeTrackColor]
        ),
        borderColor: interpolateColor(
            progress.value,
            [0, 1],
            [outlineColor, activeTrackColor]
        ),
    }));

    const rThumbStyle = useAnimatedStyle(() => {
        const translateX = interpolate(
            progress.value,
            [0, 1],
            [4, 20]
        );

        const size = interpolate(progress.value, [0, 1], [16, 24]);

        return {
            transform: [{ translateX }],
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: interpolateColor(
                progress.value,
                [0, 1],
                [inactiveThumbColor, activeThumbColor]
            ),
        };
    });

    const rIconStyle = useAnimatedStyle(() => {
        return {
            opacity: progress.value,
            transform: [{ scale: progress.value }]
        };
    });

    return (
        <Pressable
            onPress={() => onValueChange(!value)}
            onPressIn={() => (pressProgress.value = withSpring(1))}
            onPressOut={() => (pressProgress.value = withSpring(0))}
            style={{ width: TRACK_WIDTH, height: TRACK_HEIGHT, justifyContent: 'center' }}
        >
            <Animated.View style={[styles.track, rTrackStyle, trackBgStyle]}>
                <Animated.View style={[styles.thumbContainer]}>
                    <Animated.View style={[styles.thumb, rThumbStyle]}>
                        <Animated.View style={[styles.iconContainer, rIconStyle]}>
                            <Check size={14} color={activeTrackColor} strokeWidth={4} />
                        </Animated.View>
                    </Animated.View>
                </Animated.View>
            </Animated.View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    track: {
        width: TRACK_WIDTH,
        height: TRACK_HEIGHT,
        borderRadius: TRACK_HEIGHT / 2,
        justifyContent: 'center',
        padding: PADDING,
    },
    thumbContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
    },
    thumb: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    }
});
