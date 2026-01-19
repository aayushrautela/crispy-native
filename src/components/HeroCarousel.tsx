import { ExpressiveButton } from '@/src/cdk/components/ExpressiveButton';
import { Typography } from '@/src/cdk/components/Typography';
import { TMDBMeta, TMDBService } from '@/src/core/api/TMDBService';
import { useTheme } from '@/src/core/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Info, Play, Star } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, ImageBackground, StyleSheet, View } from 'react-native';
import Animated, { interpolate, SharedValue, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_WIDTH = SCREEN_WIDTH - 32;
const ASPECT_RATIO = 4 / 5;
const HERO_HEIGHT = HERO_WIDTH / ASPECT_RATIO;

interface HeroCarouselProps {
    items: any[];
}

const HeroItem = ({ item, index, scrollX }: { item: any, index: number, scrollX: SharedValue<number> }) => {
    const { theme } = useTheme();
    const router = useRouter();
    const [meta, setMeta] = useState<Partial<TMDBMeta>>({});

    useEffect(() => {
        TMDBService.getEnrichedMeta(item.id, item.type).then(setMeta);
    }, [item.id, item.type]);

    const handleNavigate = (autoplay = false) => {
        router.push({
            pathname: '/meta/[id]' as any,
            params: { id: item.id, type: item.type, autoplay: autoplay ? 'true' : 'false' }
        });
    };

    const isNew = meta.year === '2024' || meta.year === '2025';

    // Animated Parallax Style
    const animatedStyle = useAnimatedStyle(() => {
        const input = [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH];
        const scale = interpolate(scrollX.value, input, [0.96, 1, 0.96]);
        const opacity = interpolate(scrollX.value, input, [0.8, 1, 0.8]);
        return {
            transform: [{ scale }],
            opacity,
        };
    });

    return (
        <View style={styles.itemContainer}>
            <Animated.View style={[styles.heroCard, { backgroundColor: theme.colors.surfaceVariant }, animatedStyle]}>
                <ImageBackground
                    source={{ uri: meta.backdrop || item.background || item.poster }}
                    style={styles.backgroundImage}
                >
                    <LinearGradient
                        colors={['black', 'transparent', 'rgba(0,0,0,0.4)', 'black']}
                        locations={[0, 0.3, 0.6, 1]}
                        style={styles.gradient}
                    >
                        <View style={styles.content}>
                            {/* Branding Section */}
                            <View style={styles.brandingSection}>
                                {meta.networkLogo && (
                                    <Image source={{ uri: meta.networkLogo }} style={styles.networkLogo} resizeMode="contain" />
                                )}
                                {meta.logo ? (
                                    <Image source={{ uri: meta.logo }} style={styles.logo} resizeMode="contain" />
                                ) : (
                                    <Typography variant="headline-large" weight="black" style={{ color: 'white' }}>
                                        {item.name}
                                    </Typography>
                                )}
                                {isNew && (
                                    <View style={styles.newTag}>
                                        <Typography variant="label-large" weight="black" style={{ color: theme.colors.primary }}>#NEW</Typography>
                                    </View>
                                )}
                            </View>

                            {/* Meta Row */}
                            <View style={styles.metaRow}>
                                {meta.year && (
                                    <View style={[styles.metaBadge, { backgroundColor: 'black' }]}>
                                        <Typography variant="label-small" weight="bold" style={{ color: 'white' }}>{meta.year}</Typography>
                                    </View>
                                )}
                                {meta.rating && (
                                    <View style={styles.metaRowItem}>
                                        <Star size={14} color="#FFD700" fill="#FFD700" />
                                        <Typography variant="label-medium" weight="bold" style={{ color: 'white', marginLeft: 4 }}>{meta.rating}</Typography>
                                    </View>
                                )}
                                <Typography variant="label-medium" weight="medium" style={{ color: 'white', opacity: 0.6 }}>
                                    {meta.genres?.slice(0, 3).join(' • ')}
                                </Typography>
                            </View>

                            {/* Description */}
                            <Typography
                                variant="body-medium"
                                numberOfLines={3}
                                style={{ color: 'white', opacity: 0.7, marginBottom: 20 }}
                            >
                                {meta.description || item.description || "Loading description..."}
                            </Typography>

                            {/* Actions */}
                            <View style={styles.actionRow}>
                                <ExpressiveButton
                                    title="Watch Now"
                                    variant="primary"
                                    onPress={() => handleNavigate(true)}
                                    icon={<Play size={20} color="black" fill="black" />}
                                    style={styles.actionBtn}
                                />
                                <ExpressiveButton
                                    title="More Info"
                                    variant="tonal"
                                    onPress={() => handleNavigate(false)}
                                    icon={<Info size={20} color="white" />}
                                    style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                                    textStyle={{ color: 'white' }}
                                />
                            </View>
                        </View>
                    </LinearGradient>
                </ImageBackground>
            </Animated.View>
        </View>
    );
};

export const HeroCarousel = ({ items }: HeroCarouselProps) => {
    const { theme } = useTheme();
    const scrollX = useSharedValue(0);

    const onScroll = useAnimatedScrollHandler((event) => {
        scrollX.value = event.contentOffset.x;
    });

    const [activeIndex, setActiveIndex] = useState(0);

    return (
        <View style={styles.container}>
            <Animated.FlatList
                data={items}
                renderItem={({ item, index }) => <HeroItem item={item} index={index} scrollX={scrollX} />}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                snapToInterval={SCREEN_WIDTH}
                decelerationRate="fast"
                onMomentumScrollEnd={(e) => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
            />

            {/* Dot Indicators */}
            {items.length > 1 && (
                <View style={styles.dotsContainer}>
                    {items.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: activeIndex === i ? theme.colors.primary : 'rgba(255,255,255,0.3)',
                                    width: activeIndex === i ? 24 : 8,
                                }
                            ]}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 8,
    },
    itemContainer: {
        width: SCREEN_WIDTH,
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    heroCard: {
        width: HERO_WIDTH,
        height: HERO_HEIGHT,
        borderRadius: 32, // rounding-2xl
        overflow: 'hidden',
    },
    backgroundImage: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: 24,
        paddingBottom: 40,
    },
    content: {
    },
    brandingSection: {
        marginBottom: 8,
    },
    networkLogo: {
        height: 20,
        width: 60,
        marginBottom: 8,
        opacity: 0.8,
    },
    logo: {
        width: HERO_WIDTH * 0.7,
        height: 60,
        marginBottom: 4,
    },
    newTag: {
        marginTop: -4,
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    metaBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    metaRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'center',
    },
    actionBtn: {
        flex: 1,
        height: 48,
    },
    dotsContainer: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    }
});
