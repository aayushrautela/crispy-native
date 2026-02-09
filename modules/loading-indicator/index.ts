import { requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import { Platform, View, ViewProps } from 'react-native';

export interface LoadingIndicatorViewProps extends ViewProps {
    color?: number;
    containerColor?: number;
    size?: number;
    containerSize?: number;
}

const DummyView = (props: LoadingIndicatorViewProps) => <View {...props} />;

export const LoadingIndicatorView: React.ComponentType<LoadingIndicatorViewProps> =
    Platform.OS === 'android'
        ? requireNativeViewManager('LoadingIndicator')
        : DummyView;
