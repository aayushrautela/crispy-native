import { MetaPreview } from '@/src/core/services/AddonService';
import { TraktService } from '@/src/core/services/TraktService';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { SectionHeader } from '@/src/core/ui/SectionHeader';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ContinueWatchingCard } from './ContinueWatchingCard';

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
    const [loading, setLoading] = useState(true);

    const fetchItems = useCallback(async () => {
        if (!traktAuth?.accessToken) {
            setItems([]);
            setLoading(false);
            return;
        }

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

    const renderSkeleton = useCallback(() => (
        <View style={{ width: CARD_WIDTH, gap: 8 }}>
            <View
                style={[
                    styles.skeleton,
                    {
                        backgroundColor: theme.colors.surfaceVariant,
                        width: CARD_WIDTH,
                        height: CARD_WIDTH / 1.77,
                        borderRadius: 12
                    }
                ]}
            />
            <View style={{ gap: 6 }}>
                <View style={[styles.skeleton, { width: '80%', height: 20, borderRadius: 4, backgroundColor: theme.colors.surfaceVariant }]} />
                <View style={[styles.skeleton, { width: '40%', height: 16, borderRadius: 4, backgroundColor: theme.colors.surfaceVariant }]} />
            </View>
        </View>
    ), [theme.colors.surfaceVariant]);

    if (!traktAuth?.accessToken || (!loading && items.length === 0)) {
        return null;
    }

    return (
        <View style={styles.container}>
            <SectionHeader
                title="Continue Watching"
                style={{ paddingHorizontal: 24 }}
            />

            <View style={{ minHeight: CARD_WIDTH / 1.77 + 50 }}>
                <FlashList
                    data={loading ? SKELETON_DATA : items}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item, index) => loading ? `skeleton-${index}` : `${item.id}-${index}`}
                    contentContainerStyle={styles.scrollContent}
                    renderItem={loading ? renderSkeleton : ({ item }) => (
                        <ContinueWatchingCard item={item} width={CARD_WIDTH} />
                    )}
                    estimatedItemSize={CARD_WIDTH}
                    drawDistance={CARD_WIDTH * 2.5}
                    snapToInterval={SNAP_INTERVAL}
                    decelerationRate="fast"
                    snapToAlignment="start"
                    ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
                />
            </View>
        </View>
    );
};



const SKELETON_DATA = [...Array(4)];

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8,
    },
    scrollContent: {
        paddingHorizontal: 24,
    },
    skeleton: {
        opacity: 0.5,
    }
});
