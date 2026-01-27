import { useResponsive } from '@/src/core/hooks/useResponsive';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface SplitHeroLayoutProps {
    leftNode: React.ReactNode;
    rightNode: React.ReactNode;
    backgroundColor: string; // Dynamic surface color from palette
    style?: ViewStyle;
}

export const SplitHeroLayout = memo(({ leftNode, rightNode, backgroundColor, style }: SplitHeroLayoutProps) => {
    const { width } = useResponsive();

    // Ensure we have a hex with 00 alpha for the transparent start
    // If it's a hex like #123456, we can just append 00
    const transparentBg = backgroundColor.startsWith('#') ? backgroundColor.substring(0, 7) + '00' : 'transparent';

    return (
        <View style={[styles.container, { width }, style]}>
            {/* Left Slot (Visuals) - 60% */}
            <View style={styles.leftPane}>
                {leftNode}

                {/* Right Edge Hue-Locked Masking */}
                <LinearGradient
                    colors={[transparentBg, backgroundColor]}
                    locations={[0, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.horizontalFade}
                    pointerEvents="none"
                />

                {/* Bottom Edge Hue-Locked Masking */}
                <LinearGradient
                    colors={[transparentBg, backgroundColor]}
                    locations={[0, 1]}
                    style={styles.verticalFade}
                    pointerEvents="none"
                />
            </View>

            {/* Right Slot (Info/Actions) - 40% */}
            <View style={styles.rightPane}>
                <View style={styles.rightContent}>
                    {rightNode}
                </View>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        height: 600, // Matching HERO_HEIGHT
    },
    leftPane: {
        width: '60%',
        height: '100%',
        position: 'relative',
    },
    rightPane: {
        width: '40%',
        height: '100%',
        justifyContent: 'center',
        paddingRight: 40,
        paddingLeft: 20,
    },
    rightContent: {
        width: '100%',
        maxWidth: 500,
        gap: 20,
    },
    horizontalFade: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '40%',
    },
    verticalFade: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '25%',
    }
});
