import React from 'react';
import { View, Platform, StyleSheet, ViewProps } from 'react-native';
import { BlurView, BlurViewProps } from 'expo-blur';
import { cssInterop } from 'nativewind';

// Interop for NativeWind support on BlurView
cssInterop(BlurView, {
    className: {
        target: 'style',
    },
});

interface SurfaceProps extends ViewProps {
    intensity?: number;
    tint?: BlurViewProps['tint'];
    variant?: 'glass' | 'solid' | 'flat';
}

/**
 * Surface component that adaptive to platform aesthetics.
 * iOS: Liquid Glass (Blur)
 * Android: Material You (Solid/Surface)
 */
export const Surface = ({
    children,
    className,
    intensity = 50,
    tint = 'dark',
    variant = 'glass',
    style,
    ...props
}: SurfaceProps) => {
    if (Platform.OS === 'ios' && variant === 'glass') {
        return (
            <BlurView
                intensity={intensity}
                tint={tint}
                className={className}
                style={style}
                {...props}
            >
                {children}
            </BlurView>
        );
    }

    // Fallback for Android or non-glass variants
    // On Android, we will later bind this to Material You colors
    return (
        <View
            className={className}
            style={style}
            {...props}
        >
            {children}
        </View>
    );
};
