import { MetaPreview } from '@/src/core/services/AddonService';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { Typography } from '@/src/core/ui/Typography';
import { useCatalogActions } from '@/src/features/catalog/context/CatalogActionsContext';
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

interface CatalogCardProps {
    item: MetaPreview;
    width?: number;
}

const CatalogCardComponent = ({ item, width = 144 }: CatalogCardProps) => {
    const router = useRouter();
    const { theme } = useTheme();
    const settings = useUserStore(s => s.settings);
    const { openActions } = useCatalogActions();

    // Pure Component: No enrichment hook. 
    // We display exactly what is passed in 'item'.
    const displayItem = item;
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
                </View>
            </Pressable>

            <View style={styles.metadata}>
                <Typography
                    variant="body-small"
                    weight="bold"
                    numberOfLines={1}
                    style={{ color: theme.colors.onSurface }}
                >
                    {displayItem.name}
                </Typography>
                <View style={styles.badgeRow}>
                    <Typography
                        variant="label-small"
                        weight="medium"
                        numberOfLines={1}
                        style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}
                    >
                        {(() => {
                            // Simple Year Fallback
                            const year = displayAny.year || displayAny.meta?.year || displayAny.releaseInfo?.split('-')[0] || '';
                            return year;
                        })()}
                    </Typography>
                    {(displayItem.genres?.[0] || displayAny.meta?.genres?.[0]) && (
                        <View style={[styles.genrePill, { backgroundColor: (theme.colors.primary + '20') || theme.colors.surfaceVariant }]}>
                            <Typography
                                variant="label-small"
                                weight="black"
                                style={{ color: theme.colors.primary, fontSize: 9 }}
                            >
                                {(displayItem.genres?.[0] || displayAny.meta?.genres?.[0])}
                            </Typography>
                        </View>
                    )}
                </View>
            </View>

        </View>
    );
};

export const CatalogCard = React.memo(CatalogCardComponent, (prev, next) => {
    return (
        prev.item.id === next.item.id &&
        prev.item.type === next.item.type &&
        prev.width === next.width
    );
});

interface CatalogCardSkeletonProps {
    width?: number;
    posterShape?: 'poster' | 'landscape' | 'square';
}

const CatalogCardSkeletonComponent = ({ width = 144, posterShape = 'poster' }: CatalogCardSkeletonProps) => {
    const { theme } = useTheme();
    const aspectRatio = posterShape === 'landscape' ? 16 / 9 : posterShape === 'square' ? 1 : 2 / 3;
    const height = width / aspectRatio;

    const surfaceColor = (theme.colors as any).surfaceContainerHighest || theme.colors.surfaceVariant;
    const lineColor = (theme.colors as any).surfaceContainerLow || theme.colors.surfaceVariant;

    return (
        <View style={[styles.container, { width }]}>
            <View style={[styles.surface, { height, backgroundColor: surfaceColor }]} />
            <View style={styles.metadata}>
                <View style={[styles.skeletonLine, { width: '78%', backgroundColor: lineColor }]} />
                <View style={[styles.skeletonLine, { width: '52%', backgroundColor: lineColor, opacity: 0.75 }]} />
            </View>
        </View>
    );
};

CatalogCardSkeletonComponent.displayName = 'CatalogCardSkeleton';

export const CatalogCardSkeleton = React.memo(CatalogCardSkeletonComponent);

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
    skeletonLine: {
        height: 10,
        borderRadius: 6,
    },
});
