import { BottomSheetRef, CustomBottomSheet } from '@/src/cdk/components/BottomSheet';
import { ExpressiveButton } from '@/src/cdk/components/ExpressiveButton';
import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { Typography } from '@/src/cdk/components/Typography';
import { AIInsightsCarousel } from '@/src/components/meta/AIInsightsCarousel';
import { StreamSelector } from '@/src/components/player/StreamSelector';
import { TMDBMeta, TMDBService } from '@/src/core/api/TMDBService';
import { useAiInsights } from '@/src/core/hooks/useAiInsights';
import { useMeta } from '@/src/core/hooks/useDiscovery';
import { useTheme } from '@/src/core/ThemeContext';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowUpRight, Bookmark, ChevronDown, Circle, MoreVertical, Play, Share2, Star } from 'lucide-react-native';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import ImageColors from 'react-native-image-colors';
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CatalogRow } from '../../components/CatalogRow';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 750;
const BACKDROP_HEIGHT = 480;
const DARK_BASE = '#121212';

const hexToRgba = (hex: string, opacity: number) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const CastItem = memo(({ person, theme, onPress, palette }: { person: any; theme: any; onPress: () => void; palette: any }) => {
    return (
        <Pressable onPress={onPress}>
            <View style={styles.castItem}>
                <ExpoImage
                    source={person.profile ? { uri: person.profile } : require('@/assets/images/icon.png')}
                    style={[styles.castImage, { borderColor: palette.primary, borderWidth: 1 }]}
                />
                <Typography
                    variant="label"
                    weight="black"
                    numberOfLines={1}
                    style={{ color: theme.colors.onSurface, marginTop: 8, fontSize: 12 }}
                >
                    {person.name}
                </Typography>
                <Typography
                    variant="label"
                    weight="medium"
                    numberOfLines={1}
                    style={{ color: theme.colors.onSurfaceVariant, opacity: 0.6, fontSize: 11 }}
                >
                    {person.character}
                </Typography>
            </View>
        </Pressable>
    );
});

const EpisodeItem = memo(({ episode, theme, onPress, palette }: { episode: any; theme: any; onPress: () => void; palette: any }) => {
    return (
        <Pressable onPress={onPress}>
            <View style={[styles.episodeCard, { backgroundColor: hexToRgba(palette.vibrant, 0.16) }]}>
                <ExpoImage source={{ uri: episode.thumbnail || episode.poster }} style={styles.episodeThumb} />
                <View style={styles.episodeInfo}>
                    <Typography variant="label" weight="black" numberOfLines={1} style={{ color: 'white' }}>
                        E{episode.episode || episode.number}: {episode.name || episode.title}
                    </Typography>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2 }}>
                        {episode.runtime && (
                            <Typography variant="label" style={{ color: 'white', opacity: 0.6 }}>
                                {episode.runtime}
                            </Typography>
                        )}
                        {episode.released && (
                            <Typography variant="label" style={{ color: 'white', opacity: 0.6 }}>
                                {new Date(episode.released).toLocaleDateString()}
                            </Typography>
                        )}
                    </View>
                    <Typography
                        variant="label"
                        numberOfLines={2}
                        style={{ color: 'white', opacity: 0.7, marginTop: 4, fontSize: 11 }}
                    >
                        {episode.overview || episode.description || 'No description available.'}
                    </Typography>
                </View>
            </View>
        </Pressable>
    );
});

const ReviewCard = memo(({ review, theme, onPress, palette }: { review: any; theme: any; onPress: () => void; palette: any }) => {
    if (!review) return null;

    return (
        <Pressable onPress={onPress}>
            <View style={[styles.reviewCard, { backgroundColor: hexToRgba(palette.vibrant, 0.16) }]}>
                <View style={styles.reviewHeader}>
                    <ExpoImage
                        source={review.avatar ? { uri: review.avatar } : require('@/assets/images/icon.png')}
                        style={styles.avatar}
                    />
                    <View style={{ flex: 1 }}>
                        <Typography variant="label" weight="bold" style={{ color: theme.colors.onSurface }}>
                            {review.author}
                        </Typography>
                        {review.rating && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Star size={10} color="#F5C518" fill="#F5C518" />
                                <Typography variant="label" style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
                                    {review.rating}/10
                                </Typography>
                            </View>
                        )}
                    </View>
                </View>
                <Typography
                    variant="body"
                    numberOfLines={4}
                    style={{ color: theme.colors.onSurface, opacity: 0.8, marginTop: 8, fontSize: 13 }}
                >
                    {review.content}
                </Typography>
            </View>
        </Pressable>
    );
});

