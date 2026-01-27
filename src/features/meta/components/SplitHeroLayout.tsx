
import { useResponsive } from '@/src/core/hooks/useResponsive';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface SplitHeroLayoutProps {
    leftNode: React.ReactNode;
    rightNode: React.ReactNode;
    style?: ViewStyle;
    DARK_BASE: string;
}

export const SplitHeroLayout = memo(({ leftNode, rightNode, style, DARK_BASE }: SplitHeroLayoutProps) => {
    const { width } = useResponsive();

    return (
        <View style={[styles.container, { width }, style]}>
            {/* Left Slot (Visuals) - 60% */}
            <View style={styles.leftPane}>
                {leftNode}

                {/* Right Edge Feathered Gradient */}
                <LinearGradient
                    colors={[DARK_BASE + '00', DARK_BASE]}
                    locations={[0, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.horizontalFade}
                    pointerEvents="none"
                />

                {/* Bottom Edge Feathered Gradient */}
                <LinearGradient
                    colors={[DARK_BASE + '00', DARK_BASE]}
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
        width: '10%',
    },
    verticalFade: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '10%',
    }
});
