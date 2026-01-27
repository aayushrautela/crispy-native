
import { useResponsive } from '@/src/core/hooks/useResponsive';
import { TMDBMeta } from '@/src/core/services/TMDBService';
import { LoadingIndicator } from '@/src/core/ui/LoadingIndicator';
import { Typography } from '@/src/core/ui/Typography';
import { useHeroState } from '@/src/features/meta/hooks/useHeroState';
import { YouTubeTrailer } from '@/src/features/player/components/YouTubeTrailer';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, Play, Star } from 'lucide-react-native';
import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { MetaActionRow } from './MetaActionRow';
import { SplitHeroLayout } from './SplitHeroLayout';

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
    // Trakt Props for Split Mode
    isAuthenticated?: boolean;
    isListed?: boolean;
    isCollected?: boolean;
    isWatched?: boolean;
    isSeries?: boolean;
    userRating?: number | null;
    onWatchlistToggle?: () => void;
    onCollectionToggle?: () => void;
    onWatchedToggle?: () => void;
    onRatePress?: () => void;
}

/**
 * SUB-COMPONENT: HeroBackdrop
 */
const HeroBackdrop = memo(({
    backdropUrl, trailerKey, showTrailer, isMuted, isPlaying, revealTrailer, width, height = BACKDROP_HEIGHT, showBottomFade = true
}: any) => (
    <View style={[styles.staticBackdrop, { width, height }]}>
        <ExpoImage source={{ uri: backdropUrl }} style={styles.heroImage} contentFit="cover" />
        {showTrailer && trailerKey && (
            <View style={StyleSheet.absoluteFill}>
                <YouTubeTrailer videoId={trailerKey} isMuted={isMuted} isPlaying={isPlaying} isVisible={revealTrailer} />
            </View>
        )}
        {showBottomFade && (
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.4)', DARK_BASE]}
                locations={[0, 0.6, 1]}
                style={styles.heroGradient}
            />
        )}
    </View>
));

/**
 * SUB-COMPONENT: HeroMetadata
 */
const HeroMetadata = memo(({ enriched, alignment = 'center' }: { enriched: Partial<TMDBMeta>, meta?: any, alignment?: 'center' | 'flex-start' }) => (
    <View style={[styles.metadataRow, { justifyContent: alignment === 'center' ? 'center' : 'flex-start' }]}>
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
        {enriched.year && <Typography variant="label" style={styles.metaText}>{enriched.year}</Typography>}
        {enriched.runtime && <Typography variant="label" style={styles.metaText}>{enriched.runtime}</Typography>}
    </View>
));

/**
 * SUB-COMPONENT: HeroWatchButton
 */
const HeroWatchButton = memo(({
    onPress, isLoading, color, label, subtext, icon, pillColor
}: any) => (
    <Pressable
        onPress={onPress}
        style={({ pressed }) => [
            styles.watchNowBtn,
            { backgroundColor: color, opacity: pressed || isLoading ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }
        ]}
        disabled={isLoading}
    >
        {isLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <LoadingIndicator color="black" size={36} />
            </View>
        ) : (
            <>
                <View style={[styles.watchIconPill, { backgroundColor: pillColor }]}>
                    {icon}
                </View>
                <View style={styles.watchLabelContainer}>
                    <View>
                        <Typography variant="h4" weight="black" style={{ color: 'black', fontSize: 16, textAlign: 'center' }}>
                            {label}
                        </Typography>
                        {subtext && (
                            <Typography variant="label" weight="bold" style={{ color: 'rgba(0,0,0,0.6)', fontSize: 11, textAlign: 'center', marginTop: -2 }}>
                                {subtext}
                            </Typography>
                        )}
                    </View>
                </View>
            </>
        )}
    </Pressable>
));

/**
 * SUB-COMPONENT: HeroIdentity
 */
const HeroIdentity = memo(({ enriched, meta, alignment = 'center' }: any) => (
    <>
        {enriched.logo ? (
            <ExpoImage source={{ uri: enriched.logo }} style={[styles.heroLogo, alignment === 'flex-start' && { alignSelf: 'flex-start' }]} contentFit="contain" />
        ) : (
            <Typography variant="h1" weight="black" style={[styles.heroTitle, alignment === 'flex-start' && { textAlign: 'left', fontSize: 36, lineHeight: 44 }]}>
                {(enriched.title || meta?.name)?.toUpperCase()}
            </Typography>
        )}
    </>
));

/**
 * SUB-COMPONENT: HeroDescription
 */
const HeroDescription = memo(({ enriched, meta, isExpanded, onToggle, alignment = 'center' }: any) => (
    <Pressable
        onPress={onToggle}
        style={[styles.descriptionContainer, alignment === 'flex-start' && { alignItems: 'flex-start' }]}
    >
        <Typography variant="body" numberOfLines={isExpanded ? undefined : 3} style={[styles.descriptionText, alignment === 'flex-start' && { textAlign: 'left' }]}>
            {enriched.description || meta?.description}
        </Typography>
        <ChevronDown
            size={20} color="white"
            style={[styles.descriptionChevron, { transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }]}
        />
    </Pressable>
));

/**
 * MAIN COMPONENT: HeroSection
 */
