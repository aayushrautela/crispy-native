import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { Typography } from '@/src/cdk/components/Typography';
import { MetaPreview } from '@/src/core/api/AddonService';
import { TMDBMeta } from '@/src/core/api/TMDBService';
import { useTheme } from '@/src/core/ThemeContext';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedExpoImage = Animated.createAnimatedComponent(ExpoImage);

interface CatalogCardProps {
    item: MetaPreview;
    width?: number;
}

export const CatalogCard = ({ item, width = 144 }: CatalogCardProps) => {
    const router = useRouter();
    const { theme } = useTheme();
    const [focused, setFocused] = useState(false);
    const [meta, setMeta] = useState<Partial<TMDBMeta>>({});

    useEffect(() => {
        // DISABLED AS REQUESTED: No automatic TMDB hydration for catalog cards.
        // We only use cached metadata or data provided by the parent.
        /*
        const needsHydration = !item.poster || (item.posterShape === 'landscape' && !item.backdrop) || !item.logo;

        if ((item.type === 'movie' || item.type === 'series') && (needsHydration || !item.poster)) {
            TMDBService.getEnrichedMeta(item.id, item.type as any).then(setMeta);
        }
        */
    }, [item.id, item.type, item.poster, item.backdrop, item.logo, item.posterShape]);

    const aspectRatio = item.posterShape === 'landscape' ? 16 / 9 : item.posterShape === 'square' ? 1 : 2 / 3;
    const height = width / aspectRatio;

    const handlePress = () => {
        router.push({
            pathname: '/meta/[id]' as any,
            params: { id: item.id, type: item.type }
        });
    };

    const animatedImageStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: withSpring(focused ? 1.05 : 1) }],
        };
    });

    return (
        <View style={[styles.container, { width }]}>
            <ExpressiveSurface
                variant="filled"
                rounding="lg" // MD3 Medium (16px)
                style={[
                    styles.surface,
                    {
                        height,
                    }
                ]}
                onPress={handlePress}
                onFocusChange={setFocused}
            >
                <View style={styles.imageContainer}>
                    {(() => {
                        const imageSrc = item.posterShape === 'landscape'
                            ? (item.backdrop || meta.backdrop || item.poster || meta.poster)
                            : (item.poster || meta.poster);

                        if (imageSrc) {
                            return (
                                <AnimatedExpoImage
                                    source={{ uri: imageSrc }}
                                    style={[styles.image, animatedImageStyle]}
                                    contentFit="cover"
                                />
                            );
                        } else {
                            return null; // Fallthrough to placeholder
                        }
                    })() || (
                            <View style={[styles.placeholder, { backgroundColor: theme.colors.surfaceContainerHighest || theme.colors.surfaceVariant }]}>
                                <Typography
                                    variant="label-small"
                                    weight="bold"
                                    style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}
                                >
                                    {item.name}
                                </Typography>
                            </View>
                        )}

                    {/* Logo Overlay (Landscape only) */}
                    {(item.posterShape === 'landscape' && (item.logo || meta.logo)) && (
                        <View style={{ position: 'absolute', bottom: 12, left: 10, right: 10, alignItems: 'center', justifyContent: 'flex-end', height: '30%' }}>
                            <ExpoImage
                                source={{ uri: item.logo || meta.logo }}
                                style={{ width: '80%', height: '100%' }}
                                contentFit="contain"
                            />
                        </View>
                    )}

                    {/* Rating Overlay */}
                    {(item.imdbRating || item.rating || meta.rating) && (
                        <View style={styles.ratingOverlay}>
                            <Star size={10} color="#FFD700" fill="#FFD700" />
                            <Typography variant="label-small" weight="black" style={{ color: 'white', marginLeft: 4 }}>
                                {item.imdbRating || item.rating || meta.rating}
                            </Typography>
                        </View>
                    )}
                </View>

                {/* Progress Bar */}
                {
                    item.progressPercent !== undefined && item.progressPercent > 0 && (
                        <View style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 4,
                            backgroundColor: 'rgba(255,255,255,0.3)'
                        }}>
                            <View style={{
                                height: '100%',
                                width: `${item.progressPercent}%`,
                                backgroundColor: theme.colors.primary
                            }} />
                        </View>
                    )
                }
            </ExpressiveSurface >

            {/* Metadata Below Poster */}
            < View style={styles.metadata} >
                <Typography
                    variant="body-small"
                    weight="bold"
                    numberOfLines={1}
                    style={{ color: theme.colors.onSurface }}
                >
                    {item.name}
                </Typography>
                <View style={styles.badgeRow}>
                    <Typography
                        variant="label-small"
                        weight="medium"
                        numberOfLines={1}
                        style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}
                    >
                        {item.airDate || meta.year || item.releaseInfo}
                    </Typography>
                    {(item.genres?.[0] || meta.genres?.[0]) && (
                        <View style={[styles.genrePill, { backgroundColor: (theme.colors.primary + '20') || theme.colors.surfaceVariant }]}>
                            <Typography
                                variant="label-small"
                                weight="black"
                                style={{ color: theme.colors.primary, fontSize: 9 }}
                            >
                                {(item.genres?.[0] || meta.genres?.[0])}
                            </Typography>
                        </View>
                    )}
                </View>
            </View >
        </View >
    );
};

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
    },
    placeholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
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
