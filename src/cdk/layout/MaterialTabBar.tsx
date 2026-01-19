import { useTheme } from '@/src/core/ThemeContext';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Touchable } from '../components/Touchable';

import { Typography } from '../components/Typography';

const MaterialTabItem = ({
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
            width: withSpring(isFocused ? 64 : 0, { damping: 15, stiffness: 150 }),
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

export const MaterialTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
    const { theme } = useTheme();

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: theme.colors.surface,
                borderTopColor: theme.colors.outlineVariant,
            }
        ]}>
            <View style={styles.content}>
                {state.routes.map((route, index) => (
                    <MaterialTabItem
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
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: 'transparent',
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        height: 80,
        paddingBottom: Platform.OS === 'ios' ? 24 : 12,
        paddingTop: 12,
        paddingHorizontal: 8,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        height: 32,
        width: 64,
        borderRadius: 16,
        overflow: 'hidden',
    },
    indicator: {
        position: 'absolute',
        height: '100%',
        borderRadius: 16,
    },
});
