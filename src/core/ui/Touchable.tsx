import React from 'react';
import { Pressable, PressableProps, PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

interface TouchableProps extends Omit<PressableProps, 'children'> {
    haptic?: Haptics.ImpactFeedbackStyle | 'selection' | 'success' | 'warning' | 'error' | 'off';
    containerStyle?: StyleProp<ViewStyle>;
    className?: string;
    children?: React.ReactNode | ((state: PressableStateCallbackType) => React.ReactNode);
}

export const Touchable = ({
    children,
    haptic = Haptics.ImpactFeedbackStyle.Light,
    onPress,
    className,
    style,
    ...props
}: TouchableProps) => {
    const handlePress = (event: any) => {
        if (haptic !== 'off') {
            if (haptic === 'selection') {
                Haptics.selectionAsync();
            } else if (haptic === 'success') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else if (haptic === 'warning') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } else if (haptic === 'error') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } else {
                Haptics.impactAsync(haptic as Haptics.ImpactFeedbackStyle);
            }
        }
        onPress?.(event);
    };

    return (
        <Pressable
            onPress={handlePress}
            className={className}
            style={style}
            {...props}
        >
            {(state) => (typeof children === 'function' ? (children as (s: PressableStateCallbackType) => React.ReactNode)(state) : children)}
        </Pressable>
    );
};
