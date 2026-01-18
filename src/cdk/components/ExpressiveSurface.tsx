import React, { useState } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/src/core/ThemeContext';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface ExpressiveSurfaceProps {
    children: React.ReactNode;
    onPress?: () => void;
    style?: ViewStyle;
    variant?: 'elevated' | 'filled' | 'outlined';
    rounding?: 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const ExpressiveSurface = ({
    children,
    onPress,
    style,
    variant = 'filled',
    rounding = 'xl',
}: ExpressiveSurfaceProps) => {
    const { theme } = useTheme();
    const [focused, setFocused] = useState(false);

    const getRounding = () => {
        switch (rounding) {
            case 'md': return 12;
            case 'lg': return 16;
            case 'xl': return 28;
            case '2xl': return 32;
            case '3xl': return 36;
            default: return 28;
        }
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: withSpring(focused ? 1.02 : 1) }],
            borderWidth: variant === 'outlined' || focused ? 1 : 0,
            borderColor: focused ? theme.colors.primary : theme.colors.outlineVariant,
            elevation: withSpring(focused ? 6 : variant === 'elevated' ? 1 : 0),
        };
    });

    const backgroundColor = variant === 'elevated'
        ? theme.colors.elevated
        : variant === 'filled'
            ? theme.colors.surfaceVariant
            : 'transparent';

    return (
        <AnimatedPressable
            onPress={onPress}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
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
