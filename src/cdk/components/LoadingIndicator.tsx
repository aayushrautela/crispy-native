import React from 'react';
import { processColor, StyleSheet, View } from 'react-native';
import { LoadingIndicatorView } from '../../../modules/crispy-native-core';

export interface LoadingIndicatorProps {
    color?: string;
    containerColor?: string;
    size?: number | 'small' | 'large';
    containerSize?: number;
    animating?: boolean;
}

const LARGE_SIZE = 36;
const SMALL_SIZE = 24;
const CONTAINER_SIZE_RATIO = 1.25;

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
    color,
    containerColor,
    size = 'small',
    containerSize,
    animating = true,
}) => {
    if (!animating) return null;

    const resolvedSize = typeof size === 'number'
        ? size
        : size === 'large' ? LARGE_SIZE : SMALL_SIZE;

    const resolvedContainerSize = containerSize ?? Math.round(resolvedSize * CONTAINER_SIZE_RATIO);

    return (
        <View style={[styles.container, { width: resolvedContainerSize, height: resolvedContainerSize }]}>
            <LoadingIndicatorView
                color={color ? (processColor(color) as number) : undefined}
                containerColor={containerColor ? (processColor(containerColor) as number) : undefined}
                size={resolvedSize}
                containerSize={resolvedContainerSize}
                style={StyleSheet.absoluteFill}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
