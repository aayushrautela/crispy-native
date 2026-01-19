import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { Typography } from '@/src/cdk/components/Typography';
import { useAddonStore } from '@/src/core/stores/addonStore';
import { useTheme } from '@/src/core/ThemeContext';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';
import { CatalogRow } from '../../components/CatalogRow';

import { HeroCarousel } from '../../components/HeroCarousel';

const HEADER_HEIGHT = 100;

export default function DiscoverScreen() {
    const { manifests } = useAddonStore();
    const { theme } = useTheme();
    const router = useRouter();
    const [activeFilter, setActiveFilter] = useState('All');

    const filters = ['All', 'Movies', 'Series', 'Anime', 'Channels'];

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

    const headerStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: headerTranslateY.value }],
            opacity: interpolate(headerTranslateY.value, [-HEADER_HEIGHT, 0], [0, 1]),
            backgroundColor: interpolate(scrollY.value, [0, 50], [0, 0.9]) > 0.5
                ? theme.colors.background
                : 'transparent'
        };
    });

    const allCatalogs = useMemo(() => {
        let catalogs = Object.entries(manifests).flatMap(([url, manifest]) =>
            (manifest.catalogs || []).map(catalog => ({
                ...catalog,
                addonName: manifest.name,
                addonUrl: url
            }))
        );

        if (activeFilter === 'Movies') catalogs = catalogs.filter(c => c.type === 'movie');
        if (activeFilter === 'Series') catalogs = catalogs.filter(c => c.type === 'series');
        if (activeFilter === 'Anime') catalogs = catalogs.filter(c => c.type === 'anime' || c.id.includes('anime'));
        if (activeFilter === 'Channels') catalogs = catalogs.filter(c => c.type === 'channel' || c.type === 'tv');

        return catalogs;
    }, [manifests, activeFilter]);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Animated Header */}
            <Animated.View style={[
                styles.header,
                headerStyle
            ]}>
                <Typography variant="headline-large" weight="black" style={{ color: theme.colors.onSurface }}>Discover</Typography>
                <ExpressiveSurface
                    variant="tonal"
                    rounding="full"
                    style={styles.searchEntry}
                    onPress={() => router.push('/(tabs)/search')}
                >
                    <Search size={24} color={theme.colors.onSurface} strokeWidth={2} />
                </ExpressiveSurface>
            </Animated.View>

            <Animated.ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Hero Carousel */}
                <HeroCarousel />

                {/* Filter Chips */}
                <View style={styles.filterContainer}>
                    <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                        {filters.map((f) => (
                            <Pressable
                                key={f}
                                onPress={() => setActiveFilter(f)}
                            >
                                <ExpressiveSurface
                                    variant={activeFilter === f ? 'filled' : 'tonal'}
                                    rounding="full"
                                    style={[
                                        styles.chip,
                                        activeFilter === f && { backgroundColor: theme.colors.primary }
                                    ]}
                                >
                                    <View style={styles.chipContent}>
                                        <Typography
                                            variant="label-large"
                                            weight="bold"
                                            style={{ color: activeFilter === f ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}
                                        >
                                            {f}
                                        </Typography>
                                    </View>
                                </ExpressiveSurface>
                            </Pressable>
                        ))}
                    </Animated.ScrollView>
                </View>

                <View style={styles.sections}>
                    {allCatalogs.length > 0 ? (
                        <View style={{ gap: 24 }}>
                            {allCatalogs.map((catalog, idx) => (
                                <CatalogRow
                                    key={`${catalog.addonUrl}-${catalog.id}-${catalog.type}-${idx}`}
                                    title={catalog.name || `${catalog.addonName} - ${catalog.type}`}
                                    catalogType={catalog.type}
                                    catalogId={catalog.id}
                                    addonUrl={catalog.addonUrl}
                                />
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <View style={[styles.emptyIcon, { backgroundColor: theme.colors.surfaceContainerHighest || theme.colors.surfaceVariant }]}>
                                <Search size={32} color={theme.colors.onSurfaceVariant} />
                            </View>
                            <Typography variant="title-large" weight="bold" style={{ marginTop: 24 }}>No Content Found</Typography>
                            <Typography variant="body-medium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 8, paddingHorizontal: 48 }}>
                                We couldn't find any "{activeFilter}" catalogs. Try adding more addons in Settings.
                            </Typography>
                        </View>
                    )}
                </View>

                <View style={{ height: 120 }} />
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 56,
        paddingBottom: 12,
        paddingHorizontal: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 100,
    },
    searchEntry: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingTop: 0,
    },
    filterContainer: {
        marginBottom: 8,
    },
    filterScroll: {
        paddingHorizontal: 24,
        gap: 12,
        paddingVertical: 12,
    },
    sections: {
        gap: 24,
    },
    chip: {
        minWidth: 80,
    },
    chipContent: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        paddingTop: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
