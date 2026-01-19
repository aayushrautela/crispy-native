import { Typography } from '@/src/cdk/components/Typography';
import { Screen } from '@/src/cdk/layout/Screen';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

const HEADER_OFFSET = 64;

export default function LibraryScreen() {
    const scrollY = useSharedValue(0);

    const onScroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    return (
        <Screen safeArea={false}>
            {/* Absolute Header - Matching Search/Discover alignment */}
            <Animated.View style={styles.header}>
                <Typography
                    variant="display-large"
                    weight="black"
                    rounded
                    style={{ fontSize: 40, lineHeight: 48, color: 'white' }}
                >
                    Library
                </Typography>
                <Typography variant="body" className="text-zinc-400 mt-2">
                    Your collection and watch history.
                </Typography>
            </Animated.View>

            <Animated.ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Content goes here */}
            </Animated.ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: HEADER_OFFSET,
        paddingHorizontal: 24,
        zIndex: 100,
    },
    scrollContent: {
        paddingTop: 160,
        paddingBottom: 100,
    }
});
