import { Meta } from '@/src/core/hooks/useHeroItems';
import { useResponsive } from '@/src/core/hooks/useResponsive';
import { useTheme } from '@/src/core/ThemeContext';
import { Shimmer } from '@/src/core/ui/Shimmer';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { HeroSlide, HeroThemeColors } from './HeroSlide';

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

    // Pre-calculate theme colors to pass as stable prop
    const themeColors: HeroThemeColors = useMemo(() => ({
        primary: theme.colors.primary,
        surfaceVariant: theme.colors.surfaceVariant,
        background: theme.colors.background,
    }), [theme.colors.primary, theme.colors.surfaceVariant, theme.colors.background]);

    const onScroll = useAnimatedScrollHandler((event) => {
        scrollX.value = event.contentOffset.x;
    });

    const handleWatch = useCallback((item: Meta) => {
        router.push({
            pathname: '/meta/[id]' as any,
            params: { id: item.id, type: item.type, autoplay: 'true' }
        });
    }, [router]);

    const handleInfo = useCallback((item: Meta) => {
        router.push({
            pathname: '/meta/[id]' as any,
            params: { id: item.id, type: item.type, autoplay: 'false' }
        });
    }, [router]);

    // Key optimization: Fixed layout means we don't need to measure items
    const getItemLayout = useCallback((_: any, index: number) => ({
        length: SCREEN_WIDTH,
        offset: SCREEN_WIDTH * index,
        index,
    }), []);

    const renderItem = useCallback(({ item, index }: { item: Meta; index: number }) => (
        <HeroSlide
            item={item}
            index={index}
            scrollX={scrollX}
            width={SCREEN_WIDTH}
            height={heroHeight}
            themeColors={themeColors}
            isFocused={index === activeIndex} // Only the active slide gets high priority
            onWatch={handleWatch}
            onInfo={handleInfo}
        />
    ), [scrollX, heroHeight, themeColors, activeIndex, handleWatch, handleInfo]);

    // Stable key extractor
    const keyExtractor = useCallback((item: Meta) => item.id, []);

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
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                keyExtractor={keyExtractor}
                snapToInterval={SCREEN_WIDTH}
                decelerationRate="fast"
                onMomentumScrollEnd={(e) => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
                
                // Performance Optimizations
                getItemLayout={getItemLayout}
                removeClippedSubviews={true} // Critical for memory
                initialNumToRender={2}       // Only render 2 items initially
                maxToRenderPerBatch={2}      // Incremental rendering
                windowSize={3}               // 1 screen left + 1 screen visible + 1 screen right
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
        bottom: 63,
        right: 24,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 6,
    },
    dot: {
        height: 6,
        borderRadius: 3,
    }
});
