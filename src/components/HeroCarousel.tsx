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
const HERO_HEIGHT = 500; // Slightly taller for better spacing

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
            pathname: `/meta/${item.id}` as any,
            params: { type: item.type, autoplay: autoplay ? 'true' : 'false' }
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
                        colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)', '#000000']}
                        locations={[0, 0.3, 0.65, 1]}
                        style={styles.gradient}
                    >
                        <View style={styles.content}>
                            {/* Logo and New Tag Container */}
                            <View style={styles.brandingSection}>
                                {meta.logo ? (
                                    <View>
                                        <Image source={{ uri: meta.logo }} style={styles.logo} resizeMode="contain" />
                                        {isNew && (
                                            <Typography variant="label" weight="black" style={{ color: theme.colors.primary, marginTop: -4, marginLeft: 2 }}>#NEW</Typography>
                                        )}
                                    </View>
                                ) : (
                                    <View>
                                        <Typography variant="h1" weight="black" style={{ color: 'white', marginBottom: 2 }}>{item.name}</Typography>
                                        {isNew && (
                                            <Typography variant="label" weight="black" style={{ color: theme.colors.primary, marginTop: -2 }}>#NEW</Typography>
                                        )}
                                    </View>
                                )}
                            </View>

                            {/* Meta Row */}
                            <View style={styles.metaRow}>
                                <View style={[styles.metaBadge, { backgroundColor: theme.colors.onSurface + '20' }]}>
                                    <Typography variant="label" weight="bold" style={{ color: 'white' }}>{meta.year || '2024'}</Typography>
                                </View>
                                <View style={styles.metaRowItem}>
                                    <Star size={16} color="#FFD700" fill="#FFD700" />
                                    <Typography variant="label" weight="bold" style={{ color: 'white', marginLeft: 4 }}>{meta.rating || '8.5'}</Typography>
                                </View>
                                <Typography variant="label" weight="medium" style={{ color: 'white', opacity: 0.8 }}>
                                    {meta.genres?.slice(0, 2).join(' • ') || 'Drama'}
                                </Typography>
                            </View>

                            {/* Description (Increased to 3 lines and slightly larger) */}
                            <Typography
                                variant="body"
                                numberOfLines={3}
                                weight="medium"
                                style={{ color: 'white', opacity: 0.7, fontSize: 14, lineHeight: 20, marginBottom: 28 }}
                            >
                                {meta.description || item.description || "Loading description..."}
                            </Typography>

                            {/* Actions (Increased spacing) */}
                            <View style={styles.actionRow}>
                                <ExpressiveButton
                                    title="Watch Now"
                                    variant="primary"
                                    onPress={() => handleNavigate(true)}
                                    icon={<Play size={20} color="black" fill="black" />}
                                    style={[styles.watchBtn, { backgroundColor: 'white' }] as any}
                                    textStyle={{ color: 'black', fontWeight: '900' }}
                                />
                                <ExpressiveButton
                                    title="More Info"
                                    variant="tonal"
                                    onPress={() => handleNavigate(false)}
                                    icon={<Info size={20} color="white" />}
                                    style={[styles.infoBtn, { backgroundColor: theme.colors.onSurface + '25' }] as any}
                                    textStyle={{ color: 'white', fontWeight: 'bold' }}
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
            <View style={styles.carouselWrapper}>
                <Animated.FlatList
                    data={items.length > 0 ? items : []}
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

                {/* Dots (Absolute Overlay inside card bounds) */}
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
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 24, // Added more space after hero
    },
    itemContainer: {
        width: SCREEN_WIDTH,
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    carouselWrapper: {
        width: SCREEN_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroCard: {
        width: HERO_WIDTH,
        height: HERO_HEIGHT,
        borderRadius: 36,
        overflow: 'hidden',
    },
    backgroundImage: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: 24,
        paddingBottom: 48, // Increased for dots
    },
    content: {
        gap: 0,
    },
    brandingSection: {
        marginBottom: 12,
    },
    logo: {
        width: 220, // Increased as requested
        height: 80,
        marginBottom: 0,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
    },
    metaBadge: {
        paddingHorizontal: 8,
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
        marginTop: 12, // Increased spacing
    },
    watchBtn: {
        flex: 1,
        height: 52,
        borderRadius: 32,
    },
    infoBtn: {
        flex: 1,
        height: 52,
        borderRadius: 32,
    },
    dotsContainer: {
        position: 'absolute',
        bottom: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        zIndex: 100,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    }
});
