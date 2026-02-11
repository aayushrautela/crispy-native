import { Meta } from '@/src/core/hooks/useHeroItems';
import { useResponsive } from '@/src/core/hooks/useResponsive';
import { useTheme } from '@/src/core/ThemeContext';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { HeroSlide, HeroThemeColors } from './HeroSlide';

interface HeroCarouselProps {
    items?: Meta[];
    isLoading?: boolean;
}

export const HeroCarousel = ({ items: propItems, isLoading = false }: HeroCarouselProps) => {
    const { theme } = useTheme();
    const { heroHeight } = useResponsive();
    const router = useRouter();
    const { width: windowWidth } = useWindowDimensions();
    const listRef = useRef<FlatList<Meta> | null>(null);
    const slideWidth = windowWidth;
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
        length: slideWidth,
        offset: slideWidth * index,
        index,
    }), [slideWidth]);

    // Keep current slide in view when width changes (e.g., tablet rotation)
    useEffect(() => {
        listRef.current?.scrollToOffset({ offset: activeIndex * slideWidth, animated: false });
    }, [activeIndex, slideWidth]);

    const renderItem = useCallback(({ item, index }: { item: Meta; index: number }) => (
        <HeroSlide
            item={item}
            index={index}
            scrollX={scrollX}
            width={slideWidth}
            height={heroHeight}
            themeColors={themeColors}
            isFocused={index === activeIndex} // Only the active slide gets high priority
            onWatch={handleWatch}
            onInfo={handleInfo}
        />
    ), [scrollX, heroHeight, themeColors, activeIndex, handleWatch, handleInfo, slideWidth]);

    // Stable key extractor
    const keyExtractor = useCallback((item: Meta) => item.id, []);

    if (isLoading || !items || items.length === 0) {
        return (
            <View style={[styles.skeletonContainer, { height: heroHeight }]}>
                <View style={{ height: heroHeight, width: slideWidth, backgroundColor: '#2a2a2a' }} />
                <View style={styles.skeletonContent}>
                    <View style={{ width: '60%', height: 40, borderRadius: 8, backgroundColor: '#2a2a2a', marginBottom: 12 }} />
                    <View style={{ width: '40%', height: 20, borderRadius: 4, backgroundColor: '#2a2a2a', marginBottom: 24 }} />
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ width: 120, height: 48, borderRadius: 24, backgroundColor: '#2a2a2a' }} />
                        <View style={{ width: 120, height: 48, borderRadius: 24, backgroundColor: '#2a2a2a' }} />
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Animated.FlatList
                ref={listRef}
                data={items}
                renderItem={renderItem}
                horizontal
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                keyExtractor={keyExtractor}
                snapToInterval={slideWidth}
                snapToAlignment="start"
                decelerationRate="fast"
                disableIntervalMomentum
                onMomentumScrollEnd={(e) => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / slideWidth))}
                
                // Performance Optimizations
                getItemLayout={getItemLayout}
                removeClippedSubviews={false} // Disabled to prevent GPU crashes on Android (VK_ERROR_DEVICE_LOST)
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={5}               // Increased slightly for smoother scrolling since clipping is off
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
