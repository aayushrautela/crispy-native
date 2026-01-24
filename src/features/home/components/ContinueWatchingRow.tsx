import { MetaPreview } from '@/src/core/services/AddonService';
import { TraktService } from '@/src/core/services/TraktService';
import { useTheme } from '@/src/core/ThemeContext';
import { LoadingIndicator } from '@/src/core/ui/LoadingIndicator';
import { SectionHeader } from '@/src/core/ui/SectionHeader';
import { CatalogCard } from '@/src/features/catalog/components/CatalogCard';
import { useUserStore } from '@/src/features/trakt/stores/userStore';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

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
            setItems(data);
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
                    <LoadingIndicator color={theme.colors.primary} />
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
