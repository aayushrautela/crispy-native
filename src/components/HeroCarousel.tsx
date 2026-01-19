import { useTheme } from '@/src/core/ThemeContext';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { Meta, useHeroItems } from '../core/hooks/useHeroItems';
import { HeroSlide } from './HeroSlide';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const HeroCarousel = () => {
    const { theme } = useTheme();
    const router = useRouter();
    const { data: items, isLoading } = useHeroItems();
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
            <View style={styles.skeletonContainer}>
                <View style={[styles.skeleton, { backgroundColor: theme.colors.surfaceVariant }]} />
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
    skeletonContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        marginBottom: 8,
    },
    skeleton: {
        width: SCREEN_WIDTH - 32,
        height: (SCREEN_WIDTH - 32) / (4 / 5),
        borderRadius: 32,
        opacity: 0.5,
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
