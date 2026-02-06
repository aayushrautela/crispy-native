import { MetaPreview } from '@/src/core/services/AddonService';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { Typography } from '@/src/core/ui/Typography';
import { useCatalogActions } from '@/src/features/catalog/context/CatalogActionsContext';
import { useTraktEnrichment } from '@/src/hooks/useTraktEnrichment';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

function formatBadgeRating(value: unknown): string | null {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;

    // Format to 1 decimal place and strip trailing .0 to prevent Android clipping
    return parseFloat(n.toFixed(1)).toString();
}

interface ContinueWatchingCardProps {
    item: MetaPreview;
    width?: number;
}

const ContinueWatchingCardComponent = ({ item, width = 144 }: ContinueWatchingCardProps) => {
    const router = useRouter();
    const { theme } = useTheme();
    const settings = useUserStore(s => s.settings);
    const { openActions } = useCatalogActions();

    // Always enrich Continue Watching items
    const displayItem = useTraktEnrichment(item);
    const displayAny = displayItem as any;

    const aspectRatio = displayItem.posterShape === 'landscape' ? 16 / 9 : displayItem.posterShape === 'square' ? 1 : 2 / 3;
    const height = width / aspectRatio;

    const imageSrc = displayItem.posterShape === 'landscape'
        ? (displayItem.backdrop || displayItem.poster)
        : (displayItem.poster);

    const handlePress = useCallback(() => {
        router.push({
            pathname: '/meta/[id]' as any,
            params: { id: item.id, type: item.type }
        });
    }, [item.id, item.type, router]);

    const handleLongPress = useCallback(() => {
        openActions(item);
    }, [item, openActions]);

    return (
        <View style={[styles.container, { width }]}>
            <Pressable
                onPress={handlePress}
                onLongPress={handleLongPress}
                accessibilityRole="button"
                android_ripple={{ color: 'rgba(255,255,255,0.08)', borderless: false }}
                style={({ pressed }) => [
                    styles.surface,
                    {
                        height,
                        backgroundColor: (theme.colors as any).surfaceContainerHighest || theme.colors.surfaceVariant,
                    },
                    pressed && styles.surfacePressed,
                ]}
            >
                <View style={styles.imageContainer}>
                    {imageSrc ? (
                        <ExpoImage
                            recyclingKey={displayItem.id}
                            source={{ uri: imageSrc }}
                            style={styles.image}
                            contentFit="cover"
                            transition={Platform.OS === 'android' ? 0 : 150}
                            cachePolicy="memory-disk"
                        />
                    ) : null}

                    {/* Logo Overlay */}
                    {(displayItem.posterShape === 'landscape' && displayItem.logo) ? (
                        <View style={styles.logoOverlay}>
                            <ExpoImage
                                recyclingKey={`${displayItem.id}-logo`}
                                source={{ uri: displayItem.logo }}
                                style={styles.logo}
                                contentFit="contain"
                                transition={Platform.OS === 'android' ? 0 : 150}
                                cachePolicy="memory-disk"
                            />
                        </View>
                    ) : null}

                    {/* Rating Overlay */}
                    {(() => {
                        if (!settings.showRatingBadges) return null;
                        const ratingText = formatBadgeRating(displayAny.imdbRating ?? displayAny.rating ?? displayAny.meta?.rating);
                        if (!ratingText) return null;

                        return (
                            <View style={styles.ratingOverlay}>
                                <Star size={10} color="#FFD700" fill="#FFD700" />
                                <Typography
                                    variant="label-small"
                                    weight="black"
                                    style={{
                                        color: 'white',
                                        marginLeft: 4,
                                        letterSpacing: 0,
                                        paddingRight: 2,
                                    }}
                                >
                                    {ratingText}
                                </Typography>
                            </View>
                        );
                    })()}

                    {/* Progress Bar - Exclusive to Continue Watching */}
                    {item.progressPercent !== undefined && item.progressPercent > 0 ? (
                        <View style={styles.progressTrack}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        width: `${item.progressPercent}%`,
                                        backgroundColor: theme.colors.primary,
                                    }
                                ]}
                            />
                        </View>
                    ) : null}
                </View>
            </Pressable>

            {/* Metadata */}
            <View style={styles.metadata}>
                <Typography
                    variant="body-small"
                    weight="bold"
                    numberOfLines={1}
                    style={{ color: theme.colors.onSurface }}
                >
                    {(() => {
                        if (displayItem.season !== undefined && displayItem.episodeNumber !== undefined) {
                            return `S${displayItem.season}E${displayItem.episodeNumber}: ${displayItem.episodeTitle || displayItem.name}`;
                        }
                        return displayItem.name;
                    })()}
                </Typography>
                <View style={styles.badgeRow}>
                    <Typography
                        variant="label-small"
                        weight="medium"
                        numberOfLines={1}
                        style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}
                    >
                        {(() => {
                            const isEpisode = displayItem.season !== undefined && displayItem.episodeNumber !== undefined;
                            let dateStr = displayItem.airDate || displayItem.meta?.year || displayItem.releaseInfo || displayItem.year;

                            if (isEpisode && displayItem.airDate) {
                                try {
                                    const date = new Date(displayItem.airDate);
                                    dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                                } catch (e) {
                                    dateStr = displayItem.airDate.split('-')[0];
                                }
                            } else if (dateStr && dateStr.includes('-')) {
                                dateStr = dateStr.split('-')[0];
                            }

                            return dateStr;
                        })()}
                    </Typography>
                    {(displayItem.genres?.[0] || displayItem.meta?.genres?.[0]) && (
                        <View style={[styles.genrePill, { backgroundColor: (theme.colors.primary + '20') || theme.colors.surfaceVariant }]}>
                            <Typography
                                variant="label-small"
                                weight="black"
                                style={{ color: theme.colors.primary, fontSize: 9 }}
                            >
                                {(displayItem.genres?.[0] || displayItem.meta?.genres?.[0])}
                            </Typography>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

export const ContinueWatchingCard = React.memo(ContinueWatchingCardComponent, (prev, next) => {
    return (
        prev.item.id === next.item.id &&
        prev.item.type === next.item.type &&
        prev.width === next.width &&
        prev.item.progressPercent === next.item.progressPercent
    );
});

const styles = StyleSheet.create({
    container: {
        gap: 8,
    },
    surface: {
        overflow: 'hidden',
        borderRadius: 12,
    },
    surfacePressed: {
        transform: [{ scale: 0.985 }],
        opacity: 0.92,
    },
    imageContainer: {
        flex: 1,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
        zIndex: 1,
    },
    logoOverlay: {
        position: 'absolute',
        inset: 0,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 10,
    },
    logo: {
        width: '70%',
        height: '50%',
    },
    ratingOverlay: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.8)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        zIndex: 10,
    },
    metadata: {
        gap: 2,
        paddingHorizontal: 0,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    genrePill: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
    },
    progressTrack: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
        zIndex: 10,
    },
    progressFill: {
        height: '100%',
    },
});
