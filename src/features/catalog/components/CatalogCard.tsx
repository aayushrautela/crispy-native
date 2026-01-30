import { MetaPreview } from '@/src/core/services/AddonService';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { ExpressiveSurface } from '@/src/core/ui/ExpressiveSurface';
import { Typography } from '@/src/core/ui/Typography';
import { useCatalogActions } from '@/src/features/catalog/context/CatalogActionsContext';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedExpoImage = Animated.createAnimatedComponent(ExpoImage);

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
    const [focused, setFocused] = useState(false);
    const { openActions } = useCatalogActions();

    // Pure Component: No enrichment hook. 
    // We display exactly what is passed in 'item'.
    const displayItem = item;
    const displayAny = displayItem as any;

    const aspectRatio = displayItem.posterShape === 'landscape' ? 16 / 9 : displayItem.posterShape === 'square' ? 1 : 2 / 3;
    const height = width / aspectRatio;

    const handlePress = useCallback(() => {
        router.push({
            pathname: '/meta/[id]' as any,
            params: { id: item.id, type: item.type }
        });
    }, [item.id, item.type, router]);

    const handleLongPress = useCallback(() => {
        openActions(item);
    }, [item, openActions]);

    const animatedImageStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: withSpring(focused ? 1.05 : 1) }],
        };
    });

    return (
        <View style={[styles.container, { width }]}>
            <ExpressiveSurface
                variant="filled"
                rounding="lg"
                style={[styles.surface, { height }]}
                onPress={handlePress}
                onLongPress={handleLongPress}
                onFocusChange={setFocused}
                disableLayoutAnimation={true}
            >
                <View style={[styles.imageContainer, { backgroundColor: (theme.colors as any).surfaceContainerHighest || theme.colors.surfaceVariant }]}>
                    {/* Placeholder / Fallback: Always rendered behind image */}
                    <View style={styles.absolutePlaceholder}>
                        <Typography
                            variant="label-small"
                            weight="bold"
                            style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}
                            numberOfLines={3}
                        >
                            {displayItem.name}
                        </Typography>
                    </View>

                    {(() => {
                        const imageSrc = displayItem.posterShape === 'landscape'
                            ? (displayItem.backdrop || displayItem.poster)
                            : (displayItem.poster);

                        if (imageSrc) {
                            return (
                                <AnimatedExpoImage
                                    key={displayItem.id} // React Key for clean remounts
                                    recyclingKey={imageSrc} // Native recycling key
                                    source={{ uri: imageSrc }}
                                    style={[styles.image, animatedImageStyle]}
                                    contentFit="cover"
                                    transition={Platform.OS === 'android' ? 0 : 200}
                                    cachePolicy="memory-disk"
                                />
                            );
                        }
                        return null;
                    })()}

                    {/* Logo Overlay */}
                    {(displayItem.posterShape === 'landscape' && displayItem.logo) && (
                        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 10 }}>
                            <ExpoImage
                                source={{ uri: displayItem.logo }}
                                style={{ width: '70%', height: '50%' }}
                                contentFit="contain"
                            />
                        </View>
                    )}

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
                {/* No Progress Bar in CatalogCard anymore */}
            </ExpressiveSurface >

            < View style={styles.metadata} >
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
            </View >

        </View >
    );
};

export const CatalogCard = React.memo(CatalogCardComponent, (prev, next) => {
    return (
        prev.item.id === next.item.id &&
        prev.item.type === next.item.type &&
        prev.width === next.width
    );
});

const styles = StyleSheet.create({
    container: {
        gap: 8,
    },
    surface: {
        overflow: 'hidden',
    },
    imageContainer: {
        flex: 1,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
        zIndex: 1, // Image sits on top
    },
    absolutePlaceholder: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        zIndex: 0, // Placeholder sits behind
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
    }
});
