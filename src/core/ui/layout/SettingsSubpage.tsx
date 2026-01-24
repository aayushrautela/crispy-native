import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    interpolate,
    interpolateColor,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../ThemeContext';
import { Typography } from '../Typography';
import { Screen } from './Screen';

interface SettingsSubpageProps {
    title: string;
    children: React.ReactNode;
}

const HEADER_HEIGHT = 100;

export function SettingsSubpage({ title, children }: SettingsSubpageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const scrollY = useSharedValue(0);
    const headerTranslateY = useSharedValue(0);
    const lastScrollY = useSharedValue(0);

    const onScroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            const currentScrollY = event.contentOffset.y;
            const diff = currentScrollY - lastScrollY.value;

            if (currentScrollY <= 0) {
                headerTranslateY.value = 0;
            } else if (diff > 0 && currentScrollY > 50) {
                headerTranslateY.value = Math.max(headerTranslateY.value - diff, -HEADER_HEIGHT);
            } else if (diff < 0) {
                headerTranslateY.value = Math.min(headerTranslateY.value - diff, 0);
            }

            lastScrollY.value = currentScrollY;
            scrollY.value = currentScrollY;
        },
    });

    const headerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: headerTranslateY.value }],
        opacity: interpolate(headerTranslateY.value, [-HEADER_HEIGHT, 0], [0, 1]),
    }));

    // Background opacity driven by scroll - use interpolateColor for smoother transition
    const headerBgStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            scrollY.value,
            [0, 50],
            ['rgba(30, 30, 30, 0)', 'rgba(30, 30, 30, 1)']
        )
    }));

    return (
        <Screen safeArea={false} style={{ backgroundColor: theme.colors.surface }}>
            <Animated.View style={[styles.header, headerStyle, headerBgStyle, { paddingTop: insets.top + 16 }]}>
                <View style={styles.headerRow}>
                    <Pressable onPress={() => router.back()} style={styles.backBtn}>
                        <ArrowLeft color={theme.colors.onSurface} size={24} />
                    </Pressable>
                    <Typography variant="display-small" weight="black" rounded style={{ color: theme.colors.onSurface }}>
                        {title}
                    </Typography>
                </View>
            </Animated.View>

            <Animated.ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 80 }]}
                showsVerticalScrollIndicator={false}
                style={{ backgroundColor: theme.colors.surface }}
            >
                {children}
            </Animated.ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingBottom: 16,
        zIndex: 100,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingBottom: 120,
    }
});
