import { useResponsive } from '@/src/core/hooks/useResponsive';
import { useTheme } from '@/src/core/ThemeContext';
import { BottomSheetRef, CustomBottomSheet } from '@/src/core/ui/BottomSheet';
import { RatingModal } from '@/src/core/ui/RatingModal';
import { Typography } from '@/src/core/ui/Typography';
import { CatalogRow } from '@/src/features/catalog/components/CatalogRow';
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
import { useTraktContext } from '@/src/features/trakt/context/TraktContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Share2, Volume2, VolumeX } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DARK_BASE = '#121212';

export default function MetaDetailsScreen() {
    const { id, type } = useLocalSearchParams();
    const { theme } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { isTablet, isLandscape } = useResponsive();

    const [activeSeason, setActiveSeason] = useState(1);
    const [selectedEpisode, setSelectedEpisode] = useState<any>(null);
    const [availableStreams, setAvailableStreams] = useState<any[]>([]);
    const [isMuted, setIsMuted] = useState(true);

    // Core Data Aggregator
    const { meta, enriched, seasonEpisodes, colors, isLoading, error } = useMetaAggregator(id as string, type as string, activeSeason);

    const streamBottomSheetRef = React.useRef<BottomSheetRef>(null);
    const scrollY = useSharedValue(0);

    const onScroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const isSeries = type === 'series' || type === 'tv' || enriched.type === 'series';

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

    // Computed states
    const isListed = useMemo(() => {
        if (!meta) return false;
        const baseId = enriched.imdbId || id as string;
        const traktType = isSeries ? 'show' : 'movie';
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
        const traktType = isSeries ? 'show' : 'movie';
        return getUserRating(baseId, traktType);
    }, [meta, enriched.imdbId, id, isSeries, getUserRating]);

    const isCollected = useMemo(() => {
        if (!meta) return false;
        const baseId = enriched.imdbId || id as string;
        const traktType = isSeries ? 'show' : 'movie';
        return isInCollection(baseId, traktType);
    }, [meta, enriched.imdbId, id, isSeries, isInCollection]);

    const handleWatchlistToggle = useCallback(async () => {
        if (!isAuthenticated) return;
        const baseId = enriched.imdbId || id as string;
        const traktType = isSeries ? 'show' : 'movie';
        if (isListed) await removeFromWatchlist(baseId, traktType);
        else await addToWatchlist(baseId, traktType);
    }, [isAuthenticated, enriched.imdbId, id, isSeries, isListed, removeFromWatchlist, addToWatchlist]);

    const handleCollectionToggle = useCallback(async () => {
        if (!isAuthenticated) return;
        const baseId = enriched.imdbId || id as string;
        const traktType = isSeries ? 'show' : 'movie';
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
    const { loadFromCache } = useAiInsights();

    useEffect(() => {
        if (enriched.tmdbId) {
            loadFromCache(enriched.tmdbId.toString());
        }
    }, [enriched.tmdbId]);

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
        streamBottomSheetRef.current?.present();
    }, []);

    const handlePersonPress = useCallback((personId: string) => {
        router.push(`/person/${personId}`);
    }, [router]);

    const handleEpisodePress = useCallback((ep: any) => {
        setSelectedEpisode(ep);
        streamBottomSheetRef.current?.present();
    }, []);

    const handleIsEpisodeWatched = useCallback((epNum: number) => {
        return isEpisodeWatched((enriched.imdbId || id) as string, activeSeason, epNum);
    }, [isEpisodeWatched, enriched.imdbId, id, activeSeason]);

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

    if (error) {
        return (
            <View style={[styles.container, { backgroundColor: DARK_BASE, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
                <Typography variant="h3" style={{ color: 'white', textAlign: 'center', marginBottom: 16 }}>
                    Failed to load content
                </Typography>
                <Pressable
                    onPress={() => router.back()}
                    style={{
                        backgroundColor: 'white',
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        borderRadius: 24,
                    }}
                >
                    <Typography variant="label" weight="bold" style={{ color: 'black' }}>
                        Go Back
                    </Typography>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: DARK_BASE }]}>
            <View style={[styles.topBar, { top: insets.top + 8 }]}>
                <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    <ArrowLeft color="white" size={24} />
                </Pressable>
                <View style={styles.topRightActions}>
                    <Pressable onPress={() => setIsMuted(!isMuted)} style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                        {isMuted ? <VolumeX color="white" size={20} /> : <Volume2 color="white" size={20} />}
                    </Pressable>
                    <Pressable onPress={handleShare} style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
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
                    isMuted={isMuted}
                    // Pass Trakt props for split layout
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

                <View style={[styles.body, { backgroundColor: DARK_BASE, paddingHorizontal: 20 }]}>
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
                            const traktType = isSeries ? 'show' : 'movie';
                            rateContent(baseId, traktType, r);
                        }}
                        onRemoveRating={() => {
                            const baseId = enriched.imdbId || id as string;
                            const traktType = isSeries ? 'show' : 'movie';
                            removeContentRating(baseId, traktType);
                        }}
                    />

                    <View style={{ marginHorizontal: -20 }}>
                        <RatingsSection enriched={enriched} colors={colors} />
                    </View>

                    {enriched.director && (
                        <View style={{ marginTop: 16 }}>
                            <Typography variant="label" weight="black" style={styles.subLabel}>DIRECTOR:</Typography>
                            <Typography variant="label" weight="bold" style={{ color: theme.colors.onSurface, marginTop: 2 }}>{enriched.director}</Typography>
                        </View>
                    )}

                    <View style={{ marginHorizontal: -20 }}>
                        <CastSection cast={enriched.cast} theme={theme} colors={colors} onPersonPress={handlePersonPress} />
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

                    {enriched.collection?.parts?.length > 0 && (
                        <View style={{ marginTop: 24, marginHorizontal: -20 }}>
                            <CatalogRow title={enriched.collection.name} items={enriched.collection.parts} textColor="white" />
                        </View>
                    )}
                    {enriched.similar?.length > 0 && (
                        <View style={{ marginTop: 24, marginHorizontal: -20 }}>
                            <CatalogRow title="More Like This" items={enriched.similar} textColor="white" />
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
    subLabel: { color: 'white', opacity: 0.4, fontSize: 10 },
    sectionTitle: { color: 'white', marginBottom: 16 },
});
