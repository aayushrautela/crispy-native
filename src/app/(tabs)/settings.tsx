import { useTheme } from '@/src/core/ThemeContext';
import { useUserStore } from '@/src/core/stores/userStore';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { Typography } from '@/src/core/ui/Typography';
import { Screen } from '@/src/core/ui/layout/Screen';
import { useRouter } from 'expo-router';
import {
    Brain,
    Captions,
    Cpu,
    Database,
    Info,
    Languages,
    LayoutTemplate,
    Monitor,
    Play,
    Puzzle,
    RefreshCw,
    Search,
    User
} from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

const HEADER_OFFSET = 64;
const HEADER_HEIGHT = 140;

export default function SettingsScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const traktAuth = useUserStore(s => s.traktAuth);

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
        backgroundColor: interpolate(scrollY.value, [0, 50], [0, 1]) > 0.5
            ? theme.colors.background
            : 'transparent',
    }));

    return (
        <Screen safeArea={false}>
            {/* Absolute Header - Matching Search/Discover alignment */}
            <Animated.View style={[styles.header, headerStyle]}>
                <Typography
                    variant="display-large"
                    weight="black"
                    rounded
                    style={{ fontSize: 40, lineHeight: 48, color: 'white' }}
                >
                    Settings
                </Typography>
                <Typography variant="body" className="text-zinc-400 mt-1">
                    Customize your experience
                </Typography>
            </Animated.View>

            <Animated.ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >

                <View style={{ paddingTop: 20 }}>
                    <SettingsGroup title="Account">
                        <SettingsItem
                            label="Profile"
                            icon={User}
                            onPress={() => router.push('/settings/account')}
                        />
                        <SettingsItem
                            label="Trakt.tv"
                            description={traktAuth.accessToken ? 'Synced & Connected' : 'Sync history & progress'}
                            icon={RefreshCw}
                            onPress={() => router.push('/settings/trakt')}
                        />
                    </SettingsGroup>

                    <SettingsGroup title="General">
                        <SettingsItem
                            label="Appearance"
                            description="Theme, AMOLED & colors"
                            icon={Monitor}
                            onPress={() => router.push('/settings/appearance')}
                        />
                        <SettingsItem
                            label="Language"
                            icon={Languages}
                            onPress={() => router.push('/settings/language')}
                        />
                        <SettingsItem
                            label="System"
                            description="Cache, version & tools"
                            icon={Cpu}
                            onPress={() => router.push('/settings/system')}
                        />
                    </SettingsGroup>

                    <SettingsGroup title="Player">
                        <SettingsItem
                            label="Playback"
                            description="Engine, autoplay & skip"
                            icon={Play}
                            onPress={() => router.push('/settings/playback')}
                        />
                        <SettingsItem
                            label="Subtitles"
                            description="Style, size & alignment"
                            icon={Captions}
                            onPress={() => router.push('/settings/subtitles')}
                        />
                    </SettingsGroup>

                    <SettingsGroup title="Content">
                        <SettingsItem
                            label="Home Screen"
                            description="Catalog ordering & rows"
                            icon={LayoutTemplate}
                            onPress={() => router.push('/settings/home')}
                        />
                        <SettingsItem
                            label="Addons"
                            description="Manage your libraries"
                            icon={Puzzle}
                            onPress={() => router.push('/settings/addons')}
                        />
                        <SettingsItem
                            label="Search"
                            icon={Search}
                            onPress={() => router.push('/settings/search')}
                        />
                    </SettingsGroup>

                    <SettingsGroup title="Services">
                        <SettingsItem
                            label="Metadata Providers"
                            description="TMDB & OMDB keys"
                            icon={Database}
                            onPress={() => router.push('/settings/metadata')}
                        />
                        <SettingsItem
                            label="AI Insights"
                            description="OpenRouter & LLM options"
                            icon={Brain}
                            onPress={() => router.push('/settings/ai')}
                        />
                    </SettingsGroup>

                    <SettingsGroup title="About">
                        <SettingsItem
                            label="About Crispy"
                            icon={Info}
                            onPress={() => router.push('/settings/about')}
                        />
                    </SettingsGroup>
                </View>

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
        paddingTop: HEADER_OFFSET,
        paddingHorizontal: 24,
        zIndex: 100,
    },
    scrollContent: {
        paddingTop: 160,
        paddingBottom: 120,
    }
});
