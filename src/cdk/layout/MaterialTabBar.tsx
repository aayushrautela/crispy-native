import React from 'react';
import { View, Text } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Touchable } from '../components/Touchable'; // Haptic aware
import { Icon } from '../components/Icon';
import { cn } from '@/src/lib/utils';
import Animated, { useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';

/**
 * Material You Expressive Navigation Bar (Android)
 * - Full width
 * - No elevation
 * - Pill-shaped active indicator
 * - Dynamic colors (using NativeWind utility classes mapped to system colors)
 */
export const MaterialTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
    return (
        <View className="flex-row items-center justify-around w-full h-[80px] bg-white dark:bg-zinc-900 pb-4 pt-2">
            {/* Background would ideally be 'bg-surface-container' if we had full tokens setup, 
           for now we use standard dark/light modes which nativewind maps to system colors if configured */}

            {state.routes.map((route, index) => {
                const { options } = descriptors[route.key];
                const isFocused = state.index === index;

                // Icon handling
                // We expect the options.tabBarIcon to be a Lucide Icon or similar
                const iconName = options.tabBarIcon ? (options.tabBarIcon as any) : null;

                // Label
                const label = options.title !== undefined
                    ? options.title
                    : options.tabBarLabel !== undefined
                        ? options.tabBarLabel
                        : route.name;

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

                const onLongPress = () => {
                    navigation.emit({
                        type: 'tabLongPress',
                        target: route.key,
                    });
                };

                // Animations
                const indicatorStyle = useAnimatedStyle(() => {
                    return {
                        width: withSpring(isFocused ? 64 : 0, { damping: 15 }),
                        opacity: withTiming(isFocused ? 1 : 0, { duration: 200 })
                    };
                });

                return (
                    <Touchable
                        key={route.key}
                        onPress={onPress}
                        onLongPress={onLongPress}
                        haptic="selection" // Light tick on press
                        className="flex-1 items-center justify-center gap-1"
                    >
                        {/* Pill Indicator Container */}
                        <View className="relative items-center justify-center h-8 w-16 rounded-full overflow-hidden">
                            {/* The Pill Background */}
                            <Animated.View
                                style={[indicatorStyle]}
                                className="absolute h-full bg-blue-200 dark:bg-blue-900 rounded-full"
                            />

                            {/* Icon */}
                            {/* We render the icon passed from descriptors. 
                    Note: In Expo Router, tabBarIcon is a function returning a Node usually. 
                    But here we might pass a Lucide Icon directly in our config to be cleaner.
                    Let's assume standard Expo Router usage where it's a function.
                */}
                            {options.tabBarIcon && (
                                <View className={cn(isFocused ? "text-blue-900 dark:text-blue-100" : "text-zinc-600 dark:text-zinc-400")}>
                                    {/* We clone to inject color/size if needed, or rely on parent text color context if SVG */}
                                    {options.tabBarIcon({
                                        focused: isFocused,
                                        color: isFocused ? '#DRE4FF' : '#9CA3AF', // Fallback colors, real app uses classes
                                        size: 24
                                    })}
                                </View>
                            )}
                        </View>

                        {/* Label */}
                        <Text className={cn(
                            "text-xs font-medium tracking-tight",
                            isFocused ? "text-zinc-900 dark:text-zinc-100 font-bold" : "text-zinc-500 dark:text-zinc-500"
                        )}>
                            {label as string}
                        </Text>
                    </Touchable>
                );
            })}
        </View>
    );
};
