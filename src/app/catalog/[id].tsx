import { usePaginatedCatalog } from '@/src/core/hooks/usePaginatedCatalog';
import { MetaPreview } from '@/src/core/services/AddonService';
import { useTheme } from '@/src/core/ThemeContext';
import { BottomSheetRef, CustomBottomSheet } from '@/src/core/ui/BottomSheet';
import { EmptyState } from '@/src/core/ui/EmptyState';
import { ExpressiveSurface } from '@/src/core/ui/ExpressiveSurface';
import { LoadingIndicator } from '@/src/core/ui/LoadingIndicator';
import { Typography } from '@/src/core/ui/Typography';
import { CatalogCard } from '@/src/features/catalog/components/CatalogCard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, Filter, Star } from 'lucide-react-native';
import * as React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';

const HEADER_HEIGHT = 220;

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

export default function CatalogScreen() {
    const { id, type, addonUrl, title: propTitle } = useLocalSearchParams<{
        id: string;
        type: string;
        addonUrl: string;
        title: string;
    }>();

    const { theme } = useTheme();
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [selectedGenre, setSelectedGenre] = useState('All');
    const [selectedRating, setSelectedRating] = useState(0);

    const genreSheetRef = useRef<BottomSheetRef>(null);
    const ratingSheetRef = useRef<BottomSheetRef>(null);

    const numColumns = width > 768 ? 5 : 3;
    const gap = 12;
    const padding = 16;
    const availableWidth = width - (padding * 2) - (gap * (numColumns - 1));
    const itemWidth = availableWidth / numColumns;

    const scrollY = useSharedValue(0);
    const headerTranslateY = useSharedValue(0);
    const lastScrollY = useSharedValue(0);

    const {
        items,
        isLoading,
        isFetchingMore,
        hasMore,
        fetchMore,
    } = usePaginatedCatalog(
        type || '',
        id || '',
        {},
        addonUrl
    );

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
        backgroundColor: interpolate(scrollY.value, [0, 50], [0, 1]) > 0.5
            ? theme.colors.background
            : 'transparent',
    }));

    const genres = useMemo(() => {
        const set = new Set<string>();
        set.add('All');
        items.forEach(item => {
            const itemGenres = (item as any).genres;
            if (Array.isArray(itemGenres)) {
                itemGenres.forEach((g: string) => set.add(g));
            }
        });
        return Array.from(set).sort().map(g => ({ label: g, value: g }));
    }, [items]);

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const itemGenres = (item as any).genres as string[] | undefined;
            const matchesGenre = selectedGenre === 'All' || (itemGenres?.includes(selectedGenre) ?? false);

            const itemRating = (item as any).imdbRating || (item as any).rating;
            const matchesRating = parseRating(itemRating) >= selectedRating;

            return matchesGenre && matchesRating;
        });
    }, [items, selectedGenre, selectedRating]);

    const renderItem = useCallback(({ item }: { item: MetaPreview }) => (
        <View style={{ width: itemWidth, marginBottom: gap }}>
            <CatalogCard item={item} width={itemWidth} />
        </View>
    ), [itemWidth]);

    const renderFooter = () => {
        if (!isFetchingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <LoadingIndicator color={theme.colors.primary} />
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Grid */}
            {isLoading && items.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <LoadingIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : filteredItems.length > 0 ? (
                <Animated.FlatList
                    data={filteredItems}
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
                    onEndReached={() => {
                        if (hasMore && !isFetchingMore) fetchMore();
                    }}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={renderFooter}
                />
            ) : (
                <View style={{ flex: 1, paddingTop: HEADER_HEIGHT }}>
                    <EmptyState
                        icon={Filter}
                        title="No results found"
                        description="Try adjusting your filters."
                    />
                </View>
            )}

            {/* Header */}
            <Animated.View
                style={[styles.header, headerStyle]}
                pointerEvents="box-none"
            >
                <View style={styles.headerTop} pointerEvents="box-none">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                    >
                        <ArrowLeft size={24} color={theme.colors.onSurface} strokeWidth={3} />
                    </TouchableOpacity>
                    <Typography
                        variant="display-large"
                        weight="black"
                        rounded
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        style={{
                            fontSize: 40,
                            lineHeight: 48,
                            color: theme.colors.onSurface,
                            flex: 1
                        }}
                    >
                        {propTitle || 'Catalog'}
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

                        {/* Rating Filter */}
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
            <CustomBottomSheet ref={genreSheetRef} title="Select Genre" scrollable={true}>
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
                                        : { backgroundColor: (theme.colors as any).surfaceContainerLow || theme.colors.surfaceVariant }
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

            <CustomBottomSheet ref={ratingSheetRef} title="Filter by Rating" scrollable={true}>
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
                                        : { backgroundColor: (theme.colors as any).surfaceContainerLow || theme.colors.surfaceVariant }
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
        paddingHorizontal: 16,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    backButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: -8,
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
    loadingContainer: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerLoader: {
        paddingVertical: 20,
        alignItems: 'center',
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
