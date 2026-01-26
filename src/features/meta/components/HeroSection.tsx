import { TMDBMeta } from '@/src/core/services/TMDBService';
import { TrailerService } from '@/src/core/services/TrailerService';
import { LoadingIndicator } from '@/src/core/ui/LoadingIndicator';
import { Typography } from '@/src/core/ui/Typography';
import { adjustBrightness, isDarkColor } from '@/src/core/utils/colors';
import { YouTubeTrailer } from '@/src/features/player/components/YouTubeTrailer';
import { useTraktWatchState } from '@/src/features/trakt/hooks/useTraktWatchState';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, Play, RotateCcw, Star } from 'lucide-react-native';
import React, { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { useResponsive } from '@/src/core/hooks/useResponsive';

const HERO_HEIGHT = 600;
const BACKDROP_HEIGHT = 420;
const DARK_BASE = '#121212';

interface HeroSectionProps {
    meta: any;
    enriched: Partial<TMDBMeta>;
    colors: any;
    scrollY: Animated.SharedValue<number>;
    onWatchPress: () => void;
    isMuted?: boolean;
}

export const HeroSection = memo(({ meta, enriched, colors, scrollY, onWatchPress, isMuted = true }: HeroSectionProps) => {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [trailerKey, setTrailerKey] = useState<string | null>(null);
    const [showTrailer, setShowTrailer] = useState(false); // Controls mounting
    const [revealTrailer, setRevealTrailer] = useState(false); // Controls visibility (opacity)
    const [isPlaying, setIsPlaying] = useState(true);

    const { width, isTablet } = useResponsive();

    // Play/Pause based on visibility
    useAnimatedReaction(
        () => scrollY.value > HERO_HEIGHT,
        (isOut, prevIsOut) => {
            if (isOut !== prevIsOut) {
                runOnJS(setIsPlaying)(!isOut);
            }
        },
        [HERO_HEIGHT]
    );

    // Trailer Autoplay Logic
    React.useEffect(() => {
        const key = TrailerService.getFirstTrailerKey(enriched.videos || []);
        setTrailerKey(key);

        let mountTimer: NodeJS.Timeout;
        let revealTimer: NodeJS.Timeout;

        if (key) {
            // 1. Mount after 2s (allows initial UI render/animations to settle)
            mountTimer = setTimeout(() => {
                setShowTrailer(true);
            }, 2000);

            // 2. Reveal after 4s (gives 2s for YouTube to buffer/load)
            revealTimer = setTimeout(() => {
                setRevealTrailer(true);
            }, 4000);
        }

        return () => {
            clearTimeout(mountTimer);
            clearTimeout(revealTimer);
        };
    }, [enriched.videos]);

    const toggleTrailer = () => {
        if (trailerKey) {
            if (revealTrailer) {
                // If visible, hide it (manual toggle)
                setRevealTrailer(false);
                setShowTrailer(false); // Also unmount to stop audio
            } else {
                // If hidden, show immediately
                setShowTrailer(true);
                setRevealTrailer(true);
            }
        }
    };

    const { state, progress, isLoading, episode, lastWatchedAt } = useTraktWatchState(enriched.imdbId || meta?.id, meta?.type);

    const backdropUrl = enriched.backdrop || meta?.background || meta?.poster;

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
        <View style={[styles.container, { width }]}>
            {/* Static Background Layer */}
            <View style={[styles.staticBackdrop, { width }]}>
                <ExpoImage source={{ uri: backdropUrl }} style={styles.heroImage} contentFit="cover" />

                {showTrailer && trailerKey && (
                    <View style={StyleSheet.absoluteFill}>
                        <YouTubeTrailer videoId={trailerKey} isMuted={isMuted} isPlaying={isPlaying} isVisible={revealTrailer} />
                    </View>
                )}

                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.4)', DARK_BASE]}
                    locations={[0, 0.6, 1]}
                    style={styles.heroGradient}
                />
            </View>

            {/* Content Area */}
            <View style={{ minHeight: HERO_HEIGHT, paddingTop: 350 }}>
                <LinearGradient
                    colors={['transparent', DARK_BASE, DARK_BASE]}
                    locations={[0, 0.4, 1]}
                    style={styles.fadeOverlay}
                    pointerEvents="none"
                />

                <View style={[styles.heroContent, { width: '100%' }, isTablet && { maxWidth: 600, alignSelf: 'center' }]}>
                    {/* Trailer Button */}
                    <Pressable
                        style={[styles.trailerBtn, !trailerKey && { opacity: 0.5 }]}
                        onPress={toggleTrailer}
                        disabled={!trailerKey}
                    >
                        <Play size={14} color="white" fill={showTrailer ? "white" : "transparent"} />
                        <Typography variant="label" weight="bold" style={{ color: 'white', marginLeft: 4 }}>
                            {showTrailer ? 'Pause' : 'Trailer'}
                        </Typography>
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
                        {enriched.rating && (
                            <View style={styles.metaItem}>
                                <Star size={14} color="#FFD700" fill="#FFD700" />
                                <Typography variant="label" weight="black" style={{ color: 'white', marginLeft: 4 }}>
                                    {Number(enriched.rating).toFixed(1)}
                                </Typography>
                            </View>
                        )}
                        {enriched.maturityRating && (
                            <View style={styles.metaBadge}>
                                <Typography variant="label" weight="black" style={{ color: 'white', fontSize: 10 }}>
                                    {enriched.maturityRating}
                                </Typography>
                            </View>
                        )}
                        {enriched.year && (
                            <Typography variant="label" style={styles.metaText}>{enriched.year}</Typography>
                        )}
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
        // width set dynamically
    },
    staticBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: BACKDROP_HEIGHT,
        // width set dynamically
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
