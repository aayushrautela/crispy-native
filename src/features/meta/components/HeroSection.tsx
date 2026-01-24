import { TMDBMeta } from '@/src/core/services/TMDBService';
import { TrailerService } from '@/src/core/services/TrailerService';
import { LoadingIndicator } from '@/src/core/ui/LoadingIndicator';
import { Typography } from '@/src/core/ui/Typography';
import { adjustBrightness, isDarkColor } from '@/src/core/utils/colors';
import { TrailerPlayer } from '@/src/features/player/components/TrailerPlayer';
import { useTraktWatchState } from '@/src/features/trakt/hooks/useTraktWatchState';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, Play, RotateCcw, Star } from 'lucide-react-native';
import React, { memo, useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 750;
const BACKDROP_HEIGHT = 480;
const DARK_BASE = '#121212';

interface HeroSectionProps {
    meta: any;
    enriched: Partial<TMDBMeta>;
    colors: any;
    scrollY: Animated.SharedValue<number>;
    onWatchPress: () => void;
}

export const HeroSection = memo(({ meta, enriched, colors, scrollY, onWatchPress }: HeroSectionProps) => {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
    const [showTrailer, setShowTrailer] = useState(false);
    const trailerOpacity = useSharedValue(0);

    // Trailer Autoplay Logic
    React.useEffect(() => {
        let isMounted = true;
        let autoplayTimer: NodeJS.Timeout;

        const loadTrailer = async () => {
            const key = TrailerService.getFirstTrailerKey(enriched.videos || []);
            if (!key) return;

            const directUrl = await TrailerService.getTrailerFromYouTubeKey(key, enriched.title, enriched.year);
            if (directUrl && isMounted) {
                setTrailerUrl(directUrl);
                // Wait 2 seconds before showing
                autoplayTimer = setTimeout(() => {
                    if (isMounted) {
                        setShowTrailer(true);
                        trailerOpacity.value = withTiming(1, { duration: 800 });
                    }
                }, 2000);
            }
        };

        loadTrailer();

        return () => {
            isMounted = false;
            clearTimeout(autoplayTimer);
        };
    }, [enriched.videos, enriched.title, enriched.year]);

    const trailerAnimatedStyle = useAnimatedStyle(() => ({
        opacity: trailerOpacity.value,
    }));

    const { state, progress, isLoading, episode, lastWatchedAt } = useTraktWatchState(enriched.imdbId || meta?.id, meta?.type);

    const backdropUrl = enriched.backdrop || meta?.background || meta?.poster;

    const backdropStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateY: interpolate(scrollY.value, [0, HERO_HEIGHT], [0, -HERO_HEIGHT * 0.4], Extrapolation.CLAMP) },
                { scale: interpolate(scrollY.value, [-100, 0], [1.2, 1], Extrapolation.CLAMP) }
            ],
        };
    });

    const watchButtonLabel = useMemo(() => {
        if (state === 'continue') {
            const isSeries = meta?.type === 'series' || meta?.type === 'tv' || meta?.type === 'show';

            if (isSeries && episode) {
                return `Continue (S${episode.season} E${episode.number})`;
            }
            if (!isSeries && progress !== undefined) {
                return `Resume from ${Math.round(progress)}%`;
            }
            return 'Continue';
        }
        if (state === 'rewatch') return 'Rewatch';
        return 'Watch now';
    }, [state, progress, episode, meta?.type]);

    const watchButtonIcon = useMemo(() => {
        if (state === 'rewatch') return <RotateCcw size={20} color="black" />;
        return <Play size={20} color="black" fill="black" />;
    }, [state]);


    const watchButtonColor = useMemo(() => {
        if (isDarkColor(colors.lightVibrant)) {
            return colors.lightMuted;
        }
        return colors.lightVibrant;
    }, [colors]);

    const watchButtonSubtext = useMemo(() => {
        if (state === 'rewatch') {
            if (lastWatchedAt) {
                const date = new Date(lastWatchedAt);
                return `Last watched on ${date.toLocaleDateString()}`;
            }
            return null;
        }

        const runtime = enriched.runtimeMinutes;
        if (!runtime) return null;

        const percentageWatched = progress || 0;
        const remainingMinutes = Math.max(0, runtime * (1 - percentageWatched / 100));

        const now = new Date();
        const endsAt = new Date(now.getTime() + remainingMinutes * 60000);

        let formattedTime = endsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
        // remove space before am/pm if present to make it tighter or keep standard

        return `Ends at ${formattedTime}`;
    }, [state, progress, enriched.runtimeMinutes, lastWatchedAt]);



    return (
        <View style={styles.container}>
            {/* Parallax Layer */}
            <Animated.View style={[styles.parallaxLayer, backdropStyle]} pointerEvents="none">
                <ExpoImage source={{ uri: backdropUrl }} style={styles.heroImage} contentFit="cover" />

                {showTrailer && trailerUrl && (
                    <Animated.View style={[StyleSheet.absoluteFill, trailerAnimatedStyle]}>
                        <TrailerPlayer
                            url={trailerUrl}
                            style={styles.heroImage}
                            muted={true}
                        />
                    </Animated.View>
                )}

                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.4)', DARK_BASE]}
                    locations={[0, 0.6, 1]}
                    style={styles.heroGradient}
                />
            </Animated.View>

            {/* Spacer and Content Area */}
            <View style={{ minHeight: HERO_HEIGHT, paddingTop: 350 }}>
                <LinearGradient
                    colors={['transparent', DARK_BASE, DARK_BASE]}
                    locations={[0, 0.4, 1]}
                    style={styles.fadeOverlay}
                    pointerEvents="none"
                />

                <View style={styles.heroContent}>
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
                        {enriched.runtime && (
                            <Typography variant="label" style={styles.metaText}>{enriched.runtime}</Typography>
                        )}
                    </View>

                    {/* Description */}
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
                        <Pressable
                            onPress={onWatchPress}
                            style={({ pressed }) => [
                                styles.watchNowBtn,
                                {
                                    backgroundColor: watchButtonColor,
                                    opacity: pressed || isLoading ? 0.9 : 1,
                                    transform: [{ scale: pressed ? 0.98 : 1 }]
                                }
                            ]}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                    <LoadingIndicator color="black" size={36} />
                                </View>
                            ) : (
                                <>
                                    <View style={[styles.watchIconPill, { backgroundColor: adjustBrightness(watchButtonColor, 0.85) }]}>
                                        {watchButtonIcon}
                                    </View>
                                    <View style={styles.watchLabelContainer}>
                                        <View>
                                            <Typography variant="h4" weight="black" style={{ color: 'black', fontSize: 16, textAlign: 'center' }}>
                                                {watchButtonLabel}
                                            </Typography>
                                            {watchButtonSubtext && (
                                                <Typography variant="label" weight="bold" style={{ color: 'rgba(0,0,0,0.6)', fontSize: 11, textAlign: 'center', marginTop: -2 }}>
                                                    {watchButtonSubtext}
                                                </Typography>
                                            )}
                                        </View>
                                    </View>
                                </>
                            )}
                        </Pressable>

                    </View>
                </View>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        width: SCREEN_WIDTH,
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
    },
    heroGradient: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    fadeOverlay: {
        position: 'absolute',
        top: BACKDROP_HEIGHT - 150,
        left: 0,
        right: 0,
        bottom: 0,
    },
    heroContent: {
        alignItems: 'center',
        paddingHorizontal: 20,
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
        width: '100%',
        alignItems: 'center',
    },
    descriptionText: {
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        lineHeight: 22,
        fontSize: 14,
    },
    descriptionChevron: {
        marginTop: 8,
    },
    actionStack: {
        width: '100%',
        marginTop: 8,
    },
    watchNowBtn: {
        width: '100%',
        height: 68,
        borderRadius: 34,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
    },
    watchIconPill: {
        width: 60,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    watchLabelContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 60, // Balance visual weight of left icon
    },
    secondaryActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        gap: 16,
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
    }
});
