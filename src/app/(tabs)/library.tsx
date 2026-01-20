import { BottomSheetRef, CustomBottomSheet } from '@/src/cdk/components/BottomSheet';
import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { Typography } from '@/src/cdk/components/Typography';
import { Screen } from '@/src/cdk/layout/Screen';
import { CatalogCard } from '@/src/components/CatalogCard';
import { EmptyState } from '@/src/components/EmptyState';
import { MetaPreview } from '@/src/core/api/AddonService';
import { TraktService } from '@/src/core/api/TraktService';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import {
    Bookmark,
    ChevronDown,
    Eye,
    Filter,
    LayoutGrid,
    Library as LibraryIcon,
    PlayCircle,
    RefreshCw,
    Star
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';

const HEADER_HEIGHT = 200;

const FILTER_OPTIONS = [
    { label: 'Watchlist', value: 'watchlist', icon: Bookmark },
    { label: 'Watched', value: 'watched', icon: Eye },
    { label: 'Continue', value: 'continue', icon: PlayCircle },
    { label: 'Collection', value: 'collection', icon: LayoutGrid },
    { label: 'Rated', value: 'rated', icon: Star },
];

const SORT_OPTIONS = [
    { label: 'Date (Newest)', value: 'date_desc' },
    { label: 'Date (Oldest)', value: 'date_asc' },
    { label: 'Title (A-Z)', value: 'title_asc' },
    { label: 'Title (Z-A)', value: 'title_desc' },
];

export default function LibraryScreen() {
    const { theme } = useTheme();
    const { traktAuth } = useUserStore();
    const { width } = useWindowDimensions();

    const [selectedFilter, setSelectedFilter] = useState('watchlist');
    const [selectedSort, setSelectedSort] = useState('date_desc');
    const [selectedGenre, setSelectedGenre] = useState('All');
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const genreSheetRef = useRef<BottomSheetRef>(null);
    const sortSheetRef = useRef<BottomSheetRef>(null);

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

    const fetchLibrary = useCallback(async (force = false) => {
        if (!traktAuth.accessToken) return;
        setLoading(true);
        try {
            let data: any[] = [];
            switch (selectedFilter) {
                case 'watchlist': data = await TraktService.getWatchlist(); break;
                case 'watched': data = await TraktService.getWatched(); break;
                case 'continue': data = await TraktService.getContinueWatching(); break;
                case 'collection': data = await TraktService.getCollection(); break;
                case 'rated': data = await TraktService.getRated(); break;
            }
            setItems(data);
        } catch (e) {
            console.error('Library fetch failed', e);
        } finally {
            setLoading(false);
        }
    }, [selectedFilter, traktAuth.accessToken]);

    useEffect(() => {
        fetchLibrary();
    }, [fetchLibrary]);

    const genres = useMemo(() => {
        const set = new Set<string>();
        set.add('All');
        items.forEach(item => {
            if (Array.isArray(item.meta?.genres)) {
                item.meta.genres.forEach((g: string) => set.add(g));
            }
        });
        return Array.from(set).sort().map(g => ({ label: g, value: g }));
    }, [items]);

    const filteredAndSortedItems = useMemo(() => {
        let list = [...items];

        // Filter by Genre
        if (selectedGenre !== 'All') {
            list = list.filter(item => item.meta?.genres?.includes(selectedGenre));
        }

        // Apply Sorting
        return list.sort((a, b) => {
            const dateA = new Date(a.paused_at || 0).getTime();
            const dateB = new Date(b.paused_at || 0).getTime();
            const nameA = a.meta?.name || '';
            const nameB = b.meta?.name || '';

            if (selectedSort === 'date_desc') return dateB - dateA;
            if (selectedSort === 'date_asc') return dateA - dateB;
            if (selectedSort === 'title_asc') return nameA.localeCompare(nameB);
            if (selectedSort === 'title_desc') return nameB.localeCompare(nameA);
            return 0;
        });
    }, [items, selectedGenre, selectedSort]);

    const renderItem = useCallback(({ item }: { item: any }) => (
        <View style={{ width: itemWidth, marginBottom: gap }}>
            <CatalogCard
                item={{
                    id: item.meta?.id || '',
                    type: item.type === 'episode' ? 'series' : item.type,
                    name: item.meta?.name || 'Unknown',
                    poster: item.meta?.poster,
                    releaseInfo: item.meta?.year,
                    genres: item.meta?.genres,
                } as MetaPreview}
                width={itemWidth}
            />
        </View>
    ), [itemWidth]);

    if (!traktAuth.accessToken) {
        return (
            <Screen safeArea={false} style={{ backgroundColor: theme.colors.background }}>
                <EmptyState
                    icon={LibraryIcon}
                    title="Login to Trakt"
                    description="Connect your Trakt account in Settings to see your library, history, and watchlist."
                />
            </Screen>
        );
    }

    const activeFilterIndex = FILTER_OPTIONS.findIndex(opt => opt.value === selectedFilter);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Grid */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : filteredAndSortedItems.length > 0 ? (
                <Animated.FlatList
                    data={filteredAndSortedItems}
                    keyExtractor={(item, index) => `${item.id}-${index}`}
                    renderItem={renderItem}
                    numColumns={numColumns}
                    key={numColumns}
                    contentContainerStyle={{
                        paddingTop: HEADER_HEIGHT + 16,
                        paddingHorizontal: padding,
                        paddingBottom: 100,
                    }}
                    columnWrapperStyle={{ gap }}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <EmptyState
                    icon={LibraryIcon}
                    title="Library is empty"
                    description="Try adjusting your filters or sync with Trakt."
                />
            )}

            {/* Header */}
            <Animated.View
                style={[styles.header, headerStyle]}
                pointerEvents="box-none"
            >
                <View style={styles.headerTop} pointerEvents="box-none">
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography
                            variant="display-large"
                            weight="black"
                            rounded
                            style={{ fontSize: 40, lineHeight: 48, color: theme.colors.onSurface }}
                        >
                            Library
                        </Typography>
                        <ExpressiveSurface
                            onPress={() => fetchLibrary(true)}
                            variant="outlined"
                            rounding="full"
                            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <RefreshCw size={20} color={theme.colors.onSurfaceVariant} className={loading ? "animate-spin" : ""} />
                        </ExpressiveSurface>
                    </View>
                </View>

                {/* Filters */}
                <View style={{ height: 56 }} pointerEvents="box-none">
                    <Animated.ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterScroll}
                        pointerEvents="auto"
                    >
                        {FILTER_OPTIONS.map((opt, index) => {
                            const isSelected = selectedFilter === opt.value;
                            const Icon = opt.icon;
                            return (
                                <ExpressiveSurface
                                    key={opt.value}
                                    onPress={() => setSelectedFilter(opt.value)}
                                    variant={isSelected ? 'filled' : 'outlined'}
                                    selected={isSelected}
                                    rounding="full"
                                    index={index}
                                    activeIndex={activeFilterIndex}
                                    style={styles.chip}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Icon size={16} color={isSelected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant} />
                                        <Typography
                                            variant="label-large"
                                            weight="bold"
                                            style={{
                                                color: isSelected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant
                                            }}
                                        >
                                            {opt.label}
                                        </Typography>
                                    </View>
                                </ExpressiveSurface>
                            );
                        })}

                        <View style={styles.divider} />

                        {/* Genre Filter */}
                        <ExpressiveSurface
                            onPress={() => genreSheetRef.current?.present()}
                            variant={selectedGenre !== 'All' ? 'tonal' : 'outlined'}
                            selected={selectedGenre !== 'All'}
                            rounding="none"
                            style={[
                                styles.chip,
                                {
                                    borderTopLeftRadius: 26,
                                    borderBottomLeftRadius: 26,
                                    borderTopRightRadius: 4,
                                    borderBottomRightRadius: 4,
                                    marginRight: 2
                                },
                                selectedGenre !== 'All' && { backgroundColor: theme.colors.tertiaryContainer }
                            ]}
                            disablePulse={true}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Filter size={16} color={selectedGenre !== 'All' ? theme.colors.onTertiaryContainer : theme.colors.onSurfaceVariant} />
                                <Typography
                                    variant="label-large"
                                    weight="medium"
                                    style={{ color: selectedGenre !== 'All' ? theme.colors.onTertiaryContainer : theme.colors.onSurfaceVariant }}
                                >
                                    {selectedGenre === 'All' ? 'Genre' : selectedGenre}
                                </Typography>
                                <ChevronDown size={14} color={selectedGenre !== 'All' ? theme.colors.onTertiaryContainer : theme.colors.onSurfaceVariant} />
                            </View>
                        </ExpressiveSurface>

                        {/* Sort Filter */}
                        <ExpressiveSurface
                            onPress={() => sortSheetRef.current?.present()}
                            variant={selectedSort !== 'date_desc' ? 'tonal' : 'outlined'}
                            selected={selectedSort !== 'date_desc'}
                            rounding="none"
                            style={[
                                styles.chip,
                                {
                                    borderTopLeftRadius: 4,
                                    borderBottomLeftRadius: 4,
                                    borderTopRightRadius: 26,
                                    borderBottomRightRadius: 26,
                                },
                                selectedSort !== 'date_desc' && { backgroundColor: theme.colors.secondaryContainer }
                            ]}
                            disablePulse={true}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Typography
                                    variant="label-large"
                                    weight="medium"
                                    style={{ color: selectedSort !== 'date_desc' ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant }}
                                >
                                    {SORT_OPTIONS.find(o => o.value === selectedSort)?.label}
                                </Typography>
                                <ChevronDown size={14} color={selectedSort !== 'date_desc' ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant} />
                            </View>
                        </ExpressiveSurface>
                    </Animated.ScrollView>
                </View>
            </Animated.View>

            {/* Bottom Sheets */}
            <CustomBottomSheet ref={genreSheetRef} title="Select Genre">
                <View style={styles.sheetContent}>
                    {genres.map((g) => {
                        const isSelected = selectedGenre === g.value;
                        return (
                            <ExpressiveSurface
                                key={g.value}
                                onPress={() => {
                                    setSelectedGenre(g.value);
                                    genreSheetRef.current?.dismiss();
                                }}
                                variant={isSelected ? 'tonal' : 'tonal'}
                                rounding="full"
                                style={[
                                    styles.sheetChip,
                                    isSelected
                                        ? { backgroundColor: theme.colors.secondaryContainer }
                                        : { backgroundColor: theme.colors.surfaceContainerLow }
                                ]}
                            >
                                <View style={styles.sheetOptionInner}>
                                    <Typography
                                        variant="body-large"
                                        style={{
                                            color: isSelected ? theme.colors.onSecondaryContainer : theme.colors.onSurface
                                        }}
                                    >
                                        {g.label}
                                    </Typography>
                                    <View style={[
                                        styles.radioButton,
                                        { borderColor: isSelected ? theme.colors.onSecondaryContainer : theme.colors.outline }
                                    ]}>
                                        {isSelected && <View style={[styles.radioButtonDot, { backgroundColor: theme.colors.onSecondaryContainer }]} />}
                                    </View>
                                </View>
                            </ExpressiveSurface>
                        );
                    })}
                </View>
            </CustomBottomSheet>

            <CustomBottomSheet ref={sortSheetRef} title="Sort By">
                <View style={styles.sheetContent}>
                    {SORT_OPTIONS.map((s) => {
                        const isSelected = selectedSort === s.value;
                        return (
                            <ExpressiveSurface
                                key={s.value}
                                onPress={() => {
                                    setSelectedSort(s.value);
                                    sortSheetRef.current?.dismiss();
                                }}
                                variant={isSelected ? 'tonal' : 'tonal'}
                                rounding="full"
                                style={[
                                    styles.sheetChip,
                                    isSelected
                                        ? { backgroundColor: theme.colors.secondaryContainer }
                                        : { backgroundColor: theme.colors.surfaceContainerLow }
                                ]}
                            >
                                <View style={styles.sheetOptionInner}>
                                    <Typography
                                        variant="body-large"
                                        style={{
                                            color: isSelected ? theme.colors.onSecondaryContainer : theme.colors.onSurface
                                        }}
                                    >
                                        {s.label}
                                    </Typography>
                                    <View style={[
                                        styles.radioButton,
                                        { borderColor: isSelected ? theme.colors.onSecondaryContainer : theme.colors.outline }
                                    ]}>
                                        {isSelected && <View style={[styles.radioButtonDot, { backgroundColor: theme.colors.onSecondaryContainer }]} />}
                                    </View>
                                </View>
                            </ExpressiveSurface>
                        );
                    })}
                </View>
            </CustomBottomSheet>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
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
    divider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(128,128,128,0.3)',
        marginHorizontal: 4,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    sheetContent: {
        paddingHorizontal: 24,
        gap: 4,
        paddingBottom: 40,
    },
    sheetChip: {
        width: '100%',
        height: 56,
        paddingHorizontal: 0,
        paddingVertical: 0,
    },
    sheetOptionInner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 20,
        paddingRight: 14,
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioButtonDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    }
});
