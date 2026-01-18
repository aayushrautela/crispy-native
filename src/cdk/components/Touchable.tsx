import React from 'react';
import { Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';

interface TouchableProps extends PressableProps {
    haptic?: Haptics.ImpactFeedbackStyle | 'selection' | 'success' | 'warning' | 'error' | 'off';
    containerStyle?: StyleProp<ViewStyle>;
    className?: string;
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
            {({ pressed }) => (
                typeof children === 'function' ? children({ pressed }) : children
            )}
        </Pressable>
    );
};