const RatingCard = memo(({ source, score, label, icon, theme, palette }: { source: string; score: string; label: string; icon: React.ReactNode; theme: any; palette: any }) => (
    <View style={[styles.ratingCard, { backgroundColor: hexToRgba(palette.vibrant, 0.16) }]}>
        <View style={styles.ratingIconContainer}>
            {icon}
        </View>
        <View style={styles.ratingInfo}>
            <Typography variant="label" weight="black" style={{ color: 'white', fontSize: 13 }}>{score}</Typography>
            <Typography variant="label" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{label}</Typography>
        </View>
        <View style={styles.ratingArrowContainer}>
            <ArrowUpRight size={14} color="rgba(255,255,255,0.7)" />
        </View>
    </View>
));

export default function MetaDetailsScreen() {
    const { id, type } = useLocalSearchParams();
    const { theme } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [showStreamSelector, setShowStreamSelector] = useState(false);
    const [activeSeason, setActiveSeason] = useState(1);
    const [enriched, setEnriched] = useState<Partial<TMDBMeta>>({});
    const [seasonEpisodes, setSeasonEpisodes] = useState<any[]>([]);
    const [selectedEpisode, setSelectedEpisode] = useState<any>(null);
    const [selectedReview, setSelectedReview] = useState<any>(null);
    const [availableStreams, setAvailableStreams] = useState<any[]>([]);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [colors, setColors] = useState<{ primary: string; secondary: string; vibrant: string; dominant: string; lightVibrant: string; darkMuted: string }>({
        primary: theme.colors.background,
        secondary: theme.colors.surface,
        vibrant: '#90CAF9', // Default blue from screenshot
        dominant: theme.colors.background,
        lightVibrant: '#90CAF9',
        darkMuted: '#1E1E1E'
    });
    const bottomSheetRef = React.useRef<BottomSheetRef>(null);
    const streamBottomSheetRef = React.useRef<BottomSheetRef>(null);

    const isSeries = type === 'series' || type === 'tv' || enriched.type === 'series';

    // AI Hooks
    const { insights, isLoading: isAiLoading, generateInsights, loadFromCache, clearInsights } = useAiInsights();

    useEffect(() => {
        if (enriched.tmdbId) {
            loadFromCache(enriched.tmdbId.toString());
        }
    }, [enriched.tmdbId]);

    const scrollY = useSharedValue(0);

    const onScroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const backdropStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateY: interpolate(scrollY.value, [0, HERO_HEIGHT], [0, -HERO_HEIGHT * 0.4], Extrapolation.CLAMP) },
                { scale: interpolate(scrollY.value, [-100, 0], [1.2, 1], Extrapolation.CLAMP) }
            ],
        };
    });

    const { data: meta, isLoading } = useMeta(type as string, id as string);

    useEffect(() => {
        if (id) {
            TMDBService.getEnrichedMeta(id as string, type as any).then(data => {
                setEnriched(data);
                if (data.tmdbId && (type === 'series' || type === 'tv' || data.type === 'series')) {
                    // Fetch Season 1 by default
                    TMDBService.getSeasonEpisodes(data.tmdbId, 1).then(setSeasonEpisodes);
                }
            });
        }
    }, [id, type]);

    useEffect(() => {
        const tmdbId = enriched.tmdbId;
        if (tmdbId && (type === 'series' || type === 'tv' || enriched.type === 'series')) {
            TMDBService.getSeasonEpisodes(tmdbId, activeSeason).then(data => {
                if (data && data.length > 0) setSeasonEpisodes(data);
            });
        }
    }, [activeSeason, enriched.tmdbId, type, enriched.type]);

    const backdropUrl = enriched.backdrop || meta?.background || meta?.poster;

    // Extract Colors from Backdrop
    useEffect(() => {
        console.log('[MetaColors] Effect triggered. ImageColors available:', !!ImageColors);
        console.log('[MetaColors] backdropUrl:', backdropUrl);
        if (backdropUrl) {
            console.log('[MetaColors] Attempting extraction from:', backdropUrl);
            ImageColors.getColors(backdropUrl, {
                fallback: theme.colors.background,
                cache: true,
                key: backdropUrl,
            })
                .then((result) => {
                    console.log('[MetaColors] Extraction success:', result);
                    if (result.platform === 'android') {
                        setColors({
                            primary: result.darkMuted || result.darkVibrant || theme.colors.background,
                            secondary: result.average || theme.colors.surface,
                            vibrant: result.vibrant || '#90CAF9',
                            dominant: result.dominant || theme.colors.background,
                            lightVibrant: result.lightVibrant || result.vibrant || '#90CAF9',
                            darkMuted: result.darkMuted || result.darkVibrant || '#1E1E1E',
                        });
                    } else if (result.platform === 'ios') {
                        setColors({
                            primary: result.background || theme.colors.background,
                            secondary: result.secondary || theme.colors.surface,
                            vibrant: result.primary || theme.colors.background,
                            dominant: result.detail || theme.colors.background,
                            lightVibrant: result.primary || result.detail || '#90CAF9',
                            darkMuted: result.secondary || result.detail || '#1E1E1E',
                        });
                    }
                })
                .catch(err => {
                    console.error('[MetaColors] Extraction error:', err);
                });
        } else {
            console.log('[MetaColors] No backdropUrl yet, skipping extraction.');
        }
    }, [backdropUrl]);

    // Auto-trigger stream selector if autoplay is requested
    useEffect(() => {
        if (!isLoading && meta && useLocalSearchParams().autoplay === 'true') {
            streamBottomSheetRef.current?.present();
        }
    }, [isLoading, meta]);

    const getStreamId = () => {
        const baseId = enriched.imdbId || id as string;
        if (!isSeries || !selectedEpisode) return baseId;
        // Construct standard Stremio ID format: id:season:episode
        return `${baseId}:${activeSeason}:${selectedEpisode.episode}`;
    };

    const handleStreamSelect = (stream: any) => {
        streamBottomSheetRef.current?.dismiss();

        const params: any = {
            id: getStreamId(),
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

        if (stream.behaviorHints && stream.behaviorHints.headers) {
            params.headers = JSON.stringify(stream.behaviorHints.headers);
        }

        // Pass available streams if we have them
        if (availableStreams && availableStreams.length > 0) {
            params.streams = JSON.stringify(availableStreams);
        }

        router.push({
            pathname: '/player',
            params
        });
    };

    const seasons = useMemo(() => {
        if (enriched?.seasons && enriched.seasons.length > 0) {
            return enriched.seasons
                .filter(s => s.seasonNumber > 0)
                .sort((a, b) => a.seasonNumber - b.seasonNumber)
                .map(s => s.seasonNumber);
        }

        // Fallback to meta.videos ONLY if enriched data fails
        if (meta?.videos) {
            const s = new Set<number>();
            meta.videos.forEach((v: any) => s.add(v.season || 1));
            return Array.from(s).sort((a, b) => a - b);
        }
        return [];
    }, [meta, enriched]);

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Typography variant="body" weight="medium" style={{ color: theme.colors.onSurfaceVariant }}>Loading details...</Typography>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: DARK_BASE }]}>
            {/* Layer 1: Parallax Backdrop (Fixed at back) */}
            <Animated.View style={[styles.parallaxLayer, backdropStyle]} pointerEvents="none">
                <ExpoImage source={{ uri: backdropUrl }} style={styles.heroImage} contentFit="cover" />
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.4)', DARK_BASE]}
                    locations={[0, 0.6, 1]}
                    style={styles.heroGradient}
                />
            </Animated.View>

            {/* Top Bar Actions */}
            <View style={[styles.topBar, { top: insets.top + 8 }]}>
                <Pressable
                    onPress={() => router.back()}
                    style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                >
                    <ArrowLeft color="white" size={24} />
                </Pressable>

                <View style={styles.topRightActions}>
                    <Pressable
                        onPress={() => { }}
                        style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                    >
                        <Share2 color="white" size={20} />
                    </Pressable>
                    <Pressable
                        onPress={() => { }}
                        style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                    >
                        <MoreVertical color="white" size={20} />
                    </Pressable>
                </View>
            </View>

            {/* Layer 2: Scrolling Content */}
            <Animated.ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                style={{ zIndex: 1 }}
            >
                {/* Transparent Spacer for Hero Height - using minHeight for dynamic expansion */}
                <View style={{ minHeight: HERO_HEIGHT, paddingTop: 350 }}>
                    {/* Gradient Fade for Body Start (Starts from description area) */}
                    <LinearGradient
                        colors={['transparent', DARK_BASE, DARK_BASE]}
                        locations={[0, 0.4, 1]}
                        style={{ position: 'absolute', top: BACKDROP_HEIGHT - 150, left: 0, right: 0, bottom: 0 }}
                        pointerEvents="none"
                    />

                    <View style={[styles.heroContent, { paddingBottom: 40, paddingHorizontal: 20 }]}>
                        {/* Trailer Button */}
                        <Pressable style={styles.trailerBtn}>
                            <Play size={14} color="white" fill="white" />
                            <Typography variant="label" weight="bold" style={{ color: 'white', marginLeft: 4 }}>Trailer</Typography>
                        </Pressable>

                        {/* Title / Logo */}
                        {enriched.logo ? (
                            <ExpoImage
                                source={{ uri: enriched.logo }}
                                style={styles.heroLogo}
                                contentFit="contain"
                            />
                        ) : (
                            <Typography variant="h1" weight="black" style={styles.heroTitle}>
                                {(enriched.title || meta?.name)?.toUpperCase()}
                            </Typography>
                        )}

                        {/* Metadata Row */}
                        <View style={styles.metadataRow}>
                            <View style={styles.metaItem}>
                                <Star size={14} color="#00C853" fill="#00C853" />
                                <Typography variant="label" weight="black" style={{ color: 'white', marginLeft: 4 }}>
                                    {enriched.rating ? `${Math.round(Number(enriched.rating) * 10)}%` : '51%'}
                                </Typography>
                            </View>
                            {enriched.maturityRating && (
                                <View style={styles.metaBadge}>
                                    <Typography variant="label" weight="black" style={{ color: 'white', fontSize: 10 }}>
                                        {enriched.maturityRating}
                                    </Typography>
                                </View>
                            )}
                            <Typography variant="label" style={styles.metaText}>{enriched.year || '2025'}</Typography>
                            <Typography variant="label" style={styles.metaText}>{meta?.runtime || '1 hr 43 min'}</Typography>
                        </View>

                        {/* Description (Expandable) */}
                        <Pressable
                            onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                            style={styles.descriptionContainer}
                        >
                            <Typography
                                variant="body"
                                numberOfLines={isDescriptionExpanded ? undefined : 3}
                                style={styles.descriptionText}
                            >
                                {enriched.description || meta?.description}
                            </Typography>
                            <ChevronDown
                                size={20}
                                color="white"
                                style={[
                                    styles.descriptionChevron,
                                    { transform: [{ rotate: isDescriptionExpanded ? '180deg' : '0deg' }] }
                                ]}
                            />
                        </Pressable>

                        {/* Primary Action Button */}
                        <View style={styles.actionStack}>
                            <ExpressiveButton
                                title="Watch now"
                                variant="primary"
                                icon={<Play size={20} color="black" fill="black" />}
                                onPress={() => streamBottomSheetRef.current?.present()}
                                style={[styles.watchNowBtn, { backgroundColor: colors.lightVibrant }]}
                                textStyle={{ color: 'black', fontWeight: 'bold' }}
                            />
                        </View>

                        {/* Icon Action Row */}
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

                        {/* Ratings Section */}
                        <View style={styles.ratingsSection}>
                            <Typography variant="h3" weight="black" style={styles.sectionTitle}>Ratings</Typography>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.ratingsScrollContent}
                            >
                                <RatingCard
                                    source="imdb"
                                    score={enriched.rating ? `${enriched.rating}/10` : '5.7/10'}
                                    label="IMDb"
                                    theme={theme}
                                    palette={colors}
                                    icon={
                                        <View style={[styles.sourceIconCircle, { backgroundColor: '#F5C518' }]}>
                                            <Typography variant="label" weight="black" style={{ color: 'black', fontSize: 8 }}>IMDb</Typography>
                                        </View>
                                    }
                                />
                                <RatingCard
                                    source="rt"
                                    score="51%"
                                    label="Rotten Tomatoes"
                                    theme={theme}
                                    palette={colors}
                                    icon={<Star size={24} color="#00C853" fill="#00C853" />}
                                />
                            </ScrollView>
                        </View>
                    </View>
                </View>

                {/* Body Content (Actions like Cast, Episodes, etc.) */}
                <View style={[styles.body, { backgroundColor: DARK_BASE }]}>
                    {/* Removed original description and AI insights placeholder as they are now in hero */}


                    {enriched.director && (
                        <View style={{ marginTop: 16 }}>
                            <Typography variant="label" weight="black" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.5, fontSize: 11 }}>DIRECTOR:</Typography>
                            <Typography variant="label" weight="bold" style={{ color: theme.colors.onSurface, marginTop: 2 }}>{enriched.director}</Typography>
                        </View>
                    )}

                    {/* Cast Section */}
                    {enriched.cast && enriched.cast.length > 0 && (
                        <View style={styles.section}>
                            <Typography variant="h3" weight="black" style={styles.sectionTitle}>Cast</Typography>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                                {(enriched.cast || []).map((person) => (
                                    <CastItem
                                        key={person.id}
                                        person={person}
                                        theme={theme}
                                        palette={colors}
                                        onPress={() => router.push(`/person/${person.id}`)}
                                    />
                                ))}
                            </ScrollView>
                        </View>
                    )}


                    {/* Episodes Section (if series) */}
                    {isSeries && seasons.length > 0 && (
                        <View style={styles.section}>
                            <Typography variant="label" weight="black" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.5, marginBottom: 12 }}>SEASON</Typography>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
                                {seasons.map((s, idx) => (
                                    <ExpressiveSurface
                                        key={s}
                                        onPress={() => setActiveSeason(s)}
                                        selected={activeSeason === s}
                                        index={idx}
                                        activeIndex={seasons.indexOf(activeSeason)}
                                        rounding="3xl"
                                        variant="filled"
                                        style={[styles.seasonChip, activeSeason === s ? { backgroundColor: colors.lightVibrant } : { backgroundColor: hexToRgba(colors.vibrant, 0.16) }]}
                                    >
                                        <Typography
                                            variant="label"
                                            weight="bold"
                                            style={{ color: activeSeason === s ? 'black' : theme.colors.onSurface }}
                                        >
                                            {enriched?.seasons?.find(fs => fs.seasonNumber === s)?.name || `Season ${s}`}
                                        </Typography>
                                    </ExpressiveSurface>
                                ))}
                            </ScrollView>

                            <Typography variant="h3" weight="black" style={styles.sectionTitle}>Episodes</Typography>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                                {(seasonEpisodes.length > 0 ? seasonEpisodes : []).map((ep, idx) => (
                                    <EpisodeItem
                                        key={ep.id || idx}
                                        episode={ep}
                                        theme={theme}
                                        palette={colors}
                                        onPress={() => {
                                            setSelectedEpisode(ep);
                                            streamBottomSheetRef.current?.present();
                                        }}
                                    />
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Reviews Section */}
                    {enriched.reviews && enriched.reviews.length > 0 && (
                        <View style={styles.section}>
                            <Typography variant="h3" weight="black" style={styles.sectionTitle}>Reviews</Typography>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                                {(enriched.reviews || []).map((r) => (
                                    <ReviewCard
                                        key={r.id}
                                        review={r}
                                        theme={theme}
                                        palette={colors}
                                        onPress={() => {
                                            setSelectedReview(r);
                                            bottomSheetRef.current?.present();
                                        }}
                                    />
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Collection / Franchise Section */}
                    {enriched.collection && enriched.collection.parts && enriched.collection.parts.length > 0 && (
                        <View style={[styles.section, { marginHorizontal: -20 }]}>
                            <CatalogRow title={`${enriched.collection.name}`} items={enriched.collection.parts} />
                        </View>
                    )}

                    {/* More Like This (Similar) */}
                    {enriched.similar && enriched.similar.length > 0 && (
                        <View style={[styles.section, { marginHorizontal: -20 }]}>
                            <CatalogRow title="More Like This" items={enriched.similar} />
                        </View>
                    )}
                </View>

                <View style={{ height: 100 }} />
            </Animated.ScrollView>

            <CustomBottomSheet ref={bottomSheetRef} title="Summaries & AI Insights">
                <View style={{ paddingBottom: 40 }}>
                    <AIInsightsCarousel
                        insights={insights}
                        isLoading={isAiLoading}
                        onGenerate={() => generateInsights(enriched, enriched.reviews)}
                    />
                </View>
            </CustomBottomSheet>

            <CustomBottomSheet
                ref={streamBottomSheetRef}
                title={`Select Stream ${selectedEpisode ? `- S${activeSeason}:E${selectedEpisode.episode}` : ''}`}
                scrollable={false}
                enableDynamicSizing={true}
                maxHeight={Dimensions.get('window').height * 0.7}
            >
                <StreamSelector
                    type={isSeries ? 'series' : 'movie'}
                    id={getStreamId()}
                    onSelect={handleStreamSelect}
                    hideHeader={true}
                    onStreamsLoaded={setAvailableStreams}
                />
            </CustomBottomSheet>

            <CustomBottomSheet ref={bottomSheetRef} title="Review">
                {selectedReview && (
                    <View style={{ paddingHorizontal: 20 }}>
                        <View style={[styles.reviewHeader, { marginBottom: 16 }]}>
                            <ExpoImage
                                source={selectedReview.avatar ? { uri: selectedReview.avatar } : require('@/assets/images/icon.png')}
                                style={[styles.avatar, { width: 48, height: 48, borderRadius: 24 }]}
                            />
                            <View>
                                <Typography variant="h3" weight="bold" style={{ color: theme.colors.onSurface }}>
                                    {selectedReview.author}
                                </Typography>
                                {selectedReview.rating && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Star size={14} color="#F5C518" fill="#F5C518" />
                                        <Typography variant="label" weight="medium" style={{ color: theme.colors.primary }}>
                                            {selectedReview.rating}/10
                                        </Typography>
                                    </View>
                                )}
                            </View>
                        </View>
                        <Typography
                            variant="body"
                            style={{
                                color: theme.colors.onSurface,
                                lineHeight: 28,
                                fontSize: 17,
                                opacity: 0.9
                            }}
                        >
                            {selectedReview.content}
                        </Typography>
                    </View>
                )}
            </CustomBottomSheet>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    topBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 1000,
    },
    topRightActions: {
        flexDirection: 'row',
        gap: 12,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    parallaxLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: BACKDROP_HEIGHT,
        width: SCREEN_WIDTH,
        zIndex: 0,
    },
    heroImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    heroGradient: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    heroContent: {
        alignItems: 'center',
        gap: 16,
    },
    trailerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    heroLogo: {
        width: '100%',
        height: 100,
        marginBottom: 12,
        alignSelf: 'center',
    },
    heroTitle: {
        color: 'white',
        fontSize: 48,
        textAlign: 'center',
        lineHeight: 56,
        letterSpacing: -1,
    },
    metadataRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaBadge: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
    },
    metaText: {
        color: 'white',
        opacity: 0.9,
        fontSize: 14,
    },
    descriptionContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        width: '100%',
        marginTop: 8,
    },
    descriptionText: {
        color: 'white',
        opacity: 0.9,
        lineHeight: 20,
        fontSize: 14,
        flex: 1,
    },
    descriptionChevron: {
        marginLeft: 8,
    },
    actionStack: {
        width: '100%',
        marginTop: 16,
    },
    watchNowBtn: {
        height: 60,
        borderRadius: 30,
        backgroundColor: '#90CAF9', // Tonal blue matching the screenshot
    },
    iconActionRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-around',
        marginTop: 24,
        paddingHorizontal: 10,
    },
    iconActionItem: {
        alignItems: 'center',
        gap: 8,
    },
    iconActionLabel: {
        color: 'white',
        fontSize: 12,
        opacity: 0.8,
    },
    ratingsSection: {
        width: '100%',
        marginTop: 32,
    },
    sectionTitle: {
        color: 'white',
        fontSize: 20,
        marginBottom: 16,
    },
    ratingsScrollContent: {
        gap: 12,
    },
    ratingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 32,
        minWidth: 170,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    ratingIconContainer: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sourceIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ratingInfo: {
        marginLeft: 10,
        flex: 1,
    },
    ratingArrowContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    body: {
        paddingHorizontal: 20,
    },
    section: {
        marginTop: 32,
    },
    castItem: {
        width: 100,
        alignItems: 'center',
    },
    castImage: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: '#333',
    },
    episodeCard: {
        width: 280,
        height: 200,
        borderRadius: 20,
        overflow: 'hidden',
    },
    episodeThumb: {
        width: '100%',
        height: 110,
        backgroundColor: '#222',
    },
    episodeInfo: {
        padding: 10,
    },
    seasonChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    reviewCard: {
        width: 300,
        height: 140,
        padding: 16,
        borderRadius: 16,
        justifyContent: 'space-between',
    },
    reviewHeader: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#333',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 16,
    },
    modalClose: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
