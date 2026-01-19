import { BottomSheetRef, CustomBottomSheet } from '@/src/cdk/components/BottomSheet';
import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { Typography } from '@/src/cdk/components/Typography';
import { CatalogCard } from '@/src/components/CatalogCard';
import { AddonService, MetaPreview } from '@/src/core/api/AddonService';
import { useAddonStore } from '@/src/core/stores/addonStore';
import { useTheme } from '@/src/core/ThemeContext';
import { useRouter } from 'expo-router';
import { ChevronDown, Filter, Star } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';

const HEADER_HEIGHT = 160;

const TYPE_OPTIONS = [
    { label: 'All', value: 'all' },
    { label: 'Movies', value: 'movie' },
    { label: 'Series', value: 'series' },
    { label: 'Anime', value: 'anime' },
];

const RATING_OPTIONS = [
    { label: 'All Ratings', value: 0 },
    { label: 'Above 5', value: 5 },
    { label: 'Above 6', value: 6 },
    { label: 'Above 7', value: 7 },
    { label: 'Above 8', value: 8 },
    { label: 'Above 9', value: 9 },
];

function parseRating(rating?: string | number): number {
    if (!rating) return 0;
    if (typeof rating === 'number') return rating;
    const clean = String(rating).replace(/[^0-9.]/g, '');
    const val = parseFloat(clean);
    if (String(rating).includes('%')) return val / 10;
    return val;
}

