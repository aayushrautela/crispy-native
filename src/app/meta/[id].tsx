import { useResponsive } from '@/src/core/hooks/useResponsive';
import { useUserStore } from '@/src/core/stores/userStore';
import { ThemeOverrideProvider, useTheme } from '@/src/core/ThemeContext';
import { BottomSheetRef, CustomBottomSheet } from '@/src/core/ui/BottomSheet';
import { RatingModal } from '@/src/core/ui/RatingModal';
import { Typography } from '@/src/core/ui/Typography';
import { hexToRgba } from '@/src/core/utils/colors';
import { CatalogRow } from '@/src/features/catalog/components/CatalogRow';
import { AiInsightsStory } from '@/src/features/meta/components/AiInsightsStory';
import { CastSection } from '@/src/features/meta/components/CastSection';
import { CommentsSection } from '@/src/features/meta/components/CommentsSection';
import { EpisodesSection } from '@/src/features/meta/components/EpisodesSection';
import { HeroSection } from '@/src/features/meta/components/HeroSection';
import { MetaActionRow } from '@/src/features/meta/components/MetaActionRow';
import { MetaDetailsSkeleton } from '@/src/features/meta/components/MetaDetailsSkeleton';
import { RatingsSection } from '@/src/features/meta/components/RatingsSection';
import { useAiInsights } from '@/src/features/meta/hooks/useAiInsights';
import { useMetaAggregator } from '@/src/features/meta/hooks/useMetaAggregator';
import { StreamSelector } from '@/src/features/player/components/StreamSelector';
import { useStreams } from '@/src/features/player/hooks/useStreams';
import { useTraktContext } from '@/src/features/trakt/context/TraktContext';
import { useTraktWatchState } from '@/src/features/trakt/hooks/useTraktWatchState';
import { createMaterial3Theme } from '@pchmn/expo-material3-theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Share2, Volume2, VolumeX } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// No hardcoded DARK_BASE

