import { useTheme } from '@/src/core/ThemeContext';
import { SectionHeader } from '@/src/core/ui/SectionHeader';
import { CatalogCard } from '@/src/features/catalog/components/CatalogCard';
import { useTraktContext } from '@/src/features/trakt/context/TraktContext';
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

const CARD_WIDTH = 144;
const SNAP_INTERVAL = CARD_WIDTH + 16;

export const TraktRecommendationsRow = () => {
    const { theme } = useTheme();
    const { recommendations, isAuthenticated } = useTraktContext();

    if (!isAuthenticated || recommendations.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <SectionHeader
                title="Trakt Top Picks"
                style={{ paddingHorizontal: 24 }}
            />
            <FlatList
                data={recommendations}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => `trakt-rec-${item.id}-${index}`}
                contentContainerStyle={styles.scrollContent}
                renderItem={({ item }) => (
                    <CatalogCard item={item} width={CARD_WIDTH} />
                )}
                snapToInterval={SNAP_INTERVAL}
                decelerationRate="fast"
                snapToAlignment="start"
                removeClippedSubviews={true}
                maxToRenderPerBatch={5}
                windowSize={5}
                initialNumToRender={4}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8,
    },
    scrollContent: {
        paddingHorizontal: 24,
        gap: 16,
    },
});
