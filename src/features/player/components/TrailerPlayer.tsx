import React, { memo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Video } from 'react-native-video';

interface TrailerPlayerProps {
    url: string;
    onReady?: () => void;
    onError?: (error: any) => void;
    onEnd?: () => void;
    muted?: boolean;
    style?: any;
}

export const TrailerPlayer = memo(({ url, onReady, onError, onEnd, muted = true, style }: TrailerPlayerProps) => {
    const opacity = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const handleLoad = () => {
        opacity.value = withTiming(1, { duration: 500 });
        if (onReady) onReady();
    };

    return (
        <View style={[styles.container, style]}>
            <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
                <Video
                    source={{ uri: url }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    repeat={false}
                    muted={muted}
                    playInBackground={false}
                    playWhenInactive={false}
                    onLoad={handleLoad}
                    onError={onError}
                    onEnd={onEnd}
                    ignoreSilentSwitch="obey"
                />
            </Animated.View>
            {opacity.value === 0 && (
                <View style={styles.loader}>
                    <ActivityIndicator size="small" color="white" />
                </View>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'black',
        overflow: 'hidden',
    },
    loader: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
});

export default TrailerPlayer;