export default function DiscoverScreen() {
    const { manifests } = useAddonStore();
    const { theme } = useTheme();
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [selectedType, setSelectedType] = useState('all');
    const [selectedGenre, setSelectedGenre] = useState('All');
    const [selectedRating, setSelectedRating] = useState(0);

    const genreSheetRef = useRef<BottomSheetRef>(null);
    const ratingSheetRef = useRef<BottomSheetRef>(null);

    const [allItems, setAllItems] = useState<MetaPreview[]>([]);
    const [loading, setLoading] = useState(false);

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

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const catalogsToFetch: { url: string; type: string; id: string }[] = [];
            Object.entries(manifests).forEach(([url, manifest]) => {
                if (!manifest.catalogs) return;
                manifest.catalogs.forEach(cat => {
                    const isRelevantType = selectedType === 'all'
                        ? ['movie', 'series', 'anime'].includes(cat.type)
                        : cat.type === selectedType;

                    if (isRelevantType) {
                        catalogsToFetch.push({ url, type: cat.type, id: cat.id });
                    }
                });
            });

            const limitedCatalogs = catalogsToFetch.slice(0, 12);
            const results = await Promise.allSettled(
                limitedCatalogs.map(c => AddonService.getCatalog(c.url, c.type, c.id))
            );

            const allMetas: MetaPreview[] = [];
            results.forEach(res => {
                if (res.status === 'fulfilled' && res.value?.metas) {
                    allMetas.push(...res.value.metas);
                }
            });

            const seen = new Set<string>();
            const uniqueItems = allMetas.filter(item => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            });

            setAllItems(uniqueItems);
        } catch (e) {
            console.error('Discover fetch failed', e);
        } finally {
            setLoading(false);
        }
    }, [manifests, selectedType]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    const genres = useMemo(() => {
        const set = new Set<string>();
        set.add('All');
        allItems.forEach(item => {
            const itemGenres = (item as any).genres;
            if (Array.isArray(itemGenres)) {
                itemGenres.forEach((g: string) => set.add(g));
            }
        });
        return Array.from(set).sort().map(g => ({ label: g, value: g }));
    }, [allItems]);

    const filteredItems = useMemo(() => {
        return allItems.filter(item => {
            const itemGenres = (item as any).genres as string[] | undefined;
            const matchesGenre = selectedGenre === 'All' || (itemGenres?.includes(selectedGenre) ?? false);

            const itemRating = (item as any).imdbRating || (item as any).rating;
            const matchesRating = parseRating(itemRating) >= selectedRating;

            return matchesGenre && matchesRating;
        });
    }, [allItems, selectedGenre, selectedRating]);

    const renderItem = useCallback(({ item }: { item: MetaPreview }) => (
        <View style={{ width: itemWidth, marginBottom: gap }}>
            <CatalogCard item={item} width={itemWidth} />
        </View>
    ), [itemWidth]);

    const activeIndex = useMemo(() => {
        return TYPE_OPTIONS.findIndex(opt => opt.value === selectedType);
    }, [selectedType]);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Grid */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : filteredItems.length > 0 ? (
                <Animated.FlatList
                    data={filteredItems}
                    keyExtractor={(item) => item.id}
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
                <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIcon, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
                        <Filter size={32} color={theme.colors.onSurfaceVariant} />
                    </View>
                    <Typography variant="title-large" weight="bold" style={{ marginTop: 24, color: theme.colors.onSurface }}>No results found</Typography>
                    <Typography variant="body-medium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>Try adjusting your filters.</Typography>
                </View>
            )}

            {/* Header */}
            <Animated.View
                style={[styles.header, headerStyle]}
                pointerEvents="box-none"
            >
                <View style={styles.headerTop} pointerEvents="box-none">
                    <Typography
                        variant="display-large"
                        weight="black"
                        rounded
                        style={{ fontSize: 40, lineHeight: 48, color: theme.colors.onSurface }}
                    >
                        Discover
                    </Typography>
                </View>

                {/* Filters */}
                <View style={{ height: 56 }} pointerEvents="box-none">
                    <Animated.ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterScroll}
                        pointerEvents="auto"
                    >
                        {TYPE_OPTIONS.map((opt, index) => {
                            const isSelected = selectedType === opt.value;
                            return (
                                <ExpressiveSurface
                                    key={opt.value}
                                    onPress={() => setSelectedType(opt.value)}
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
                                        style={{
                                            color: isSelected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant
                                        }}
                                    >
                                        {opt.label}
                                    </Typography>
                                </ExpressiveSurface>
                            );
                        })}

                        <View style={styles.divider} />

                        {/* Genre Filter - Matches PixelPlayer "New" (Tertiary) style [26dp L, 4dp R] */}
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
                                    marginRight: 2 // Tiny gap
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

                        {/* Rating Filter - Matches PixelPlayer "Import" (Secondary) style [4dp L, 26dp R] */}
                        <ExpressiveSurface
                            onPress={() => ratingSheetRef.current?.present()}
                            variant={selectedRating > 0 ? 'tonal' : 'outlined'}
                            selected={selectedRating > 0}
                            rounding="none"
                            style={[
                                styles.chip,
                                {
                                    borderTopLeftRadius: 4,
                                    borderBottomLeftRadius: 4,
                                    borderTopRightRadius: 26,
                                    borderBottomRightRadius: 26,
                                },
                                selectedRating > 0 && { backgroundColor: theme.colors.secondaryContainer }
                            ]}
                            disablePulse={true}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Star size={16} color={selectedRating > 0 ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant} />
                                <Typography
                                    variant="label-large"
                                    weight="medium"
                                    style={{ color: selectedRating > 0 ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant }}
                                >
                                    {selectedRating > 0 ? `> ${selectedRating}` : 'Rating'}
                                </Typography>
                                <ChevronDown size={14} color={selectedRating > 0 ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant} />
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

            <CustomBottomSheet ref={ratingSheetRef} title="Filter by Rating">
                <View style={styles.sheetContent}>
                    {RATING_OPTIONS.map((r) => {
                        const isSelected = selectedRating === r.value;
                        return (
                            <ExpressiveSurface
                                key={r.value}
                                onPress={() => {
                                    setSelectedRating(r.value);
                                    ratingSheetRef.current?.dismiss();
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
                                        {r.label}
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
    emptyContainer: {
        flex: 1,
        paddingTop: 200,
        alignItems: 'center',
    },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
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
