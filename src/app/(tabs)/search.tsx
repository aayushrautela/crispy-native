import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { Touchable } from '@/src/cdk/components/Touchable';
import { Typography } from '@/src/cdk/components/Typography';
import { CatalogCard } from '@/src/components/CatalogCard';
import { CatalogRow } from '@/src/components/CatalogRow';
import { EmptyState } from '@/src/components/EmptyState';
import { AddonService } from '@/src/core/api/AddonService';
import { TMDBService } from '@/src/core/api/TMDBService';
import { useAddonStore } from '@/src/core/stores/addonStore';
import { useTheme } from '@/src/core/ThemeContext';
import { useQuery } from '@tanstack/react-query';
import { Film, Info, LayoutGrid, Search as SearchIcon, Tv, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

type SearchType = 'all' | 'movie' | 'series';

const HEADER_HEIGHT = 280;

export default function SearchScreen() {
    const { theme } = useTheme();
    const [query, setQuery] = useState('');
    const [type, setType] = useState<SearchType>('all');
    const { manifests } = useAddonStore();
    const { width } = useWindowDimensions();

    const numColumns = width > 768 ? 5 : 3;
    const gap = 12;
    const padding = 16;
    const availableWidth = width - (padding * 2) - (gap * (numColumns - 1));
    const itemWidth = availableWidth / numColumns;

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

    const { data: results, isLoading } = useQuery({
        queryKey: ['search', query, type, manifests],
        queryFn: async () => {
            if (!query.trim()) return { tmdb: [], addonGroups: [] };

            const fetchTypes: ('movie' | 'series')[] = type === 'all' ? ['movie', 'series'] : [type as 'movie' | 'series'];

            // 1. Fetch TMDB Results
            const tmdbPromises = fetchTypes.map(t => TMDBService.search(t, query));
            const tmdbResponses = await Promise.allSettled(tmdbPromises);
            const tmdbResults = tmdbResponses
                .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
                .flatMap(r => r.value);

            // Sort TMDB results by popularity (WebUI behavior)
            const sortedTmdb = tmdbResults.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

            // 2. Fetch Addon Results Grouped
            const addonPromises = fetchTypes.map(t => AddonService.searchGrouped(manifests, t, query));
            const addonResponses = await Promise.allSettled(addonPromises);
            const addonGroups = addonResponses
                .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
                .flatMap(r => r.value);

            return {
                tmdb: sortedTmdb,
                addonGroups: addonGroups
            };
        },
        enabled: query.trim().length > 2,
    });

    const categoryButtons: { id: SearchType; label: string; icon: any }[] = [
        { id: 'all', label: 'All', icon: LayoutGrid },
        { id: 'movie', label: 'Movies', icon: Film },
        { id: 'series', label: 'TV Shows', icon: Tv },
    ];

    const activeIndex = useMemo(() => {
        return categoryButtons.findIndex(opt => opt.id === type);
    }, [type]);

    const renderHeader = () => (
        <Animated.View style={[styles.header, headerStyle]} pointerEvents="box-none">
            <View style={styles.headerTop} pointerEvents="box-none">
                <Typography
                    variant="display-large"
                    weight="black"
                    rounded
                    style={{ fontSize: 40, lineHeight: 48 }}
                >
                    Search
                </Typography>
            </View>

            <View style={[styles.searchBar, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                <SearchIcon size={20} color={theme.colors.onSurfaceVariant} />
                <TextInput
                    placeholder="Search for movies, TV shows..."
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    style={[styles.input, { color: theme.colors.onSurface }]}
                    value={query}
                    onChangeText={setQuery}
                />
                {query.length > 0 && (
                    <Touchable onPress={() => setQuery('')}>
                        <X size={20} color={theme.colors.onSurfaceVariant} />
                    </Touchable>
                )}
            </View>

            <View style={{ height: 56 }} pointerEvents="box-none">
                <Animated.ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterScroll}
                    pointerEvents="auto"
                >
                    {categoryButtons.map((btn, index) => {
                        const isSelected = type === btn.id;
                        return (
                            <ExpressiveSurface
                                key={btn.id}
                                onPress={() => setType(btn.id)}
                                variant={isSelected ? 'filled' : 'outlined'}
                                selected={isSelected}
                                rounding="full"
                                index={index}
                                activeIndex={activeIndex}
                                style={styles.chip}
                            >
                                <Typography
                                    variant="label-large"
                                    weight="bold"
                                    rounded
                                    style={{
                                        color: isSelected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant
                                    }}
                                >
                                    {btn.label}
                                </Typography>
                            </ExpressiveSurface>
                        );
                    })}
                </Animated.ScrollView>
            </View>
        </Animated.View>
    );

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : results?.tmdb?.length > 0 || results?.addonGroups?.length > 0 ? (
                <Animated.FlatList
                    key={numColumns}
                    data={results?.tmdb || []}
                    keyExtractor={(item, index) => `${item.id}-${index}`}
                    numColumns={numColumns}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={() => (
                        <>
                            <View style={{ height: HEADER_HEIGHT + 16 }} />
                            {results?.addonGroups?.map((group, idx) => (
                                <View key={`${group.addonName}-${idx}`} style={styles.addonSection}>
                                    <CatalogRow
                                        title={`${group.addonName}${group.catalogName ? ` - ${group.catalogName}` : ''}`}
                                        items={group.metas}
                                    />
                                </View>
                            ))}
                        </>
                    )}
                    contentContainerStyle={styles.listContent}
                    columnWrapperStyle={[styles.columnWrapper, { gap }]}
                    renderItem={({ item }) => (
                        <View style={{ width: itemWidth }}>
                            <CatalogCard item={item} width={itemWidth} />
                        </View>
                    )}
                />
            ) : query.length > 2 ? (
                <EmptyState
                    icon={Info}
                    title="No results found"
                    description={`No results found for "${query}"`}
                />
            ) : (
                <EmptyState
                    icon={SearchIcon}
                    title="Search"
                    description="Search across TMDB and all your addons"
                />
            )}
            {renderHeader()}
        </KeyboardAvoidingView>
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
        paddingTop: 64,
        paddingBottom: 16,
        zIndex: 1000,
        elevation: 10,
    },
    headerTop: {
        paddingHorizontal: 24,
        marginBottom: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginHorizontal: 24,
        height: 56,
        borderRadius: 28,
        gap: 12,
        marginBottom: 16,
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
    },
    filterScroll: {
        paddingHorizontal: 24,
        gap: 8,
        alignItems: 'center',
    },
    chip: {
        minWidth: 64,
        height: 42,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    listContent: {
        paddingBottom: 120,
    },
    columnWrapper: {
        justifyContent: 'flex-start',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    addonSection: {
        marginBottom: 12,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
});
