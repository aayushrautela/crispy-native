import { useTheme } from '@/src/core/ThemeContext';
import { usePathname, useRouter } from 'expo-router';
import { Compass, Home, Library, Search, Settings } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '../Touchable';
import { Typography } from '../Typography';

const ROUTES = [
    { name: 'index', path: '/', title: 'Home', icon: Home },
    { name: 'search', path: '/search', title: 'Search', icon: Search },
    { name: 'discover', path: '/discover', title: 'Discover', icon: Compass },
    { name: 'library', path: '/library', title: 'Library', icon: Library },
    { name: 'settings', path: '/settings', title: 'Settings', icon: Settings },
];

const MaterialTabItem = ({
    route,
    isActive,
    onPress,
    theme
}: {
    route: typeof ROUTES[0],
    isActive: boolean,
    onPress: () => void,
    theme: any
}) => {
    const indicatorStyle = useAnimatedStyle(() => {
        return {
            width: withTiming(isActive ? 64 : 0, { duration: 250 }),
            opacity: withTiming(isActive ? 1 : 0, { duration: 200 }),
        };
    });

    const indicatorBgColor = theme.colors.secondaryContainer;
    const Icon = route.icon;

    return (
        <Touchable
            onPress={onPress}
            haptic="selection"
            style={styles.tab}
        >
            <View style={styles.iconContainer}>
                <Animated.View style={[styles.indicator, indicatorStyle, { backgroundColor: indicatorBgColor }]} />
                <Icon
                    color={isActive ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant}
                    size={24}
                />
            </View>
            <Typography
                variant="label-medium"
                weight={isActive ? 'bold' : 'medium'}
                style={{
                    color: isActive ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
                    marginTop: 4
                }}
            >
                {route.title}
            </Typography>
        </Touchable>
    );
};

export const MaterialTabBar = () => {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const pathname = usePathname();
    const router = useRouter();

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: theme.colors.surface,
                borderTopColor: theme.colors.outlineVariant,
            }
        ]}>
            <View style={[
                styles.content,
                {
                    height: 88 + insets.bottom,
                    paddingBottom: insets.bottom + 16,
                }
            ]}>
                {ROUTES.map((route) => {
                    const isActive = route.name === 'index'
                        ? pathname === '/'
                        : pathname.startsWith(route.path);

                    return (
                        <MaterialTabItem
                            key={route.name}
                            route={route}
                            isActive={isActive}
                            onPress={() => router.push(route.path as any)}
                            theme={theme}
                        />
                    );
                })}
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
