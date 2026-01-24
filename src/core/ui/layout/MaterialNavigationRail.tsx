import { useTheme } from '@/src/core/ThemeContext';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Touchable } from '../components/Touchable';

import { Typography } from '../components/Typography';

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
            height: withSpring(isFocused ? 32 : 0, { damping: 15, stiffness: 150 }),
            opacity: withTiming(isFocused ? 1 : 0, { duration: 200 }),
        };
    });

    const indicatorBgColor = theme.colors.secondaryContainer;

    return (
        <Touchable
            onPress={onPress}
            haptic="selection"
            style={styles.tab}
        >
            <View style={styles.iconContainer}>
                <Animated.View style={[styles.indicator, indicatorStyle, { backgroundColor: indicatorBgColor }]} />
                {options.tabBarIcon && options.tabBarIcon({
                    focused: isFocused,
                    color: isFocused ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant,
                    size: 26
                })}
            </View>
            <Typography
                variant="label-medium"
                weight={isFocused ? 'bold' : 'medium'}
                style={{
                    color: isFocused ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
                    marginTop: 4
                }}
            >
                {label as string}
            </Typography>
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
            }
        ]}>
            <View style={styles.topSection}>
                <Typography variant="h3" weight="black" style={{ color: theme.colors.primary }}>C</Typography>
            </View>

            <View style={styles.itemsSection}>
                {state.routes && state.routes.length > 0 && state.routes.map((route, index) => (
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
                {/* Profile placeholder */}
                <View style={[styles.profileCircle, { backgroundColor: theme.colors.surfaceVariant }]} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 88, // Slightly wider for premium feel
        height: '100%',
        paddingVertical: 32,
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRightWidth: StyleSheet.hairlineWidth,
    },
    topSection: {
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemsSection: {
        flex: 1,
        gap: 16,
        justifyContent: 'center',
    },
    bottomSection: {
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    tab: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
        paddingVertical: 14,
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
});