export const HeroSection = memo(({
    meta, enriched, colors, scrollY, onWatchPress, isMuted = true,
    isAuthenticated, isListed, isCollected, isWatched, isSeries, userRating,
    onWatchlistToggle, onCollectionToggle, onWatchedToggle, onRatePress
}: HeroSectionProps) => {
    const { width, isTablet, isLandscape } = useResponsive();
    const {
        isDescriptionExpanded, setIsDescriptionExpanded, trailerKey, showTrailer, revealTrailer,
        isPlaying, isLoading, watchButtonLabel, watchButtonIcon, watchButtonColor, watchButtonSubtext,
        pillColor, toggleTrailer
    } = useHeroState({ meta, enriched, colors, scrollY, heroHeight: HERO_HEIGHT });

    const backdropUrl = enriched.backdrop || meta?.background || meta?.poster;
    const isSplitLayout = isTablet && isLandscape;

    if (isSplitLayout) {
        return (
            <SplitHeroLayout
                DARK_BASE={DARK_BASE}
                leftNode={
                    <>
                        <HeroBackdrop
                            backdropUrl={backdropUrl} trailerKey={trailerKey} showTrailer={showTrailer}
                            isMuted={isMuted} isPlaying={isPlaying} revealTrailer={revealTrailer} width="100%" height="100%"
                            showBottomFade={false}
                        />
                        <View style={styles.leftPaneOverlay}>
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
                            {enriched.logo && (
                                <ExpoImage source={{ uri: enriched.logo }} style={styles.leftPaneLogo} contentFit="contain" />
                            )}
                        </View>
                    </>
                }
                rightNode={
                    <>
                        {/* Force text-only identity for the right pane */}
                        <HeroIdentity enriched={{ ...enriched, logo: undefined }} meta={meta} />
                        <HeroMetadata enriched={enriched} />
                        <HeroDescription
                            enriched={enriched} meta={meta}
                            isExpanded={isDescriptionExpanded}
                            onToggle={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                        />
                        <View style={{ gap: 24, marginTop: 12, width: '100%', alignItems: 'center' }}>
                            <HeroWatchButton
                                onPress={onWatchPress} isLoading={isLoading} color={watchButtonColor}
                                label={watchButtonLabel} subtext={watchButtonSubtext} icon={watchButtonIcon}
                                pillColor={pillColor}
                            />
                            {/* In Split mode, we move the action row here */}
                            <MetaActionRow
                                style={{ gap: 24 }}
                                isAuthenticated={!!isAuthenticated}
                                isListed={!!isListed}
                                isCollected={!!isCollected}
                                isWatched={!!isWatched}
                                isSeries={!!isSeries}
                                userRating={userRating ?? null}
                                onWatchlistToggle={onWatchlistToggle!}
                                onCollectionToggle={onCollectionToggle!}
                                onWatchedToggle={onWatchedToggle!}
                                onRatePress={onRatePress!}
                            />
                        </View>
                    </>
                }
            />
        );
    }

    return (
        <View style={[styles.container, { width }]}>
            <HeroBackdrop
                backdropUrl={backdropUrl} trailerKey={trailerKey} showTrailer={showTrailer}
                isMuted={isMuted} isPlaying={isPlaying} revealTrailer={revealTrailer} width={width}
            />

            <View style={{ minHeight: HERO_HEIGHT, paddingTop: 350 }}>
                <LinearGradient
                    colors={['transparent', DARK_BASE, DARK_BASE]}
                    locations={[0, 0.4, 1]}
                    style={styles.fadeOverlay}
                    pointerEvents="none"
                />

                <View style={[styles.heroContent, { width: '100%' }, isTablet && { maxWidth: 600, alignSelf: 'center' }]}>
                    {/* Trailer Action */}
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

                    <HeroIdentity enriched={enriched} meta={meta} />
                    <HeroMetadata enriched={enriched} />

                    <HeroDescription
                        enriched={enriched} meta={meta}
                        isExpanded={isDescriptionExpanded}
                        onToggle={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    />

                    <View style={styles.actionStack}>
                        <HeroWatchButton
                            onPress={onWatchPress} isLoading={isLoading} color={watchButtonColor}
                            label={watchButtonLabel} subtext={watchButtonSubtext} icon={watchButtonIcon}
                            pillColor={pillColor}
                        />
                    </View>
                </View>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {},
    staticBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, height: BACKDROP_HEIGHT, zIndex: 0 },
    heroImage: { width: '100%', height: '100%' },
    heroGradient: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
    fadeOverlay: { position: 'absolute', top: BACKDROP_HEIGHT - 150, left: 0, right: 0, bottom: 0 },
    heroContent: { alignItems: 'center', paddingHorizontal: 20, gap: 16 },
    trailerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    heroLogo: { width: '100%', height: 100, marginBottom: 12, alignSelf: 'center' },
    heroTitle: { color: 'white', fontSize: 48, textAlign: 'center', lineHeight: 56, letterSpacing: -1 },
    metadataRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    metaItem: { flexDirection: 'row', alignItems: 'center' },
    metaBadge: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    metaText: { color: 'white', opacity: 0.9, fontSize: 14 },
    descriptionContainer: { width: '100%', alignItems: 'center' },
    descriptionText: { color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22, fontSize: 14 },
    descriptionChevron: { marginTop: 8 },
    actionStack: { width: '100%', marginTop: 8 },
    watchNowBtn: { width: '100%', height: 68, borderRadius: 34, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
    watchIconPill: { width: 60, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    watchLabelContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginRight: 60 },
    leftPaneOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 12,
        paddingBottom: 48,
        maxWidth: '100%',
        backgroundColor: 'rgba(0,0,0,0.15)', // Subtle darkening for logo readability
    },
    leftPaneLogo: {
        width: 480,
        height: 140,
    },
});