export default function MetaDetailsScreen() {
    const { id, type, debugColors } = useLocalSearchParams();
    const { theme, amoledMode } = useTheme();
    const settings = useUserStore((state) => state.settings);
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { isTablet, isLandscape } = useResponsive();

    const [activeSeason, setActiveSeason] = useState(1);
    const [selectedEpisode, setSelectedEpisode] = useState<any>(null);
    const [availableStreams, setAvailableStreams] = useState<any[]>([]);
    const [isMuted, setIsMuted] = useState(true);
    const [pendingSheetOpen, setPendingSheetOpen] = useState(false);
    const [isStreamSheetVisible, setStreamSheetVisible] = useState(false);

    // Core Data Aggregator
    const { meta, enriched, seasonEpisodes, isLoading, error, colorExtraction } = useMetaAggregator(id as string, type as string, activeSeason);

    const streamBottomSheetRef = React.useRef<BottomSheetRef>(null);
    const scrollY = useSharedValue(0);

    useEffect(() => {
        if (isStreamSheetVisible) {
            streamBottomSheetRef.current?.present();
        }
    }, [isStreamSheetVisible]);

    const onScroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const isSeries = type === 'series' || type === 'tv' || enriched.type === 'series';

    // 1. Lifted Watch State
    const watchState = useTraktWatchState(
        (enriched.imdbId || id) as string,
        // useTraktWatchState implementation uses loose string check, 'series' is fine or 'show'
        isSeries ? 'show' : 'movie'
    );

    // 2. Auto-Select Season based on Watch State
    const continueSeason = isSeries && watchState.state === 'continue'
        ? watchState.episode?.season
        : undefined;

    useEffect(() => {
        if (!continueSeason) return;
        if (continueSeason !== activeSeason) {
            setActiveSeason(continueSeason);
        }
    }, [continueSeason, activeSeason]);

    // Stream Pre-fetching
    const preFetchId = useMemo(() => {
        const baseId = enriched.imdbId || id as string;
        if (isSeries) {
            // Priority: Continue Watching Episode
            if (watchState.state === 'continue' && watchState.episode) {
                return `${baseId}:${watchState.episode.season}:${watchState.episode.number}`;
            }
            // Fallback: Episode 1 of active season
            // This ensures "Watch Now" (which defaults to S{Active}:E1) has data ready
            return `${baseId}:${activeSeason}:1`;
        }
        return baseId;
    }, [enriched.imdbId, id, isSeries, activeSeason, watchState.state, watchState.episode]);

    useStreams(isSeries ? 'series' : 'movie', preFetchId, true);

    // Trakt Logic
    const {
        isAuthenticated,
        isInWatchlist,
        addToWatchlist,
        removeFromWatchlist,
        isMovieWatched,
        isEpisodeWatched,
        markMovieAsWatched,
        removeMovieFromHistory,
        isInCollection,
        addToCollection,
        removeFromCollection,
        getUserRating,
        rateContent,
        removeContentRating
    } = useTraktContext();

    const [showRatingModal, setShowRatingModal] = useState(false);
    const [showAiStory, setShowAiStory] = useState(false);
    const [showAiErrorSnackbar, setShowAiErrorSnackbar] = useState(false);

    // Computed states
    const isListed = useMemo(() => {
        if (!meta) return false;
        const baseId = enriched.imdbId || id as string;
        // Legacy: Context interface expects 'series' but implementation expects 'show'
        const traktType = (isSeries ? 'show' : 'movie') as any;
        return isInWatchlist(baseId, traktType);
    }, [meta, enriched.imdbId, id, isSeries, isInWatchlist]);

    const isWatched = useMemo(() => {
        if (!meta || isSeries) return false;
        const baseId = enriched.imdbId || id as string;
        return isMovieWatched(baseId);
    }, [meta, enriched.imdbId, id, isSeries, isMovieWatched]);

    const userRating = useMemo(() => {
        if (!meta) return null;
        const baseId = enriched.imdbId || id as string;
        const traktType = (isSeries ? 'show' : 'movie') as any;
        return getUserRating(baseId, traktType);
    }, [meta, enriched.imdbId, id, isSeries, getUserRating]);

    const isCollected = useMemo(() => {
        if (!meta) return false;
        const baseId = enriched.imdbId || id as string;
        const traktType = (isSeries ? 'show' : 'movie') as any;
        return isInCollection(baseId, traktType);
    }, [meta, enriched.imdbId, id, isSeries, isInCollection]);

    const handleWatchlistToggle = useCallback(async () => {
        if (!isAuthenticated) return;
        const baseId = enriched.imdbId || id as string;
        const traktType = (isSeries ? 'show' : 'movie') as any;
        if (isListed) await removeFromWatchlist(baseId, traktType);
        else await addToWatchlist(baseId, traktType);
    }, [isAuthenticated, enriched.imdbId, id, isSeries, isListed, removeFromWatchlist, addToWatchlist]);

    const handleCollectionToggle = useCallback(async () => {
        if (!isAuthenticated) return;
        const baseId = enriched.imdbId || id as string;
        const traktType = (isSeries ? 'show' : 'movie') as any;
        if (isCollected) await removeFromCollection(baseId, traktType);
        else await addToCollection(baseId, traktType);
    }, [isAuthenticated, enriched.imdbId, id, isSeries, isCollected, removeFromCollection, addToCollection]);

    const handleWatchedToggle = useCallback(async () => {
        if (!isAuthenticated || isSeries) return;
        const baseId = enriched.imdbId || id as string;
        if (isWatched) await removeMovieFromHistory(baseId);
        else await markMovieAsWatched(baseId);
    }, [isAuthenticated, isSeries, enriched.imdbId, id, isWatched, removeMovieFromHistory, markMovieAsWatched]);

    // AI Hooks
    const { loadFromCache, generateInsights, insights, isLoading: isAiLoading, error: aiError } = useAiInsights();

    const handleAiInsightsPress = useCallback(async () => {
        if (insights) {
            setShowAiStory(true);
            return;
        }

        const generatedInsights = await generateInsights(enriched);
        if (generatedInsights) {
            setShowAiStory(true);
        }
    }, [insights, enriched, generateInsights]);

    useEffect(() => {
        if (aiError) {
            setShowAiErrorSnackbar(true);
        }
    }, [aiError]);

    const showExtractedColors = __DEV__ || String(debugColors) === '1';

    const materialSeed = useMemo(() => {
        if (!colorExtraction?.accepted) return null;
        return colorExtraction.seedColor || null;
    }, [colorExtraction]);

    const scopedTheme = useMemo(() => {
        if (!materialSeed) return theme;

        const m3 = createMaterial3Theme(materialSeed);
        const scheme = m3.dark;

        const mergedColors: any = {
            ...theme.colors,
            ...scheme,
        };

        // Preserve AMOLED overrides from the global theme.
        if (amoledMode) {
            mergedColors.background = theme.colors.background;
            mergedColors.surface = theme.colors.surface;
            mergedColors.surfaceVariant = theme.colors.surfaceVariant;
            mergedColors.onSurface = theme.colors.onSurface;
            mergedColors.elevation = theme.colors.elevation;
        }

        return {
            ...theme,
            colors: mergedColors,
        };
    }, [theme, materialSeed, amoledMode]);

    const effectiveBackground = scopedTheme.colors.background;
    const topButtonBg = useMemo(() => {
        const bg = (scopedTheme.colors as any).surfaceContainerHigh || scopedTheme.colors.surfaceVariant;
        return hexToRgba(bg, 0.72);
    }, [scopedTheme.colors]);

    const colorDebugKeys = useMemo(() => {
        if (!colorExtraction) return null;

        const swatches = colorExtraction.swatches || {};
        const baseOrder = colorExtraction.platform === 'ios'
            ? ['primary', 'detail', 'secondary', 'background']
            : ['vibrant', 'darkVibrant', 'lightVibrant', 'dominant', 'average', 'lightMuted', 'muted', 'darkMuted'];

        const ordered = baseOrder.filter((k) => !!swatches[k]);
        const extras = Object.keys(swatches).filter((k) => !baseOrder.includes(k)).sort();
        return [...ordered, ...extras];
    }, [colorExtraction]);

    useEffect(() => {
        if (!enriched.tmdbId) return;

        if (settings.aiInsightsMode === 'always') {
            generateInsights(enriched);
        } else {
            loadFromCache(enriched.tmdbId.toString());
        }
    }, [enriched, settings.aiInsightsMode, generateInsights, loadFromCache]);

    const handleStreamSelect = useCallback((stream: any) => {
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
    }, [enriched.imdbId, id, isSeries, selectedEpisode, activeSeason, enriched?.title, meta?.name, availableStreams, router]);

    const handleShare = useCallback(async () => {
        const baseId = enriched.imdbId || id as string;
        const url = `https://www.imdb.com/title/${baseId}/`;
        try {
            await Share.share({
                message: `Check out ${enriched.title || meta?.name} on IMDb: ${url}`,
                url: url, // iOS
                title: enriched.title || meta?.name // Android
            });
        } catch (error) {
            console.error(error);
        }
    }, [enriched.imdbId, id, enriched.title, meta?.name]);

    // Sub-component Callbacks
    const handleWatchPress = useCallback(() => {
        if (isSeries && !selectedEpisode) {
            // Smart Resume: If "Continue" state, use that exact episode
            if (watchState.state === 'continue' && watchState.episode) {
                setSelectedEpisode({
                    episode: watchState.episode.number,
                    name: watchState.episode.title || `Episode ${watchState.episode.number}`,
                    season: watchState.episode.season
                });
                setPendingSheetOpen(true);
                return;
            }

            // Fallback: Episode 1 of active season
            setSelectedEpisode({ episode: 1, name: 'Episode 1' });
            setPendingSheetOpen(true);
        } else {
            setStreamSheetVisible(true);
        }
    }, [isSeries, selectedEpisode, watchState]);

    const handlePersonPress = useCallback((personId: string) => {
        router.push(`/person/${personId}`);
    }, [router]);

    const handleEpisodePress = useCallback((ep: any) => {
        setSelectedEpisode(ep);
        setPendingSheetOpen(true);
    }, []);

    // Effect to handle sheet opening after state update (fixes race condition)
    useEffect(() => {
        if (pendingSheetOpen && selectedEpisode) {
            setStreamSheetVisible(true);
            setPendingSheetOpen(false);
        }
    }, [pendingSheetOpen, selectedEpisode]);

    const handleIsEpisodeWatched = useCallback((epNum: number) => {
        return isEpisodeWatched((enriched.imdbId || id) as string, activeSeason, epNum);
    }, [isEpisodeWatched, enriched.imdbId, id, activeSeason]);

    const seasons = useMemo(() => {
        if (enriched?.seasons && enriched.seasons.length > 0) {
            return enriched.seasons
                .filter(s => s.seasonNumber > 0)
                .sort((a, b) => a.seasonNumber - b.seasonNumber)
                .map(s => s.seasonNumber);
        }
        return [];
    }, [enriched]);

    const streamMetadata = useMemo(() => {
        if (!enriched.title && !meta?.name) return undefined;

        const title = selectedEpisode ? (selectedEpisode.name || selectedEpisode.title || `Episode ${selectedEpisode.episode}`) : (enriched.title || meta?.name || '');

        let subtitle = '';
        if (isSeries && selectedEpisode) {
            subtitle = `S${activeSeason}E${selectedEpisode.episode}`;
            if (selectedEpisode.airDate || selectedEpisode.released) {
                const date = new Date(selectedEpisode.airDate || selectedEpisode.released);
                subtitle += ` • ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            }
        } else {
            subtitle = enriched.year || '';
        }

        return {
            title,
            subtitle,
            overview: selectedEpisode?.overview || enriched.description || meta?.description,
            thumbnail: selectedEpisode?.stillPath || selectedEpisode?.still_path || enriched.backdrop || meta?.background || meta?.poster
        };
    }, [enriched, meta, selectedEpisode, isSeries, activeSeason]);

    if (isLoading) return <MetaDetailsSkeleton />;

    if (error) {
        return (
            <ThemeOverrideProvider theme={scopedTheme}>
                <View style={[styles.container, { backgroundColor: effectiveBackground, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
                    <Typography variant="h3" style={{ textAlign: 'center', marginBottom: 16 }}>
                        Failed to load content
                    </Typography>
                    <Pressable
                        onPress={() => router.back()}
                        style={{
                            backgroundColor: scopedTheme.colors.primary,
                            paddingHorizontal: 24,
                            paddingVertical: 12,
                            borderRadius: 24,
                        }}
                    >
                        <Typography variant="label" weight="bold" style={{ color: scopedTheme.colors.onPrimary }}>
                            Go Back
                        </Typography>
                    </Pressable>
                </View>
            </ThemeOverrideProvider>
        );
    }

    return (
        <ThemeOverrideProvider theme={scopedTheme}>
            <View style={[styles.container, { backgroundColor: effectiveBackground }]}>
                <View style={[styles.topBar, { top: insets.top + 8 }]}>
                    <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: topButtonBg }]}>
                        <ArrowLeft color={scopedTheme.colors.onSurface} size={24} />
                    </Pressable>
                    <View style={styles.topRightActions}>
                        <Pressable onPress={() => setIsMuted(!isMuted)} style={[styles.backBtn, { backgroundColor: topButtonBg }]}>
                            {isMuted
                                ? <VolumeX color={scopedTheme.colors.onSurface} size={20} />
                                : <Volume2 color={scopedTheme.colors.onSurface} size={20} />}
                        </Pressable>
                        <Pressable onPress={handleShare} style={[styles.backBtn, { backgroundColor: topButtonBg }]}>
                            <Share2 color={scopedTheme.colors.onSurface} size={20} />
                        </Pressable>
                    </View>
                </View>

                {false && showExtractedColors && colorExtraction && colorDebugKeys && colorDebugKeys.length > 0 && (
                    <View
                        style={[
                            styles.colorDebug,
                            {
                                top: insets.top + 60,
                                backgroundColor: (scopedTheme.colors as any).surfaceContainerHigh || scopedTheme.colors.surfaceVariant,
                                borderColor: scopedTheme.colors.outlineVariant || scopedTheme.colors.outline,
                            },
                        ]}
                    >
                        <View style={styles.colorDebugHeader}>
                            <Typography variant="label" weight="bold" style={{ color: scopedTheme.colors.onSurface }}>
                                Extracted: {colorExtraction.source}
                            </Typography>
                            <Typography variant="label" style={{ color: scopedTheme.colors.onSurfaceVariant }}>
                                Seed: {colorExtraction.seedKey ? `${colorExtraction.seedKey} ` : ''}{colorExtraction.seedColor || '-'}
                                {colorExtraction.accepted ? '' : ' (default theme)'}
                            </Typography>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorDebugRow}>
                            {colorDebugKeys.map((key) => {
                                const value = colorExtraction.swatches[key];
                                if (!value) return null;
                                const isSeed = key === colorExtraction.seedKey;
                                return (
                                    <View key={key} style={styles.colorSwatchItem}>
                                        <View
                                            style={[
                                                styles.colorSwatch,
                                                {
                                                    backgroundColor: value,
                                                    borderColor: isSeed ? scopedTheme.colors.primary : scopedTheme.colors.outlineVariant || scopedTheme.colors.outline,
                                                    borderWidth: isSeed ? 2 : 1,
                                                },
                                            ]}
                                        />
                                        <Typography variant="label" style={{ color: scopedTheme.colors.onSurfaceVariant, fontSize: 10 }}>
                                            {key}
                                        </Typography>
                                        <Typography variant="label" style={{ color: scopedTheme.colors.onSurfaceVariant, fontSize: 10, opacity: 0.8 }}>
                                            {value.toUpperCase()}
                                        </Typography>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

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
                        scrollY={scrollY}
                        onWatchPress={handleWatchPress}
                        onAiInsightsPress={handleAiInsightsPress}
                        isAiLoading={isAiLoading}
                        isMuted={isMuted}
                        watchState={watchState}
                        isAuthenticated={isAuthenticated}
                        isListed={isListed}
                        isCollected={isCollected}
                        isWatched={isWatched}
                        isSeries={isSeries}
                        userRating={userRating}
                        onWatchlistToggle={handleWatchlistToggle}
                        onCollectionToggle={handleCollectionToggle}
                        onWatchedToggle={handleWatchedToggle}
                        onRatePress={() => setShowRatingModal(true)}
                    />

                    <View style={[styles.body, { backgroundColor: effectiveBackground, paddingHorizontal: 20 }]}>
                        {!(isTablet && isLandscape) && (
                            <MetaActionRow
                                isAuthenticated={isAuthenticated}
                                isListed={isListed}
                                isCollected={isCollected}
                                isWatched={isWatched}
                                isSeries={isSeries}
                                userRating={userRating}
                                onWatchlistToggle={handleWatchlistToggle}
                                onCollectionToggle={handleCollectionToggle}
                                onWatchedToggle={handleWatchedToggle}
                                onRatePress={() => setShowRatingModal(true)}
                                style={{ marginTop: 24 }}
                            />
                        )}

                    <RatingModal
                        visible={showRatingModal}
                        onClose={() => setShowRatingModal(false)}
                        title={enriched.title || meta?.name}
                        initialRating={userRating ? userRating * 2 : 0}
                        onRate={(r) => {
                            const baseId = enriched.imdbId || id as string;
                            const traktType = (isSeries ? 'show' : 'movie') as any;
                            rateContent(baseId, traktType, r);
                        }}
                        onRemoveRating={() => {
                            const baseId = enriched.imdbId || id as string;
                            const traktType = (isSeries ? 'show' : 'movie') as any;
                            removeContentRating(baseId, traktType);
                        }}
                    />

                        <View style={{ marginHorizontal: -20 }}>
                            <RatingsSection enriched={enriched} />
                        </View>

                        {enriched.director && (
                            <View style={{ marginTop: 16 }}>
                                <Typography variant="label" weight="black" style={[styles.subLabel, { color: scopedTheme.colors.onSurfaceVariant }]}>DIRECTOR:</Typography>
                                <Typography variant="label" weight="bold" style={{ color: scopedTheme.colors.onSurface, marginTop: 2 }}>{enriched.director}</Typography>
                            </View>
                        )}

                        <View style={{ marginHorizontal: -20 }}>
                            <CastSection cast={enriched.cast || []} onPersonPress={handlePersonPress} />
                        </View>

                        <View style={{ marginHorizontal: -20 }}>
                            <CommentsSection
                                id={(enriched.imdbId || id) as string}
                                type={isSeries ? 'show' : 'movie'}
                            />
                        </View>

                        {isSeries && seasons.length > 0 && (
                            <View style={{ marginHorizontal: -20 }}>
                                <EpisodesSection
                                    seasons={seasons}
                                    activeSeason={activeSeason}
                                    setActiveSeason={setActiveSeason}
                                    seasonEpisodes={seasonEpisodes}
                                    enrichedSeasons={enriched.seasons}
                                    isWatched={handleIsEpisodeWatched}
                                    onEpisodePress={handleEpisodePress}
                                />
                            </View>
                        )}

                        {enriched.collection?.parts && enriched.collection.parts.length > 0 && (
                            <View style={{ marginTop: 24, marginHorizontal: -20 }}>
                                <CatalogRow title={enriched.collection.name} items={enriched.collection.parts} textColor={scopedTheme.colors.onSurface} />
                            </View>
                        )}
                        {enriched.similar && enriched.similar.length > 0 && (
                            <View style={{ marginTop: 24, marginHorizontal: -20 }}>
                                <CatalogRow title="More Like This" items={(enriched.similar as any) || []} textColor={scopedTheme.colors.onSurface} hideAction={true} />
                            </View>
                        )}
                    </View>
                </Animated.ScrollView>

            <CustomBottomSheet
                ref={streamBottomSheetRef}
                title=""
                enableDynamicSizing={false}
                snapPoints={['60%', '90%']}
                scrollable={false}
                contentPaddingHorizontal={0}
                contentPaddingBottom={0}
                onChange={(index) => {
                    if (index === -1) setStreamSheetVisible(false);
                }}
            >
                <StreamSelector
                    type={isSeries ? 'series' : 'movie'}
                    id={isSeries && selectedEpisode ? `${enriched.imdbId || id}:${activeSeason}:${selectedEpisode.episode}` : (enriched.imdbId || id) as string}
                    onSelect={handleStreamSelect}
                    hideHeader
                    onStreamsLoaded={setAvailableStreams}
                    isVisible={isStreamSheetVisible}
                    metadata={streamMetadata}
                />
            </CustomBottomSheet>

                <AiInsightsStory
                    visible={showAiStory}
                    onClose={() => setShowAiStory(false)}
                    insights={insights?.insights || []}
                    trivia={insights?.trivia}
                    meta={enriched}
                />

                <Snackbar
                    visible={showAiErrorSnackbar}
                    onDismiss={() => setShowAiErrorSnackbar(false)}
                    duration={4200}
                    action={{
                        label: 'Dismiss',
                        onPress: () => setShowAiErrorSnackbar(false),
                    }}
                    style={{ marginBottom: insets.bottom + 8 }}
                >
                    {aiError?.message || 'AI insights are unavailable right now. Please try again.'}
                </Snackbar>
            </View>
        </ThemeOverrideProvider>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    topBar: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1000 },
    topRightActions: { flexDirection: 'row', gap: 12 },
    backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    colorDebug: { position: 'absolute', left: 16, right: 16, padding: 10, borderRadius: 16, borderWidth: 1, zIndex: 999 },
    colorDebugHeader: { gap: 2, marginBottom: 10 },
    colorDebugRow: { gap: 12 },
    colorSwatchItem: { width: 90 },
    colorSwatch: { width: 56, height: 28, borderRadius: 8, marginBottom: 6 },
    body: { flex: 1 },
    subLabel: { opacity: 0.7, fontSize: 10 },
    sectionTitle: { color: 'white', marginBottom: 16 },
});
