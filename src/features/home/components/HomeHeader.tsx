import { MetaPreview } from '@/src/core/services/AddonService';
import { CatalogRow } from '@/src/features/catalog/components/CatalogRow';
import { ContinueWatchingRow } from '@/src/features/home/components/ContinueWatchingRow';
import { HeroCarousel } from '@/src/features/home/components/HeroCarousel';
import { TraktRecommendationsRow } from '@/src/features/home/components/TraktRecommendationsRow';
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

interface HomeHeaderProps {
    carouselItems: MetaPreview[];
    showContinueWatching?: boolean;
    showTraktRecommendations?: boolean;
    isEmpty?: boolean;
}

const HomeHeaderComponent = ({
    carouselItems,
    showContinueWatching,
    showTraktRecommendations,
    isEmpty
}: HomeHeaderProps) => {
    return (
        <View style={styles.container}>
            <HeroCarousel items={carouselItems} />
            {showContinueWatching && <ContinueWatchingRow />}
            {showTraktRecommendations && <TraktRecommendationsRow />}
            {isEmpty && (
                <View style={styles.emptyPrompt}>
                    <CatalogRow
                        title="Trending Movies"
                        catalogType="movie"
                        catalogId="tmdb_trending"
                    />
                    <View style={styles.spacer} />
                    <CatalogRow
                        title="Popular Shows"
                        catalogType="series"
                        catalogId="tmdb_popular"
                    />
                </View>
            )}
        </View>
    );
};

export const HomeHeader = memo(HomeHeaderComponent);

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
    },
    emptyPrompt: {
        paddingTop: 0,
    },
    spacer: {
        height: 32,
    }
});
