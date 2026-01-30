import { useTheme } from '@/src/core/ThemeContext';
import { SectionHeader } from '@/src/core/ui/SectionHeader';
import { CatalogCard } from '@/src/features/catalog/components/CatalogCard';
import { useTraktContext } from '@/src/features/trakt/context/TraktContext';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

const CARD_WIDTH = 144;
const SNAP_INTERVAL = CARD_WIDTH + 16;
const ITEM_SEPARATOR_WIDTH = 16;

export const TraktRecommendationsRow = () => {
    const { theme } = useTheme();
    const router = useRouter();
    const { recommendations, isAuthenticated } = useTraktContext();

    const renderItem = useCallback(({ item }: { item: any }) => (
        <CatalogCard item={item} width={CARD_WIDTH} />
    ), []);

    if (!isAuthenticated || recommendations.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <SectionHeader
                title="Trakt Top Picks"
                onAction={() => router.push('/trakt/recommendations' as any)}
                style={styles.header}
            />
            <View style={{ minHeight: CARD_WIDTH * 1.5 }}>
                <FlashList
                    data={recommendations}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.scrollContent}
                    renderItem={renderItem}
                    estimatedItemSize={CARD_WIDTH}
                    drawDistance={CARD_WIDTH * 2.5}
                    ItemSeparatorComponent={ItemSeparator}
                    snapToInterval={SNAP_INTERVAL}
                    decelerationRate="fast"
                    snapToAlignment="start"
                />
            </View>
        </View>
    );
};

const ItemSeparator = () => <View style={{ width: ITEM_SEPARATOR_WIDTH }} />;
const keyExtractor = (item: any, index: number) => `trakt-rec-${item.id}-${index}`;

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8,
    },
    header: {
        paddingHorizontal: 24
    },
    scrollContent: {
        paddingHorizontal: 24,
    },
});
