import { usePaginatedCatalog } from '@/src/core/hooks/usePaginatedCatalog';
import { MetaPreview } from '@/src/core/services/AddonService';
import { useTheme } from '@/src/core/ThemeContext';
import { SectionHeader } from '@/src/core/ui/SectionHeader';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { CatalogCard } from './CatalogCard';

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
    textColor?: string;
    fetchEnabled?: boolean;
}

export const CatalogRow = ({
    title,
    items: propItems,
    isLoading: propLoading,
    onSeeAll,
    catalogType,
    catalogId,
    extra,
    addonUrl,
    textColor,
    fetchEnabled = true
}: CatalogRowProps) => {
    const { theme } = useTheme();
    const router = useRouter();

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
        addonUrl,
        fetchEnabled
    );

    const items = propItems || fetchedItems;
    const isLoading = propLoading || (!!catalogId && catalogLoading);

    // Stable Footer Component
    const renderFooter = useCallback(() => {
        return null;
    }, []);

    const handleEndReached = useCallback(() => {
        if (hasMore && !isFetchingMore && !propItems) {
            fetchMore();
        }
    }, [hasMore, isFetchingMore, propItems, fetchMore]);

    // Stable Navigation Handler
    const handleSeeAll = useCallback(() => {
        if (onSeeAll) {
            onSeeAll();
            return;
        }
        if (catalogId && catalogType) {
            router.push({
                pathname: '/catalog/[id]' as any,
                params: {
                    id: catalogId,
                    type: catalogType,
                    addonUrl: addonUrl,
                    title: title
                }
            });
        }
    }, [onSeeAll, catalogId, catalogType, router, addonUrl, title]);

    // Stable RenderItem to prevent FlashList de-opt
    const renderItem = useCallback(({ item }: { item: MetaPreview }) => (
        <CatalogCard item={item} width={CARD_WIDTH} />
    ), []);

    // Stable Skeleton Render
    const renderSkeleton = useCallback(() => (
        <View
            style={[
                styles.skeleton,
                {
                    backgroundColor: (theme.colors as any).surfaceContainerHighest || theme.colors.surfaceVariant,
                    width: CARD_WIDTH,
                    height: CARD_WIDTH * 1.5,
                    borderRadius: 16
                }
            ]}
        />
    ), [theme.colors, theme.colors.surfaceVariant]);

    if (!isLoading && items.length === 0 && !!catalogId) {
        return null;
    }

    return (
        <View style={styles.container}>
            <SectionHeader
                title={title}
                textColor={textColor}
                onAction={handleSeeAll}
                style={styles.headerPadding}
            />

            {isLoading ? (
                <View style={{ height: CARD_WIDTH * 1.8 }}>
                    <FlashList
                        data={SKELETON_DATA}
                        horizontal
                        estimatedItemSize={CARD_WIDTH}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.listContent}
                        ItemSeparatorComponent={ItemSeparator}
                        renderItem={renderSkeleton}
                    />
                </View>
            ) : (
                <FlashList
                    data={items}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.listContent}
                    ItemSeparatorComponent={ItemSeparator}
                    renderItem={renderItem}
                    estimatedItemSize={CARD_WIDTH}
                    drawDistance={CARD_WIDTH * 2.5}
                    snapToInterval={SNAP_INTERVAL}
                    decelerationRate="fast"
                    snapToAlignment="start"
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={renderFooter}
                />
            )}
        </View>
    );
};

// Static Definitions outside component
const SKELETON_DATA = [...Array(6)];
const ItemSeparator = () => <View style={{ width: ITEM_GAP }} />;
const keyExtractor = (item: MetaPreview) => item.id;

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8,
    },
    headerPadding: {
        paddingHorizontal: 24,
    },
    listContent: {
        paddingHorizontal: 24,
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
    skeleton: {
        opacity: 0.5,
    },

});
