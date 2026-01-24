import { useTheme } from '@/src/core/ThemeContext';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LoadingIndicator } from './LoadingIndicator';

interface ExpressiveButtonProps {
    onPress: () => void;
    title: string;
    variant?: 'primary' | 'secondary' | 'tonal' | 'outline' | 'text';
    size?: 'sm' | 'md' | 'lg';
    style?: ViewStyle;
    textStyle?: TextStyle;
    icon?: React.ReactNode;
    isLoading?: boolean;
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
    isLoading = false,
}: ExpressiveButtonProps) => {
    const { theme } = useTheme();
    const [focused, setFocused] = useState(false);

    // M3 Expressive Rounding
    const getRounding = () => {
        switch (size) {
            case 'sm': return 12; // rounded-m3-md
            case 'md': return 20; // rounded-m3-lg (Standard MD3 button is fully rounded, but Expressive uses large)
            case 'lg': return 28; // rounded-m3-xl
            default: return 20;
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

    const pressed = useSharedValue(0);
    const focusAnim = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    scale: withSpring(interpolate(pressed.value, [0, 1], [interpolate(focusAnim.value, [0, 1], [1, 1.05]), 0.96]))
                }
            ],
            opacity: withSpring(interpolate(pressed.value, [0, 1], [interpolate(focusAnim.value, [0, 1], [1, 0.9]), 0.8])),
        };
    });

    return (
        <AnimatedPressable
            onPress={isLoading ? undefined : onPress}
            onPressIn={() => !isLoading && (pressed.value = 1)}
            onPressOut={() => (pressed.value = 0)}
            onFocus={() => {
                setFocused(true);
                focusAnim.value = withSpring(1);
            }}
            onBlur={() => {
                setFocused(false);
                focusAnim.value = withSpring(0);
            }}
            disabled={isLoading}
            style={[
                styles.base,
                {
                    backgroundColor: colors.bg,
                    borderRadius: getRounding(),
                    minHeight: size === 'sm' ? 32 : size === 'md' ? 40 : 48,
                    paddingHorizontal: size === 'sm' ? 16 : size === 'md' ? 24 : 32,
                    borderWidth: variant === 'outline' ? 1 : (focused ? 2 : 0),
                    borderColor: focused ? theme.colors.primary : colors.border || 'transparent',
                    elevation: focused ? 4 : 0,
                    opacity: isLoading ? 0.7 : 1,
                },
                animatedStyle,
                style,
            ]}
        >
            <View style={styles.content}>
                {isLoading ? (
                    <LoadingIndicator color={colors.text} size="small" />
                ) : (
                    <>
                        {icon && (
                            <View style={styles.iconContainer}>
                                {React.isValidElement(icon) ? (
                                    icon
                                ) : (
                                    React.createElement(icon as any, {
                                        size: size === 'sm' ? 16 : size === 'md' ? 20 : 24,
                                        color: colors.text
                                    })
                                )}
                            </View>
                        )}
                        <Text
                            style={[
                                styles.text,
                                {
                                    color: colors.text,
                                    fontSize: size === 'sm' ? 12 : size === 'md' ? 14 : 16,
                                    fontWeight: '500' // Label Large/Medium/Small
                                },
                                textStyle,
                            ]}
                        >
                            {title}
                        </Text>
                    </>
                )}
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
