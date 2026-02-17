import { useResponsive } from '@/src/core/hooks/useResponsive';
import { useUserStore } from '@/src/core/stores/userStore';
import { ThemeOverrideProvider, useTheme } from '@/src/core/ThemeContext';
import { BottomSheetRef, CustomBottomSheet } from '@/src/core/ui/BottomSheet';
import { SectionHeader } from '@/src/core/ui/SectionHeader';
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
import { prefetchStreams } from '@/src/features/player/hooks/useStreams';
import { useTraktContext } from '@/src/features/trakt/context/TraktContext';
import { useTraktWatchState } from '@/src/features/trakt/hooks/useTraktWatchState';
import { makeEpisodeId, toImdbIdForExternalLookup, toStrictBaseMediaId } from '@/src/core/ids/mediaIds';
import { createMaterial3Theme } from '@pchmn/expo-material3-theme';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Share2, Volume2, VolumeX } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// No hardcoded DARK_BASE

const formatLongDate = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

const formatRuntimeMinutes = (minutes?: number) => {
    if (!minutes || minutes <= 0) return null;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
};

const formatCurrency = (value?: number) => {
    if (!value || value <= 0) return null;
    return `$${value.toLocaleString('en-US')}`;
};

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

    // Normalize route ID to strict format early to prevent cache collisions
    const routeStrictBaseId = useMemo(() => {
        const candidate = id as string;
        // Try both types since route type can be wrong/unknown during initial render
        return toStrictBaseMediaId(candidate, 'movie') || toStrictBaseMediaId(candidate, 'series');
    }, [id]);

    // Core Data Aggregator
    // Use normalized strict ID to prevent cache collisions and ensure consistent TMDB resolution
    const { meta, enriched, seasonEpisodes, isLoading, error, colorExtraction } = useMetaAggregator(
        routeStrictBaseId || (id as string),
        type as string,
        activeSeason
    );

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

    const strictBaseId = useMemo(() => {
        const candidate = (enriched?.id as string | undefined) || routeStrictBaseId || (id as string);
        // Try both since route type can be wrong/unknown during initial render.
        return toStrictBaseMediaId(candidate, 'movie') || toStrictBaseMediaId(candidate, 'series');
    }, [enriched?.id, routeStrictBaseId, id]);

    const externalImdbId = useMemo(() => {
        if (enriched?.imdbId && typeof enriched.imdbId === 'string' && enriched.imdbId.startsWith('tt')) {
            return enriched.imdbId;
        }
        if (!strictBaseId) return null;
        return toImdbIdForExternalLookup(strictBaseId, isSeries ? 'series' : 'movie');
    }, [enriched?.imdbId, isSeries, strictBaseId]);

    // 1. Lifted Watch State
    const watchState = useTraktWatchState(
        (strictBaseId || (id as string)) as string,
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
        const baseId = strictBaseId;
        if (!baseId) return '';
        if (isSeries) {
            // Priority: Continue Watching Episode
            if (watchState.state === 'continue' && watchState.episode) {
                return makeEpisodeId(baseId, watchState.episode.season, watchState.episode.number);
            }
            // Fallback: Episode 1 of active season
            // This ensures "Watch Now" (which defaults to S{Active}:E1) has data ready
            return makeEpisodeId(baseId, activeSeason, 1);
        }
        return baseId;
    }, [activeSeason, isSeries, strictBaseId, watchState.episode, watchState.state]);

    const queryClient = useQueryClient();

    useEffect(() => {
        if (!preFetchId) return;
        prefetchStreams(queryClient, { type: isSeries ? 'series' : 'movie', id: preFetchId });
    }, [isSeries, preFetchId, queryClient]);

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
        if (!strictBaseId) return false;
        const traktType = isSeries ? 'series' : 'movie';
        return isInWatchlist(strictBaseId, traktType);
    }, [isInWatchlist, isSeries, meta, strictBaseId]);

    const isWatched = useMemo(() => {
        if (!meta || isSeries) return false;
        if (!strictBaseId) return false;
        return isMovieWatched(strictBaseId);
    }, [isMovieWatched, isSeries, meta, strictBaseId]);

    const userRating = useMemo(() => {
        if (!meta) return null;
        if (!strictBaseId) return null;
        const traktType = isSeries ? 'series' : 'movie';
        return getUserRating(strictBaseId, traktType);
    }, [getUserRating, isSeries, meta, strictBaseId]);

    const isCollected = useMemo(() => {
        if (!meta) return false;
        if (!strictBaseId) return false;
        const traktType = isSeries ? 'series' : 'movie';
        return isInCollection(strictBaseId, traktType);
    }, [isInCollection, isSeries, meta, strictBaseId]);

    const handleWatchlistToggle = useCallback(async () => {
        if (!isAuthenticated) return;
        if (!strictBaseId) return;
        const traktType = isSeries ? 'series' : 'movie';
        if (isListed) await removeFromWatchlist(strictBaseId, traktType);
        else await addToWatchlist(strictBaseId, traktType);
    }, [addToWatchlist, isAuthenticated, isListed, isSeries, removeFromWatchlist, strictBaseId]);

    const handleCollectionToggle = useCallback(async () => {
        if (!isAuthenticated) return;
        if (!strictBaseId) return;
        const traktType = isSeries ? 'series' : 'movie';
        if (isCollected) await removeFromCollection(strictBaseId, traktType);
        else await addToCollection(strictBaseId, traktType);
    }, [addToCollection, isAuthenticated, isCollected, isSeries, removeFromCollection, strictBaseId]);

    const handleWatchedToggle = useCallback(async () => {
        if (!isAuthenticated || isSeries) return;
        if (!strictBaseId) return;
        if (isWatched) await removeMovieFromHistory(strictBaseId);
        else await markMovieAsWatched(strictBaseId);
    }, [isAuthenticated, isSeries, isWatched, markMovieAsWatched, removeMovieFromHistory, strictBaseId]);

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
        const baseId = strictBaseId;
        if (!baseId) return;
        const streamId = isSeries && selectedEpisode
            ? makeEpisodeId(baseId, activeSeason, selectedEpisode.episode)
            : baseId;

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
    }, [activeSeason, availableStreams, enriched?.title, isSeries, meta?.name, router, selectedEpisode, strictBaseId]);

    const handleShare = useCallback(async () => {
        if (!externalImdbId) return;
        const url = `https://www.imdb.com/title/${externalImdbId}/`;
        try {
            await Share.share({
                message: `Check out ${enriched.title || meta?.name} on IMDb: ${url}`,
                url: url, // iOS
                title: enriched.title || meta?.name // Android
            });
        } catch (error) {
            console.error(error);
        }
    }, [enriched.title, externalImdbId, meta?.name]);

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
        if (!strictBaseId) return false;
        return isEpisodeWatched(strictBaseId, activeSeason, epNum);
    }, [activeSeason, isEpisodeWatched, strictBaseId]);

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

    const detailsRows = useMemo(() => {
        const rows: Array<{ label: string; value: string }> = [];

        if (isSeries) {
            if (enriched.status) rows.push({ label: 'STATUS', value: enriched.status });

            const firstAirDate = formatLongDate(enriched.firstAirDate);
            if (firstAirDate) rows.push({ label: 'FIRST AIR DATE', value: firstAirDate });

            const lastAirDate = formatLongDate(enriched.lastAirDate);
            if (lastAirDate) rows.push({ label: 'LAST AIR DATE', value: lastAirDate });

            if (enriched.numberOfSeasons) rows.push({ label: 'SEASONS', value: `${enriched.numberOfSeasons}` });
            if (enriched.numberOfEpisodes) rows.push({ label: 'EPISODES', value: `${enriched.numberOfEpisodes}` });

            const episodeRunTime = enriched.episodeRunTime?.filter((m) => typeof m === 'number' && m > 0) || [];
            if (episodeRunTime.length > 0) {
                rows.push({ label: 'EPISODE RUNTIME', value: `${episodeRunTime.join(' - ')} min` });
            }

            if (enriched.originCountry && enriched.originCountry.length > 0) {
                rows.push({ label: 'ORIGIN COUNTRY', value: enriched.originCountry.join(', ') });
            }

            if (enriched.originalLanguage) {
                rows.push({ label: 'ORIGINAL LANGUAGE', value: enriched.originalLanguage.toUpperCase() });
            }

            if (enriched.createdBy && enriched.createdBy.length > 0) {
                rows.push({ label: 'CREATED BY', value: enriched.createdBy.join(', ') });
            }

            return rows;
        }

        if (enriched.tagline) rows.push({ label: 'TAGLINE', value: `"${enriched.tagline}"` });
        if (enriched.status) rows.push({ label: 'STATUS', value: enriched.status });

        const releaseDate = formatLongDate(enriched.releaseDate);
        if (releaseDate) rows.push({ label: 'RELEASE DATE', value: releaseDate });

        const runtime = formatRuntimeMinutes(enriched.runtimeMinutes) || enriched.runtime;
        if (runtime) rows.push({ label: 'RUNTIME', value: runtime });

        const budget = formatCurrency(enriched.budget);
        if (budget) rows.push({ label: 'BUDGET', value: budget });

        const revenue = formatCurrency(enriched.revenue);
        if (revenue) rows.push({ label: 'REVENUE', value: revenue });

        if (enriched.originCountry && enriched.originCountry.length > 0) {
            rows.push({ label: 'ORIGIN COUNTRY', value: enriched.originCountry.join(', ') });
        }

        if (enriched.originalLanguage) {
            rows.push({ label: 'ORIGINAL LANGUAGE', value: enriched.originalLanguage.toUpperCase() });
        }

        return rows;
    }, [isSeries, enriched]);

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

                {false && showExtractedColors && colorExtraction && (colorDebugKeys?.length || 0) > 0 && (
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
                                Extracted: {colorExtraction?.source}
                            </Typography>
                            <Typography variant="label" style={{ color: scopedTheme.colors.onSurfaceVariant }}>
                                Seed: {colorExtraction?.seedKey ? `${colorExtraction?.seedKey} ` : ''}{colorExtraction?.seedColor || '-'}
                                {colorExtraction?.accepted ? '' : ' (default theme)'}
                            </Typography>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorDebugRow}>
                            {(colorDebugKeys || []).map((key) => {
                                const value = colorExtraction?.swatches[key];
                                if (!value) return null;
                                const isSeed = key === colorExtraction?.seedKey;
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
                        initialRating={userRating !== null && userRating !== undefined ? userRating * 2 : null}
                        onRate={(r) => {
                            if (!strictBaseId) return;
                            rateContent(strictBaseId, isSeries ? 'series' : 'movie', r);
                        }}
                        onRemoveRating={() => {
                            if (!strictBaseId) return;
                            removeContentRating(strictBaseId, isSeries ? 'series' : 'movie');
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
                                id={externalImdbId || undefined}
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

                        {detailsRows.length > 0 && (
                            <View style={{ marginTop: 24, marginHorizontal: -20 }}>
                                <SectionHeader
                                    title={isSeries ? 'Show Details' : 'Movie Details'}
                                    hideAction
                                    style={{ paddingHorizontal: 20 }}
                                />
                                <View style={styles.metaDetailsList}>
                                    {detailsRows.map((row, index) => (
                                        <View key={`${row.label}-${index}`} style={styles.metaDetailsRow}>
                                            <Typography variant="label" weight="black" style={[styles.metaDetailsLabel, { color: scopedTheme.colors.onSurfaceVariant }]}>
                                                {row.label}
                                            </Typography>
                                            <Typography variant="label" weight="bold" style={[styles.metaDetailsValue, { color: scopedTheme.colors.onSurface }]}>
                                                {row.value}
                                            </Typography>
                                        </View>
                                    ))}
                                </View>
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
                    id={(() => {
                        if (!strictBaseId) return '';
                        if (isSeries && selectedEpisode) return makeEpisodeId(strictBaseId, activeSeason, selectedEpisode.episode);
                        return strictBaseId;
                    })()}
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
    metaDetailsList: {
        paddingHorizontal: 20,
        marginTop: 12,
    },
    metaDetailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 6,
    },
    metaDetailsLabel: {
        fontSize: 10,
        opacity: 0.7,
        minWidth: 100,
    },
    metaDetailsValue: {
        flex: 1,
        textAlign: 'right',
    },
    sectionTitle: { color: 'white', marginBottom: 16 },
});
