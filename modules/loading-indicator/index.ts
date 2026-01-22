import { requireNativeViewManager } from 'expo-modules-core';
import { ViewProps } from 'react-native';

export interface LoadingIndicatorViewProps extends ViewProps {
    color?: number;
    containerColor?: number;
    size?: number;
    containerSize?: number;
}

export const LoadingIndicatorView: React.ComponentType<LoadingIndicatorViewProps> =
    requireNativeViewManager('LoadingIndicator');
