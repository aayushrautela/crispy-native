import React from 'react';
import { processColor, StyleSheet, View } from 'react-native';
import { LoadingIndicatorView } from '../../../modules/loading-indicator';

export interface LoadingIndicatorProps {
    color?: string;
    containerColor?: string;
    size?: number | 'small' | 'large';
    containerSize?: number;
    animating?: boolean;
}

const LARGE_SIZE = 36;
const SMALL_SIZE = 20;
const CONTAINER_SIZE_RATIO = 1.25;
const DEFAULT_GRAY = '#999999';

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
    color = DEFAULT_GRAY,
    containerColor,
    size = 'small',
    containerSize,
    animating = true,
}) => {
    const resolvedSize = typeof size === 'number'
        ? size
        : size === 'large' ? LARGE_SIZE : SMALL_SIZE;

    const resolvedContainerSize = containerSize ?? Math.round(resolvedSize * CONTAINER_SIZE_RATIO);

    const sizeStyle = {
        width: resolvedContainerSize,
        height: resolvedContainerSize,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
    };

    if (!animating) {
        return <View style={sizeStyle} />;
    }

    return (
        <View style={sizeStyle}>
            <LoadingIndicatorView
                color={color ? (processColor(color) as number) : undefined}
                containerColor={containerColor ? (processColor(containerColor) as number) : undefined}
                size={Math.round(resolvedSize * 2)}
                containerSize={Math.round(resolvedContainerSize * 2)}
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
