import { useTheme } from '@/src/core/ThemeContext';
import React, { useEffect } from 'react';
import { BackHandler, Dimensions, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    SlideInRight,
    SlideOutRight
} from 'react-native-reanimated';
import { Typography } from './Typography';

interface SideSheetProps {
    isVisible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    width?: number | string;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export function SideSheet({
    isVisible,
    onClose,
    title,
    children,
    width = '45%' // Default width for side sheet
}: SideSheetProps) {
    const { theme } = useTheme();

    // Handle Hardware Back Button
    useEffect(() => {
        if (!isVisible) return;

        const onBackPress = () => {
            onClose();
            return true;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, onClose]);

    if (!isVisible) return null;

    return (
        <View style={[styles.container, { zIndex: 9999 }]} pointerEvents="box-none">
            {/* Backdrop */}
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(200)}
                    style={styles.backdrop}
                />
            </Pressable>

            {/* Sheet Content */}
            <Animated.View
                entering={SlideInRight.duration(300)}
                exiting={SlideOutRight.duration(300)}
                style={[
                    styles.sheet,
                    {
                        width,
                        backgroundColor: theme.colors.surfaceContainerHigh || '#1E1E1E',
                        borderLeftColor: theme.colors.outlineVariant,
                    }
                ]}
            >
                {title && (
                    <View style={styles.header}>
                        <Typography
                            variant="display-small"
                            weight="bold"
                            style={{
                                color: theme.colors.onSurface,
                                fontSize: 24, // Slightly smaller than BottomSheet "Display Small"
                            }}
                        >
                            {title}
                        </Typography>
                    </View>
                )}
                <View style={styles.content}>
                    {children}
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
        height: '100%',
        borderLeftWidth: 1,
        elevation: 16,
        shadowColor: "#000",
        shadowOffset: {
            width: -2,
            height: 0,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 16,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingBottom: 24,
    }
});
