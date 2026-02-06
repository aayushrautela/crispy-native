import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View, ViewProps, DimensionValue } from 'react-native';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withTiming, 
    Easing 
} from 'react-native-reanimated';
import { useTheme } from '../ThemeContext';

interface ShimmerProps extends ViewProps {
    width?: DimensionValue;
    height?: DimensionValue;
    borderRadius?: number;
}

export const Shimmer = ({ 
    width, 
    height, 
    borderRadius = 8, 
    style,
    ...props 
}: ShimmerProps) => {
    const translateX = useSharedValue(-1);

    useEffect(() => {
        translateX.value = withRepeat(
            withTiming(1, { duration: 1500 }),
            -1,
            false
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{
            translateX: translateX.value * (typeof width === 'number' ? width : 400)
        }]
    }));

    return (
        <View style={[
            styles.container,
            { width, height, borderRadius },
            style
        ]}>
            <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
                <LinearGradient
                    colors={['transparent', 'rgba(255, 255, 255, 0.05)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        overflow: 'hidden',
    },
});
