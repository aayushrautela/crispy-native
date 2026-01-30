import { Meta } from '@/src/core/hooks/useHeroItems';
import { useResponsive } from '@/src/core/hooks/useResponsive';
import { useTheme } from '@/src/core/ThemeContext';
import { Shimmer } from '@/src/core/ui/Shimmer';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { HeroSlide } from './HeroSlide';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HeroCarouselProps {
    items?: Meta[];
    isLoading?: boolean;
}

export const HeroCarousel = ({ items: propItems, isLoading = false }: HeroCarouselProps) => {
    const { theme } = useTheme();
    const { heroHeight } = useResponsive();
    const router = useRouter();
    const items = propItems || [];
    const scrollX = useSharedValue(0);
    const [activeIndex, setActiveIndex] = useState(0);

    const onScroll = useAnimatedScrollHandler((event) => {
        scrollX.value = event.contentOffset.x;
    });

    const handleWatch = (item: Meta) => {
        router.push({
            pathname: '/meta/[id]' as any,
            params: { id: item.id, type: item.type, autoplay: 'true' }
        });
    };

    const handleInfo = (item: Meta) => {
        router.push({
            pathname: '/meta/[id]' as any,
            params: { id: item.id, type: item.type, autoplay: 'false' }
        });
    };

    if (isLoading || !items || items.length === 0) {
        return (
            <View style={[styles.skeletonContainer, { height: heroHeight }]}>
                <Shimmer height={heroHeight} width={SCREEN_WIDTH} borderRadius={0} />
                <View style={styles.skeletonContent}>
                    <Shimmer width="60%" height={40} borderRadius={8} style={{ marginBottom: 12 }} />
                    <Shimmer width="40%" height={20} borderRadius={4} style={{ marginBottom: 24 }} />
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Shimmer width={120} height={48} borderRadius={24} />
                        <Shimmer width={120} height={48} borderRadius={24} />
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Animated.FlatList
                data={items}
                renderItem={({ item, index }) => (
                    <HeroSlide
                        item={item}
                        index={index}
                        scrollX={scrollX}
                        onWatch={handleWatch}
                        onInfo={handleInfo}
                    />
                )}
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

            {/* Static Dot Indicators */}
            {items.length > 1 && (
                <View style={styles.dotsContainer}>
                    {items.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: activeIndex === i ? theme.colors.primary : 'rgba(255,255,255,0.3)',
                                    width: activeIndex === i ? 20 : 6,
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
        marginBottom: 0,
    },
    skeletonContainer: {
        width: SCREEN_WIDTH,
        overflow: 'hidden',
    },
    skeletonContent: {
        position: 'absolute',
        bottom: 100,
        left: 24,
        right: 24,
    },
    dotsContainer: {
        position: 'absolute',
        bottom: 63, // Aligned with center of 52px buttons (40px padding + 26px center - 3px dot)
        right: 24,  // Matches gradient padding
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 6,
    },
    dot: {
        height: 6,
        borderRadius: 3,
    }
});

