import { useTheme } from '@/src/core/ThemeContext';
import React, { useState } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface ExpressiveSurfaceProps {
    children: React.ReactNode;
    onPress?: () => void;
    style?: ViewStyle;
    variant?: 'elevated' | 'filled' | 'outlined';
    rounding?: 'md' | 'lg' | 'xl' | '2xl' | '3xl';
    onFocusChange?: (focused: boolean) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const ExpressiveSurface = ({
    children,
    onPress,
    style,
    variant = 'filled',
    rounding = 'xl',
    onFocusChange,
}: ExpressiveSurfaceProps) => {
    const { theme } = useTheme();
    const [focused, setFocused] = useState(false);

    const getRounding = () => {
        switch (rounding) {
            case 'md': return 12; // Extra Small -> Low (Standard)
            case 'lg': return 16; // Small -> Medium
            case 'xl': return 28; // Medium -> Large (Expressive standard)
            case '2xl': return 32; // Large -> Extra Large
            case '3xl': return 36; // Extra Large -> Full
            default: return 28;
        }
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: withSpring(focused ? 1.02 : 1) }],
            borderWidth: variant === 'outlined' ? 1 : (focused ? 2 : 0),
            borderColor: focused ? theme.colors.primary : theme.colors.outlineVariant,
            elevation: withSpring(focused ? 6 : variant === 'elevated' ? 2 : 0),
        };
    });

    const backgroundColor = variant === 'elevated'
        ? theme.colors.surface
        : variant === 'filled'
            ? theme.colors.surfaceContainerHighest || theme.colors.surfaceVariant
            : 'transparent';

    return (
        <AnimatedPressable
            onPress={onPress}
            onFocus={() => {
                setFocused(true);
                onFocusChange?.(true);
            }}
            onBlur={() => {
                setFocused(false);
                onFocusChange?.(false);
            }}
            style={[
                styles.base,
                {
                    backgroundColor,
                    borderRadius: getRounding(),
                },
                animatedStyle,
                style,
            ]}
        >
            {children}
        </AnimatedPressable>
    );
};

const styles = StyleSheet.create({
    base: {
        overflow: 'hidden',
    },
});
