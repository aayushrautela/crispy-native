import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Touchable } from '../components/Touchable';
import { useTheme } from '@/src/core/ThemeContext';
import Animated, { useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';

const NavigationRailItem = ({
    route,
    index,
    state,
    descriptors,
    navigation,
    theme
}: {
    route: any,
    index: number,
    state: any,
    descriptors: any,
    navigation: any,
    theme: any
}) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === index;

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

    const indicatorStyle = useAnimatedStyle(() => {
        return {
            height: withSpring(isFocused ? 32 : 0, { damping: 15 }),
            opacity: withTiming(isFocused ? 1 : 0, { duration: 200 }),
            backgroundColor: theme.colors.secondaryContainer,
        };
    });

    return (
        <Touchable
            onPress={onPress}
            haptic="selection"
            style={styles.tab}
        >
            <View style={styles.iconContainer}>
                <Animated.View style={[styles.indicator, indicatorStyle]} />
                {options.tabBarIcon && options.tabBarIcon({
                    focused: isFocused,
                    color: isFocused ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant,
                    size: 24
                })}
            </View>
            <Text style={[
                styles.label,
                { color: isFocused ? theme.colors.onSurface : theme.colors.onSurfaceVariant, fontWeight: isFocused ? '700' : '500' }
            ]}>
                {label as string}
            </Text>
        </Touchable>
    );
};

export const MaterialNavigationRail = ({ state, descriptors, navigation }: BottomTabBarProps) => {
    const { theme } = useTheme();

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: theme.colors.surface,
                borderRightColor: theme.colors.outlineVariant,
                borderRightWidth: StyleSheet.hairlineWidth
            }
        ]}>
            <View style={styles.topSection}>
                {/* Optional: Add Logo or Menu button here */}
            </View>

            <View style={styles.itemsSection}>
                {state.routes.map((route, index) => (
                    <NavigationRailItem
                        key={route.key}
                        route={route}
                        index={index}
                        state={state}
                        descriptors={descriptors}
                        navigation={navigation}
                        theme={theme}
                    />
                ))}
            </View>

            <View style={styles.bottomSection}>
                {/* Optional: Add Profile or Settings shortcut here */}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 80,
        height: '100%',
        paddingVertical: 24,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    topSection: {
        height: 56,
    },
    itemsSection: {
        flex: 1,
        gap: 12,
        justifyContent: 'center',
    },
    bottomSection: {
        height: 56,
    },
    tab: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        width: 80,
        paddingVertical: 12,
    },
    iconContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        height: 32,
        width: 56,
        borderRadius: 16,
        overflow: 'hidden',
    },
    indicator: {
        position: 'absolute',
        width: '100%',
        borderRadius: 16,
    },
    label: {
        fontSize: 12,
        letterSpacing: 0.5,
    },
});
