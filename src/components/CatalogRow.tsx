import { MetaPreview } from '@/src/core/api/AddonService';
import { usePaginatedCatalog } from '@/src/core/hooks/usePaginatedCatalog';
import { useTheme } from '@/src/core/ThemeContext';
import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { CatalogCard } from './CatalogCard';
import { SectionHeader } from './SectionHeader';

const CARD_WIDTH = 144;
const ITEM_GAP = 16;
const SNAP_INTERVAL = CARD_WIDTH + ITEM_GAP;

interface CatalogRowProps {
    title: string;
    items?: MetaPreview[];
    isLoading?: boolean;
    onSeeAll?: () => void;
    catalogType?: string;
    catalogId?: string;
    extra?: Record<string, any>;
    addonUrl?: string;
}

export const CatalogRow = ({
    title,
    items: propItems,
    isLoading: propLoading,
    onSeeAll,
    catalogType,
    catalogId,
    extra,
    addonUrl
}: CatalogRowProps) => {
    const { theme } = useTheme();

    const {
        items: fetchedItems,
        isLoading: catalogLoading,
        isFetchingMore,
        hasMore,
        fetchMore,
    } = usePaginatedCatalog(
        catalogType || '',
        catalogId || '',
        extra,
        addonUrl
    );

    const items = propItems || fetchedItems;
    const isLoading = propLoading || (!!catalogId && catalogLoading);

    if (!isLoading && items.length === 0 && !!catalogId) {
        return null;
    }

    const handleEndReached = () => {
        if (hasMore && !isFetchingMore && !propItems) {
            fetchMore();
        }
    };

    const renderFooter = () => {
        if (!isFetchingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator color={theme.colors.primary} />
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <SectionHeader
                title={title}
                onAction={onSeeAll}
                style={{ paddingHorizontal: 24 }}
            />

            {isLoading ? (
                <FlatList
                    data={[...Array(6)]}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    renderItem={() => (
                        <View
                            style={[
                                styles.skeleton,
                                {
                                    backgroundColor: theme.colors.surfaceContainerHighest || theme.colors.surfaceVariant,
                                    width: CARD_WIDTH,
                                    height: CARD_WIDTH * 1.5,
                                    borderRadius: 16
                                }
                            ]}
                        />
                    )}
                />
            ) : (
                <FlatList
                    data={items}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item, index) => `${item.id}-${index}`}
                    contentContainerStyle={styles.scrollContent}
                    renderItem={({ item }) => (
                        <CatalogCard item={item} width={CARD_WIDTH} />
                    )}
                    snapToInterval={SNAP_INTERVAL}
                    decelerationRate="fast"
                    snapToAlignment="start"
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={renderFooter}
                    // Performance optimizations
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={4}
                    windowSize={3}
                    initialNumToRender={4}
                    getItemLayout={(_, index) => ({
                        length: SNAP_INTERVAL,
                        offset: SNAP_INTERVAL * index,
                        index,
                    })}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        marginBottom: 12,
    },
    seeAllBtn: {
        marginRight: -12,
    },
    scrollContent: {
        paddingHorizontal: 24,
        gap: ITEM_GAP,
    },
    skeleton: {
        opacity: 0.5,
    },
    footerLoader: {
        width: 100,
        height: CARD_WIDTH * 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
