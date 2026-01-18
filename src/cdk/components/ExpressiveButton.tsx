import React, { useState, useMemo } from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, View } from 'react-native';
import { useTheme } from '@/src/core/ThemeContext';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface ExpressiveButtonProps {
    onPress: () => void;
    title: string;
    variant?: 'primary' | 'secondary' | 'tonal' | 'outline' | 'text';
    size?: 'sm' | 'md' | 'lg';
    style?: ViewStyle;
    textStyle?: TextStyle;
    icon?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const ExpressiveButton = ({
    onPress,
    title,
    variant = 'primary',
    size = 'md',
    style,
    textStyle,
    icon,
}: ExpressiveButtonProps) => {
    const { theme } = useTheme();
    const [focused, setFocused] = useState(false);

    // M3 Expressive Rounding
    const getRounding = () => {
        switch (size) {
            case 'sm': return 12; // rounded-m3-md
            case 'md': return 28; // rounded-m3-xl
            case 'lg': return 36; // rounded-m3-3xl
            default: return 28;
        }
    };

    const colors = useMemo(() => {
        switch (variant) {
            case 'primary':
                return {
                    bg: theme.colors.primary,
                    text: theme.colors.onPrimary,
                };
            case 'secondary':
                return {
                    bg: theme.colors.secondary,
                    text: theme.colors.onSecondary,
                };
            case 'tonal':
                return {
                    bg: theme.colors.secondaryContainer,
                    text: theme.colors.onSecondaryContainer,
                };
            case 'outline':
                return {
                    bg: 'transparent',
                    text: theme.colors.primary,
                    border: theme.colors.outline,
                };
            case 'text':
                return {
                    bg: 'transparent',
                    text: theme.colors.primary,
                };
            default:
                return {
                    bg: theme.colors.primary,
                    text: theme.colors.onPrimary,
                };
        }
    }, [variant, theme]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: withSpring(focused ? 1.05 : 1) }],
            borderWidth: variant === 'outline' || focused ? 2 : 0,
            borderColor: focused ? theme.colors.primary : colors.border || 'transparent',
            elevation: withSpring(focused ? 4 : 0),
        };
    });

    return (
        <AnimatedPressable
            onPress={onPress}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[
                styles.base,
                {
                    backgroundColor: colors.bg,
                    borderRadius: getRounding(),
                    paddingVertical: size === 'sm' ? 8 : size === 'md' ? 12 : 16,
                    paddingHorizontal: size === 'sm' ? 16 : size === 'md' ? 24 : 32,
                },
                animatedStyle,
                style,
            ]}
        >
            <View style={styles.content}>
                {icon && <View style={styles.iconContainer}>{icon}</View>}
                <Text
                    style={[
                        styles.text,
                        { color: colors.text, fontSize: size === 'sm' ? 14 : size === 'md' ? 16 : 18 },
                        textStyle,
                    ]}
                >
                    {title}
                </Text>
            </View>
        </AnimatedPressable>
    );
};

const styles = StyleSheet.create({
    base: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        marginRight: 8,
    },
    text: {
        fontWeight: '600',
        textAlign: 'center',
    },
});
