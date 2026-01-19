import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { Typography } from '@/src/cdk/components/Typography';
import { MetaPreview } from '@/src/core/api/AddonService';
import { TMDBMeta, TMDBService } from '@/src/core/api/TMDBService';
import { useTheme } from '@/src/core/ThemeContext';
import { useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

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
        if (item.type === 'movie' || item.type === 'series') {
            TMDBService.getEnrichedMeta(item.id, item.type as any).then(setMeta);
        }
    }, [item.id, item.type]);

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
                    {(item.poster || meta.poster) ? (
                        <Animated.Image
                            source={{ uri: item.poster || meta.poster }}
                            style={[styles.image, animatedImageStyle]}
                            resizeMode="cover"
                        />
                    ) : (
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

                    {/* Rating Overlay */}
                    {(meta.rating || (item as any).rating) && (
                        <View style={styles.ratingOverlay}>
                            <Star size={10} color="#FFD700" fill="#FFD700" />
                            <Typography variant="label-small" weight="black" style={{ color: 'white', marginLeft: 4 }}>
                                {meta.rating || (item as any).rating}
                            </Typography>
                        </View>
                    )}
                </View>
            </ExpressiveSurface>

            {/* Metadata Below Poster */}
            <View style={styles.metadata}>
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
                        style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}
                    >
                        {meta.year || (item as any).year || (item as any).releaseInfo || 'TBA'}
                    </Typography>
                    {(meta.genres?.[0]) && (
                        <View style={[styles.genrePill, { backgroundColor: theme.colors.surfaceContainerHighest || theme.colors.surfaceVariant }]}>
                            <Typography
                                variant="label-small"
                                weight="black"
                                style={{ color: theme.colors.onSurface, fontSize: 9 }}
                            >
                                {meta.genres[0].toUpperCase()}
                            </Typography>
                        </View>
                    )}
                </View>
            </View>
        </View>
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
        gap: 6,
    },
    genrePill: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
    }
});
