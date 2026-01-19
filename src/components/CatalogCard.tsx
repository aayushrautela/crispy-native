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

export const CatalogCard = ({ item, width = 140 }: CatalogCardProps) => {
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
            pathname: `/meta/${item.id}` as any,
            params: { type: item.type }
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
                rounding="lg" // Reduced from xl as requested
                style={[
                    styles.surface,
                    {
                        height,
                        borderColor: focused ? theme.colors.primary : 'transparent',
                        backgroundColor: theme.colors.surfaceVariant,
                    }
                ] as any}
                onPress={handlePress}
                onFocusChange={setFocused}
            >
                <View style={styles.imageContainer}>
                    {item.poster || meta.poster ? (
                        <Animated.Image
                            source={{ uri: item.poster || meta.poster }}
                            style={[styles.image, animatedImageStyle]}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={[styles.placeholder, { backgroundColor: theme.colors.surfaceVariant }]}>
                            <Typography
                                variant="caption"
                                weight="bold"
                                className="text-center px-2"
                                style={{ color: theme.colors.onSurfaceVariant }}
                            >
                                {item.name}
                            </Typography>
                        </View>
                    )}

                    {/* Rating Overlay (Bottom Right) */}
                    {(meta.rating || (item as any).rating) && (
                        <View style={styles.ratingOverlay}>
                            <Star size={10} color="#FFD700" fill="#FFD700" />
                            <Typography variant="label" weight="black" style={{ color: 'white', marginLeft: 4 }}>
                                {meta.rating || (item as any).rating}
                            </Typography>
                        </View>
                    )}
                </View>
            </ExpressiveSurface>

            {/* Metadata Below Poster */}
            <View style={styles.metadata}>
                <View style={styles.nameContainer}>
                    <Typography
                        variant="body"
                        numberOfLines={2}
                        weight="bold"
                        style={{ color: theme.colors.onSurface, fontSize: 13 }}
                    >
                        {item.name}
                    </Typography>
                </View>
                <View style={styles.badgeRow}>
                    <Typography
                        variant="label"
                        weight="medium"
                        style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7, fontSize: 11 }}
                    >
                        {meta.year || (item as any).releaseInfo || 'TBA'}
                    </Typography>
                    {(meta.genres?.[0]) && (
                        <View style={[styles.genrePill, { backgroundColor: theme.colors.surfaceVariant }]}>
                            <Typography
                                variant="label"
                                weight="black"
                                style={{ color: theme.colors.onSurfaceVariant, fontSize: 9 }}
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
        gap: 6,
    },
    surface: {
        borderWidth: 1.5,
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
        gap: 1,
        paddingHorizontal: 2,
    },
    nameContainer: {
        minHeight: 36, // Fits roughly 2 lines of 13px text
        justifyContent: 'center',
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    genrePill: {
        paddingHorizontal: 8,
        paddingVertical: 1,
        borderRadius: 20,
    }
});
