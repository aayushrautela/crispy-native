import { useResponsive } from '@/src/core/hooks/useResponsive';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { BottomSheetRef, CustomBottomSheet } from '@/src/core/ui/BottomSheet';
import { RatingModal } from '@/src/core/ui/RatingModal';
import { Typography } from '@/src/core/ui/Typography';
import { generateMediaPalette } from '@/src/core/utils/colors';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Share2, Volume2, VolumeX } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// No hardcoded DARK_BASE

export default function MetaDetailsScreen() {
    const { id, type } = useLocalSearchParams();
    const { theme } = useTheme();
    const { settings } = useUserStore();
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
    const { meta, enriched, seasonEpisodes, colors, isLoading, error } = useMetaAggregator(id as string, type as string, activeSeason);

    const streamBottomSheetRef = React.useRef<BottomSheetRef>(null);
    const scrollY = useSharedValue(0);

    useEffect(() => {
        console.log('[MetaScreen] mounted');
        return () => console.log('[MetaScreen] unmounted');
    }, []);

    useEffect(() => {
        if (isStreamSheetVisible) {
            console.log('[MetaScreen] useEffect: presenting stream bottom sheet');
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
    useEffect(() => {
        if (watchState.state === 'continue' && watchState.episode && isSeries) {
            const epSeason = watchState.episode.season;
            // Only switch if we are viewing a different season
            if (epSeason && epSeason !== activeSeason) {
                setActiveSeason(epSeason);
            }
        }
    }, [watchState.state, watchState.episode?.season, isSeries]);

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
    const { loadFromCache, generateInsights, insights, isLoading: isAiLoading } = useAiInsights();

    const handleAiInsightsPress = useCallback(async () => {
        if (!insights) {
            await generateInsights(enriched);
        }
        setShowAiStory(true);
    }, [insights, enriched, generateInsights]);

    const mediaPalette = useMemo(() => generateMediaPalette(colors.vibrant || '#607d8b'), [colors.vibrant]);
    const amoled = theme.dark && theme.colors.background === '#000000';
    const effectiveBackground = amoled ? '#000000' : mediaPalette.surface;

    useEffect(() => {
        if (!enriched.tmdbId) return;

        if (settings.aiInsightsMode === 'always') {
            generateInsights(enriched);
        } else {
            loadFromCache(enriched.tmdbId.toString());
        }
    }, [enriched.tmdbId, settings.aiInsightsMode]);

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
            console.log('[MetaScreen] pendingSheetOpen is true, presenting bottom sheet');
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

    if (isLoading) return <MetaDetailsSkeleton />;

    if (error) {
        return (
            <View style={[styles.container, { backgroundColor: effectiveBackground, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
                <Typography variant="h3" style={{ textAlign: 'center', marginBottom: 16 }}>
                    Failed to load content
                </Typography>
                <Pressable
                    onPress={() => router.back()}
                    style={{
                        backgroundColor: theme.colors.primary,
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        borderRadius: 24,
                    }}
                >
                    <Typography variant="label" weight="bold" style={{ color: theme.colors.onPrimary }}>
                        Go Back
                    </Typography>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: effectiveBackground }]}>
            <View style={[styles.topBar, { top: insets.top + 8 }]}>
                <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                    <ArrowLeft color="white" size={24} />
                </Pressable>
                <View style={styles.topRightActions}>
                    <Pressable onPress={() => setIsMuted(!isMuted)} style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                        {isMuted ? <VolumeX color="white" size={20} /> : <Volume2 color="white" size={20} />}
                    </Pressable>
                    <Pressable onPress={handleShare} style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                        <Share2 color="white" size={20} />
                    </Pressable>
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
                    onWatchPress={handleWatchPress}
                    onAiInsightsPress={handleAiInsightsPress}
                    isAiLoading={isAiLoading}
                    isMuted={isMuted}
                    // Pass Trakt props for split layout
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
                            palette={mediaPalette}
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
                        <RatingsSection enriched={enriched} colors={colors} palette={mediaPalette} />
                    </View>

                    {enriched.director && (
                        <View style={{ marginTop: 16 }}>
                            <Typography variant="label" weight="black" style={styles.subLabel}>DIRECTOR:</Typography>
                            <Typography variant="label" weight="bold" style={{ color: theme.colors.onSurface, marginTop: 2 }}>{enriched.director}</Typography>
                        </View>
                    )}

                    <View style={{ marginHorizontal: -20 }}>
                        <CastSection cast={enriched.cast || []} theme={theme} colors={colors} palette={mediaPalette} onPersonPress={handlePersonPress} />
                    </View>

                    <View style={{ marginHorizontal: -20 }}>
                        <CommentsSection
                            id={(enriched.imdbId || id) as string}
                            type={isSeries ? 'show' : 'movie'}
                            colors={colors}
                        />
                    </View>

                    {isSeries && seasons.length > 0 && (
                        <View style={{ marginHorizontal: -20 }}>
                            <EpisodesSection
                                seasons={seasons}
                                activeSeason={activeSeason}
                                setActiveSeason={setActiveSeason}
                                seasonEpisodes={seasonEpisodes}
                                colors={colors}
                                theme={theme}
                                enrichedSeasons={enriched.seasons}
                                isWatched={handleIsEpisodeWatched}
                                onEpisodePress={handleEpisodePress}
                            />
                        </View>
                    )}

                    {enriched.collection?.parts && enriched.collection.parts.length > 0 && (
                        <View style={{ marginTop: 24, marginHorizontal: -20 }}>
                            <CatalogRow title={enriched.collection.name} items={enriched.collection.parts} textColor="white" />
                        </View>
                    )}
                    {enriched.similar && enriched.similar.length > 0 && (
                        <View style={{ marginTop: 24, marginHorizontal: -20 }}>
                            <CatalogRow title="More Like This" items={(enriched.similar as any) || []} textColor="white" />
                        </View>
                    )}
                </View>
            </Animated.ScrollView>

            <CustomBottomSheet
                ref={streamBottomSheetRef}
                title={`Select Stream ${selectedEpisode ? `- S${activeSeason}:E${selectedEpisode.episode}` : ''}`}
                enableDynamicSizing={false}
                snapPoints={['60%', '90%']}
                scrollable={false}
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
                />
            </CustomBottomSheet>

            <AiInsightsStory
                visible={showAiStory}
                onClose={() => setShowAiStory(false)}
                insights={insights?.insights || []}
                trivia={insights?.trivia}
                meta={enriched}
                backgroundColor={effectiveBackground}
                accentColor={mediaPalette.primary}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    topBar: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1000 },
    topRightActions: { flexDirection: 'row', gap: 12 },
    backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1 },
    subLabel: { color: 'white', opacity: 0.4, fontSize: 10 },
    sectionTitle: { color: 'white', marginBottom: 16 },
});
