import { useTheme } from '@/src/core/ThemeContext';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming
} from 'react-native-reanimated';

interface ExpressiveSurfaceProps {
    children: React.ReactNode;
    onPress?: () => void;
    onLongPress?: () => void;
    style?: ViewStyle;
    variant?: 'elevated' | 'filled' | 'outlined' | 'tonal';
    rounding?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full' | 'none';
    onFocusChange?: (focused: boolean) => void;
    pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
    selected?: boolean;
    index?: number;
    activeIndex?: number;
    disablePulse?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const ExpressiveSurface = ({
    children,
    onPress,
    onLongPress,
    style,
    variant = 'filled',
    rounding = 'xl',
    onFocusChange,
    pointerEvents,
    selected = false,
    index,
    activeIndex,
    disablePulse = false,
}: ExpressiveSurfaceProps) => {
    const { theme } = useTheme();
    const [focused, setFocused] = useState(false);

    // PixelPlayer style shared values
    const scale = useSharedValue(1);
    const offsetX = useSharedValue(0);

    const getRounding = () => {
        if (rounding === 'full') return 999;
        if (rounding === 'none') return 0;
        switch (rounding) {
            case 'md': return 12;
            case 'lg': return 16;
            case 'xl': return 28;
            case '2xl': return 32;
            case '3xl': return 36;
            default: return 28;
        }
    };

    // Selection Pulse Effect (1:1 PixelPlayer logic)
    useEffect(() => {
        if (selected && !disablePulse) {
            // PixelPlayer uses 250ms intervals
            scale.value = withSequence(
                withTiming(1.15, { duration: 250 }),
                withTiming(1, { duration: 250 })
            );
        }
    }, [selected, disablePulse]);

    // Neighbor Squeeze Effect (1:1 PixelPlayer logic)
    useEffect(() => {
        if (index !== undefined && activeIndex !== undefined && !selected && !disablePulse) {
            const distance = index - activeIndex;
            if (Math.abs(distance) === 1) { // Direct neighbor
                const direction = distance > 0 ? 1 : -1;
                // User says movement is too much, reducing from 12 to 8 for tighter feel
                // while maintaining the direction logic
                const offsetValue = 8 * direction;
                offsetX.value = withSequence(
                    withTiming(offsetValue, { duration: 250 }),
                    withTiming(0, { duration: 250 })
                );
            }
        }
    }, [activeIndex, index, selected, disablePulse]);

    const handlePress = () => {
        Haptics.selectionAsync();
        onPress?.();
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                // PixelPlayer ONLY changes horizontal stuff (scaleX)
                { scaleX: scale.value },
                { translateX: offsetX.value },
                { scale: withTiming(focused ? 1.02 : 1, { duration: 200 }) }
            ],
            borderWidth: variant === 'outlined' ? 1.5 : 0,
            borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
            elevation: withTiming(focused || selected ? 4 : variant === 'elevated' ? 2 : 0, { duration: 200 }),
        };
    });

    const getBackgroundColor = () => {
        if (selected) return theme.colors.primary;

        switch (variant) {
            case 'elevated': return theme.colors.surface;
            case 'tonal': return theme.colors.secondaryContainer;
            case 'filled': return theme.colors.primaryContainer;
            case 'outlined': return 'transparent';
            default: return theme.colors.surfaceContainerHighest || theme.colors.surfaceVariant;
        }
    };

    return (
        <AnimatedPressable
            onPress={handlePress}
            onLongPress={onLongPress}
            pointerEvents={pointerEvents}
            onFocus={() => {
                setFocused(true);
                onFocusChange?.(true);
            }}
            onBlur={() => {
                setFocused(false);
                onFocusChange?.(false);
            }}
            layout={LinearTransition.duration(300)}
            style={[
                styles.base,
                {
                    backgroundColor: getBackgroundColor(),
                    borderRadius: getRounding(),
                },
                animatedStyle,
                style,
            ]}
        >
            <View style={styles.contentContainer}>
                {children}
            </View>
        </AnimatedPressable>
    );
};

const styles = StyleSheet.create({
    base: {
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 0,
        paddingVertical: 0,
    },
    contentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    }
});
