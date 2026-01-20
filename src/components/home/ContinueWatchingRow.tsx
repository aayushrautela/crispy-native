import { MetaPreview } from '@/src/core/api/AddonService';
import { TraktService } from '@/src/core/api/TraktService';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { CatalogCard } from '../CatalogCard';
import { SectionHeader } from '../SectionHeader';

const CARD_WIDTH = 280; // Larger cards for immersive Continue Watching
// WebUI Continue Watching uses 'landscape' shape for episodes usually?
// Let's stick to standard poster for now to match 'CatalogRow', OR detect type.
// WebUI logic: "posterShape: 'landscape'" if it uses background.
// TraktService in WebUI favored fanart (background) for Continue Watching cards.
// I'll stick to 16:9 for Continue Watching if possible, but let's check what images I have.
// TraktService hydration prioritizes poster.
// Wait, `processContinueWatching` in `TraktService.ts`:
// poster = poster || meta.poster;
// background = background || meta.backdrop;
// It has both.
// Let's use Landscape (16:9) for Continue Watching as it looks better for "In Progress".

const SNAP_INTERVAL = CARD_WIDTH + 16;

export const ContinueWatchingRow = () => {
    const { theme } = useTheme();
    const traktAuth = useUserStore(s => s.traktAuth);
    const [items, setItems] = useState<MetaPreview[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchItems = useCallback(async () => {
        if (!traktAuth?.accessToken) {
            setItems([]);
            return;
        }

        setLoading(true);
        try {
            const data = await TraktService.getContinueWatching();
            const mapped: MetaPreview[] = data.map(item => {
                const isMovie = item.type === 'movie';
                const media = isMovie ? item.movie : item.show;
                if (!media) return null;

                const id = media.ids.imdb || (media.ids.tmdb ? `tmdb:${media.ids.tmdb}` : undefined);

                // Prioritize hydrated images (WebUI matches this)
                const poster = item.meta?.poster || media.images?.poster?.[0];
                const backdrop = item.meta?.background || media.images?.fanart?.[0];
                const logo = item.meta?.logo || media.images?.logo?.[0];

                const isEpisode = item.type === 'episode' || !isMovie;
                const showTitle = item.meta?.name || media.title || '';
                const epTitle = item.meta?.episodeTitle || item.episode?.title || `Episode ${item.episode?.number}`;
                const displayName = isEpisode
                    ? `S${item.episode?.season}E${item.episode?.number}: ${epTitle}`
                    : showTitle;

                // Format Air Date logic exactly as WebUI (MetaCard.tsx:14)
                let formattedDate = undefined;
                if (item.meta?.airDate) {
                    try {
                        const date = new Date(item.meta.airDate);
                        const isCurrentYear = date.getFullYear() === new Date().getFullYear();
                        formattedDate = date.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: !isCurrentYear ? 'numeric' : undefined
                        });
                    } catch (e) { }
                }

                return {
                    id: id || '',
                    type: item.type,
                    name: displayName,
                    poster: poster,
                    backdrop: backdrop,
                    posterShape: 'landscape',
                    description: item.meta?.description,
                    progressPercent: item.progress,
                    // WebUI: sub-text is Year/Date + Genres. 
                    // No show title in that row for episodes (it's in the logo).
                    releaseInfo: isEpisode ? undefined : (media.year?.toString() || item.meta?.rating),
                    airDate: formattedDate,
                    logo: logo,
                    genres: item.meta?.genres,
                };
            }).filter(i => i && i.id) as MetaPreview[];
            setItems(mapped);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [traktAuth?.accessToken]);

    useFocusEffect(
        useCallback(() => {
            fetchItems();
        }, [fetchItems])
    );

    if (!traktAuth?.accessToken || (items.length === 0 && !loading)) {
        return null;
    }

    return (
        <View style={styles.container}>
            <SectionHeader
                title="Continue Watching"
                style={{ paddingHorizontal: 24 }}
            />

            {loading && items.length === 0 ? (
                <View style={[styles.scrollContent, { height: (CARD_WIDTH / 1.77) + 30, justifyContent: 'center' }]}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
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
                />
            )}
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
