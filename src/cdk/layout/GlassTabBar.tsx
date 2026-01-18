import React from 'react';
import { View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Surface } from '../components/Surface';
import { Touchable } from '../components/Touchable';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

const GlassTabItem = ({
    route,
    index,
    state,
    descriptors,
    navigation
}: {
    route: any,
    index: number,
    state: any,
    descriptors: any,
    navigation: any
}) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === index;

    const onPress = () => {
        const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
        });

        if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
        }
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: withSpring(isFocused ? 1.2 : 1) }],
            opacity: withSpring(isFocused ? 1 : 0.6)
        };
    });

    return (
        <Touchable
            onPress={onPress}
            haptic="selection"
            className="flex-1 h-full items-center justify-center rounded-full active:bg-white/10"
        >
            <Animated.View style={animatedStyle}>
                {options.tabBarIcon && options.tabBarIcon({
                    focused: isFocused,
                    color: isFocused ? '#FFFFFF' : '#A1A1AA',
                    size: 24
                })}
            </Animated.View>

            {isFocused && (
                <View className="absolute bottom-3 w-1 h-1 rounded-full bg-white shadow-lg shadow-white" />
            )}
        </Touchable>
    );
};

export const GlassTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
    return (
        <View className="absolute bottom-8 left-0 right-0 items-center justify-center pointer-events-none">
            <Surface
                variant="glass"
                intensity={80}
                className="flex-row items-center justify-between px-2 h-16 bg-black/50 rounded-full shadow-2xl pointer-events-auto overflow-hidden border border-white/10"
                style={{ width: '85%', maxWidth: 400 }}
            >
                {state.routes.map((route, index) => (
                    <GlassTabItem
                        key={route.key}
                        route={route}
                        index={index}
                        state={state}
                        descriptors={descriptors}
                        navigation={navigation}
                    />
                ))}
            </Surface>
        </View>
    );
};
