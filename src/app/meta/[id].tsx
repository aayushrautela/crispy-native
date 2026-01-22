import { BottomSheetRef, CustomBottomSheet } from '@/src/cdk/components/BottomSheet';
import { Typography } from '@/src/cdk/components/Typography';
import { CastSection } from '@/src/components/meta/CastSection';
import { CommentsSection } from '@/src/components/meta/CommentsSection';
import { EpisodesSection } from '@/src/components/meta/EpisodesSection';
import { HeroSection } from '@/src/components/meta/HeroSection';
import { MetaDetailsSkeleton } from '@/src/components/meta/MetaDetailsSkeleton';
import { RatingsSection } from '@/src/components/meta/RatingsSection';
import { StreamSelector } from '@/src/components/player/StreamSelector';
import { useAiInsights } from '@/src/core/hooks/useAiInsights';
import { useMetaAggregator } from '@/src/core/hooks/useMetaAggregator';
import { useTheme } from '@/src/core/ThemeContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Bookmark, Circle, MoreVertical, Share2, Star } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import ImageColors from 'react-native-image-colors';
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CatalogRow } from '../../components/CatalogRow';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DARK_BASE = '#121212';

export default function MetaDetailsScreen() {
    const { id, type } = useLocalSearchParams();
    const { theme } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [activeSeason, setActiveSeason] = useState(1);
    const [selectedEpisode, setSelectedEpisode] = useState<any>(null);
    const [availableStreams, setAvailableStreams] = useState<any[]>([]);

    // Core Data Aggregator
    const { meta, enriched, seasonEpisodes, isLoading } = useMetaAggregator(id as string, type as string, activeSeason);

    // Local UI State
    const [colors, setColors] = useState<{ primary: string; secondary: string; vibrant: string; dominant: string; lightVibrant: string; darkMuted: string; lightMuted: string }>({
        primary: theme.colors.background,
        secondary: theme.colors.surface,
        vibrant: '#90CAF9',
        dominant: theme.colors.background,
        lightVibrant: '#90CAF9',
        darkMuted: '#1E1E1E',
        lightMuted: '#90CAF9'
    });

    const streamBottomSheetRef = React.useRef<BottomSheetRef>(null);
    const scrollY = useSharedValue(0);

    const onScroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    // Debounced Color Extraction
    useEffect(() => {
        const backdropUrl = enriched.backdrop || meta?.background || meta?.poster;
        if (!backdropUrl) return;

        const timer = setTimeout(() => {
            ImageColors.getColors(backdropUrl, {
                fallback: theme.colors.background,
                cache: true,
                key: backdropUrl,
            }).then((result) => {
                console.log('[MetaColors] Extracted:', result);
                if (result.platform === 'android') {
                    setColors({
                        primary: result.darkMuted || result.darkVibrant || theme.colors.background,
                        secondary: result.average || theme.colors.surface,
                        vibrant: result.vibrant || '#90CAF9',
                        dominant: result.dominant || theme.colors.background,
                        lightVibrant: result.lightVibrant || result.vibrant || '#90CAF9',
                        darkMuted: result.darkMuted || result.darkVibrant || '#1E1E1E',
                        lightMuted: result.lightMuted || result.lightVibrant || '#90CAF9',
                    });
                }
            }).catch(err => console.error('[MetaColors] Error:', err));
        }, 300);

        return () => clearTimeout(timer);
    }, [enriched.backdrop, meta?.background, meta?.poster]);

    const isSeries = type === 'series' || type === 'tv' || enriched.type === 'series';

    // AI Hooks
    const { loadFromCache } = useAiInsights();

    useEffect(() => {
        if (enriched.tmdbId) {
            loadFromCache(enriched.tmdbId.toString());
        }
    }, [enriched.tmdbId]);

    const handleStreamSelect = (stream: any) => {
        streamBottomSheetRef.current?.dismiss();
        const baseId = enriched.imdbId || id as string;
        const streamId = isSeries && selectedEpisode ? `${baseId}:${activeSeason}:${selectedEpisode.episode}` : baseId;

        const params: any = {
            id: streamId,
            type: isSeries ? 'series' : 'movie',
            url: stream.url,
            title: enriched?.title || meta?.name || 'Video',
        };

        if (selectedEpisode) {
            params.episodeTitle = `S${activeSeason}:E${selectedEpisode.episode} - ${selectedEpisode.name || selectedEpisode.title}`;
        }

        if (stream.infoHash) {
            params.infoHash = stream.infoHash;
            if (stream.fileIdx !== undefined) params.fileIdx = stream.fileIdx;
        }

        if (stream.behaviorHints?.headers) {
            params.headers = JSON.stringify(stream.behaviorHints.headers);
        }

        if (availableStreams?.length > 0) {
            params.streams = JSON.stringify(availableStreams);
        }

        router.push({ pathname: '/player', params });
    };

    const seasons = useMemo(() => {
        if (enriched?.seasons?.length > 0) {
            return enriched.seasons
                .filter(s => s.seasonNumber > 0)
                .sort((a, b) => a.seasonNumber - b.seasonNumber)
                .map(s => s.seasonNumber);
        }
        return [];
    }, [enriched]);

    if (isLoading) return <MetaDetailsSkeleton />;

    return (
        <View style={[styles.container, { backgroundColor: DARK_BASE }]}>
            <View style={[styles.topBar, { top: insets.top + 8 }]}>
                <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    <ArrowLeft color="white" size={24} />
                </Pressable>
                <View style={styles.topRightActions}>
                    <Pressable style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}><Share2 color="white" size={20} /></Pressable>
                    <Pressable style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}><MoreVertical color="white" size={20} /></Pressable>
                </View>
            </View>

            <Animated.ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                style={{ zIndex: 1 }}
            >
                <HeroSection
                    meta={meta}
                    enriched={enriched}
                    colors={colors}
                    scrollY={scrollY}
                    onWatchPress={() => streamBottomSheetRef.current?.present()}
                />

                <View style={[styles.body, { backgroundColor: DARK_BASE, paddingHorizontal: 20 }]}>
                    <View style={styles.iconActionRow}>
                        <Pressable style={styles.iconActionItem}>
                            <Bookmark size={24} color="white" />
                            <Typography variant="label" style={styles.iconActionLabel}>Watchlist</Typography>
                        </Pressable>
                        <Pressable style={styles.iconActionItem}>
                            <Circle size={24} color="white" />
                            <Typography variant="label" style={styles.iconActionLabel}>Watched it?</Typography>
                        </Pressable>
                        <Pressable style={styles.iconActionItem}>
                            <Star size={24} color="white" />
                            <Typography variant="label" style={styles.iconActionLabel}>Rate</Typography>
                        </Pressable>
                    </View>

                    <RatingsSection enriched={enriched} colors={colors} />

                    {enriched.director && (
                        <View style={{ marginTop: 16 }}>
                            <Typography variant="label" weight="black" style={styles.subLabel}>DIRECTOR:</Typography>
                            <Typography variant="label" weight="bold" style={{ color: theme.colors.onSurface, marginTop: 2 }}>{enriched.director}</Typography>
                        </View>
                    )}

                    <CastSection cast={enriched.cast} theme={theme} colors={colors} onPersonPress={(id) => router.push(`/person/${id}`)} />

                    <CommentsSection
                        id={(enriched.imdbId || id) as string}
                        type={isSeries ? 'show' : 'movie'}
                        colors={colors}
                    />

                    {isSeries && seasons.length > 0 && (
                        <EpisodesSection
                            seasons={seasons}
                            activeSeason={activeSeason}
                            setActiveSeason={setActiveSeason}
                            seasonEpisodes={seasonEpisodes}
                            colors={colors}
                            theme={theme}
                            enrichedSeasons={enriched.seasons}
                            onEpisodePress={(ep) => {
                                setSelectedEpisode(ep);
                                streamBottomSheetRef.current?.present();
                            }}
                        />
                    )}

                    {enriched.collection?.parts?.length > 0 && (
                        <View style={{ marginTop: 24, marginHorizontal: -20 }}>
                            <CatalogRow title={enriched.collection.name} items={enriched.collection.parts} />
                        </View>
                    )}
                    {enriched.similar?.length > 0 && (
                        <View style={{ marginTop: 24, marginHorizontal: -20 }}>
                            <CatalogRow title="More Like This" items={enriched.similar} />
                        </View>
                    )}
                </View>
            </Animated.ScrollView>

            <CustomBottomSheet ref={streamBottomSheetRef} title={`Select Stream ${selectedEpisode ? `- S${activeSeason}:E${selectedEpisode.episode}` : ''}`} enableDynamicSizing maxHeight={SCREEN_WIDTH * 1.5} scrollable={false}>
                <StreamSelector
                    type={isSeries ? 'series' : 'movie'}
                    id={isSeries && selectedEpisode ? `${enriched.imdbId || id}:${activeSeason}:${selectedEpisode.episode}` : (enriched.imdbId || id) as string}
                    onSelect={handleStreamSelect}
                    hideHeader
                    onStreamsLoaded={setAvailableStreams}
                />
            </CustomBottomSheet>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    topBar: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1000 },
    topRightActions: { flexDirection: 'row', gap: 12 },
    backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1 },
    iconActionRow: { flexDirection: 'row', justifyContent: 'center', gap: 40, marginTop: 24 },
    iconActionItem: { alignItems: 'center', gap: 8 },
    iconActionLabel: { color: 'white', opacity: 0.6, fontSize: 10 },
    subLabel: { color: 'white', opacity: 0.4, fontSize: 10 },
    sectionTitle: { color: 'white', marginBottom: 16 },
});
