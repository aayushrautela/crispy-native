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
import { ArrowLeft, List, Play, Star } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
const HERO_HEIGHT = 550;

const CastItem = ({ person, theme, onPress }: { person: any; theme: any; onPress: () => void }) => {
    return (
        <Pressable onPress={onPress}>
            <View style={styles.castItem}>
                <ExpoImage
                    source={person.profile ? { uri: person.profile } : require('@/assets/images/icon.png')}
                    style={styles.castImage}
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
};

const EpisodeItem = ({ episode, theme, onPress }: { episode: any; theme: any; onPress: () => void }) => {
    return (
        <Pressable onPress={onPress}>
            <View style={[styles.episodeCard, { backgroundColor: theme.colors.surfaceVariant }]}>
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
};

const ReviewCard = ({ review, theme, onPress }: { review: any; theme: any; onPress: () => void }) => {
    if (!review) return null;

    return (
        <Pressable onPress={onPress}>
            <View style={[styles.reviewCard, { backgroundColor: theme.colors.surfaceVariant }]}>
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
};

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
            url: stream.url,
            title: meta?.name || 'Video',
        };

        if (stream.infoHash) {
            params.infoHash = stream.infoHash;
            if (stream.fileIdx !== undefined) params.fileIdx = stream.fileIdx;
        }

        if (stream.behaviorHints && stream.behaviorHints.headers) {
            params.headers = JSON.stringify(stream.behaviorHints.headers);
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

    const backdropUrl = enriched.backdrop || meta?.background || meta?.poster;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Layer 1: Parallax Backdrop (Fixed at back) */}
            <Animated.View style={[styles.parallaxLayer, backdropStyle]} pointerEvents="none">
                <ExpoImage source={{ uri: backdropUrl }} style={styles.heroImage} contentFit="cover" />
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.4)', theme.colors.background]}
                    locations={[0, 0.6, 1]}
                    style={styles.heroGradient}
                />
            </Animated.View>

            {/* Standardized Android Back Button (Floating on top) */}
            <View style={[styles.backButtonOverlay, { top: insets.top + 8 }]}>
                <Pressable
                    onPress={() => router.back()}
                    style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                >
                    <ArrowLeft color="white" size={24} />
                </Pressable>
            </View>

            {/* Layer 2: Scrolling Content */}
            <Animated.ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                style={{ zIndex: 1 }}
            >
                {/* Transparent Spacer for Hero Height */}
                <View style={{ height: HERO_HEIGHT, justifyContent: 'flex-end', paddingBottom: 40, paddingHorizontal: 20 }}>
                    <View style={styles.heroContent}>
                        {enriched.logo ? (
                            <ExpoImage source={{ uri: enriched.logo }} style={styles.logo} contentFit="contain" />
                        ) : (
                            <Typography variant="h1" weight="black" style={{ color: 'white', marginBottom: 8, fontSize: 32 }}>
                                {enriched.title || meta?.name}
                            </Typography>
                        )}

                        <View style={styles.metaRow}>
                            <Typography variant="label" weight="bold" style={{ color: 'white' }}>{enriched.year || meta?.releaseInfo || 'TBA'}</Typography>
                            {enriched.maturityRating && (
                                <View style={[styles.ratingBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                    <Typography variant="label" weight="black" style={{ color: 'white' }}>{enriched.maturityRating}</Typography>
                                </View>
                            )}
                            <Typography variant="label" style={{ color: 'white' }}>{meta?.runtime || '45 min'}</Typography>
                            <Typography variant="label" style={{ color: 'white', opacity: 0.8 }} numberOfLines={1}>
                                • {enriched.genres?.slice(0, 3).join(' • ') || 'Drama'}
                            </Typography>
                        </View>

                        <View style={styles.imdbRow}>
                            <View style={styles.imdbBadge}>
                                <Typography variant="label" weight="black" style={{ color: 'black', fontSize: 10 }}>IMDb</Typography>
                            </View>
                            <Typography variant="label" weight="bold" style={{ color: 'white', marginLeft: 6 }}>{enriched.rating || '8.5'}</Typography>
                        </View>

                        <View style={styles.actionRow}>
                            <ExpressiveButton
                                title="Watch Now"
                                variant="primary"
                                onPress={() => {
                                    if (isSeries && !selectedEpisode && seasonEpisodes.length > 0) {
                                        setSelectedEpisode(seasonEpisodes[0]);
                                    }
                                    streamBottomSheetRef.current?.present();
                                }}
                                icon={<Play size={20} color="black" fill="black" />}
                                style={styles.primaryWatchBtn}
                                textStyle={{ color: 'black', fontWeight: '900' }}
                            />
                            <ExpressiveSurface variant="filled" rounding="lg" style={styles.listBtn}>
                                <List size={24} color="white" />
                            </ExpressiveSurface>
                        </View>
                    </View>
                </View>

                {/* Gradient Fade for Body Start */}
                <LinearGradient
                    colors={['transparent', theme.colors.background]}
                    style={{ height: 100, marginTop: -100 }}
                    pointerEvents="none"
                />

                {/* Body Content (Opaque) */}
                <View style={[styles.body, { backgroundColor: theme.colors.background }]}>

                    <Typography variant="body" weight="medium" style={{ color: 'white', opacity: 0.8, lineHeight: 22, fontSize: 15 }}>
                        {enriched.description || meta?.description}
                    </Typography>

                    {/* AI Insights Section */}
                    <View style={{ marginTop: 24, marginBottom: 8 }}>
                        <AIInsightsCarousel
                            insights={insights}
                            isLoading={isAiLoading}
                            onGenerate={() => generateInsights(enriched, enriched.reviews)}
                        />
                    </View>

                    {enriched.director && (
                        <View style={{ marginTop: 16 }}>
                            <Typography variant="label" weight="black" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.5, fontSize: 11 }}>DIRECTOR:</Typography>
                            <Typography variant="label" weight="bold" style={{ color: theme.colors.onSurface, marginTop: 2 }}>{enriched.director}</Typography>
                        </View>
                    )}

                    {/* Cast Section */}
                    {enriched.cast && enriched.cast.length > 0 && (
                        <View style={styles.section}>
                            <Typography variant="h3" weight="black" style={{ color: theme.colors.onSurface, marginBottom: 16 }}>Cast</Typography>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                                {(enriched.cast || []).map((person) => (
                                    <CastItem
                                        key={person.id}
                                        person={person}
                                        theme={theme}
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
                                        style={styles.seasonChip}
                                    >
                                        <Typography
                                            variant="label"
                                            weight="bold"
                                            style={{ color: activeSeason === s ? theme.colors.onPrimary : theme.colors.onSurface }}
                                        >
                                            {enriched?.seasons?.find(fs => fs.seasonNumber === s)?.name || `Season ${s}`}
                                        </Typography>
                                    </ExpressiveSurface>
                                ))}
                            </ScrollView>

                            <Typography variant="h3" weight="black" style={{ color: theme.colors.onSurface, marginVertical: 16 }}>Episodes</Typography>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                                {(seasonEpisodes.length > 0 ? seasonEpisodes : []).map((ep, idx) => (
                                    <EpisodeItem
                                        key={ep.id || idx}
                                        episode={ep}
                                        theme={theme}
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
                            <Typography variant="h3" weight="black" style={{ color: theme.colors.onSurface, marginBottom: 16 }}>Reviews</Typography>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                                {(enriched.reviews || []).map((r) => (
                                    <ReviewCard
                                        key={r.id}
                                        review={r}
                                        theme={theme}
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

            <CustomBottomSheet ref={streamBottomSheetRef} title={`Select Stream ${selectedEpisode ? `- S${activeSeason}:E${selectedEpisode.episode}` : ''}`} snapPoints={['60%', '90%']}>
                <StreamSelector
                    type={isSeries ? 'series' : 'movie'}
                    id={getStreamId()}
                    onSelect={handleStreamSelect}
                    hideHeader={true}
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
    backButtonOverlay: {
        position: 'absolute',
        left: 16,
        zIndex: 1000,
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
        height: HERO_HEIGHT,
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
        gap: 12,
    },
    logo: {
        width: 280,
        height: 100,
        marginBottom: 8,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    ratingBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    imdbRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    imdbBadge: {
        backgroundColor: '#F5C518',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 2,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    primaryWatchBtn: {
        flex: 1,
        height: 54,
        borderRadius: 32,
        backgroundColor: 'white',
    },
    listBtn: {
        width: 54,
        height: 54,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    body: {
        paddingHorizontal: 20,
        paddingTop: 12, // Tighter top body
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
