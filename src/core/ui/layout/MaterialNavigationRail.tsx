import { LAYOUT } from '@/src/constants/layout';
import { useTheme } from '@/src/core/ThemeContext';
import { usePathname, useRouter } from 'expo-router';
import { CircleUser, Clapperboard, Compass, Home, Library, Search, Settings } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Touchable } from '../Touchable';
import { Typography } from '../Typography';

// Define the routes statically since we are decoupling from the navigator
const ROUTES = [
    { name: 'index', path: '/', title: 'Home', icon: Home },
    { name: 'search', path: '/search', title: 'Search', icon: Search },
    { name: 'discover', path: '/discover', title: 'Discover', icon: Compass },
    { name: 'library', path: '/library', title: 'Library', icon: Library },
    { name: 'settings', path: '/settings', title: 'Settings', icon: Settings },
];

const NavigationRailItem = ({
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
            height: withSpring(isActive ? 32 : 0, { damping: 15, stiffness: 150 }),
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
                    size={26}
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

export const MaterialNavigationRail = () => {
    const { theme } = useTheme();
    const pathname = usePathname();
    const router = useRouter();

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: theme.colors.surface,
                borderRightColor: theme.colors.outlineVariant,
            }
        ]}>
            <View style={styles.topSection}>
                <Clapperboard variant="h3" weight="black" style={{ color: theme.colors.primary }} size={32} />
            </View>

            <View style={styles.itemsSection}>
                {ROUTES.map((route) => {
                    // Check if current pathname matches route
                    // Simplified active logic: 
                    // - index matches '/' 
                    // - others match specific path
                    const isActive = route.name === 'index'
                        ? pathname === '/'
                        : pathname.startsWith(route.path);

                    return (
                        <NavigationRailItem
                            key={route.name}
                            route={route}
                            isActive={isActive}
                            onPress={() => router.push(route.path as any)}
                            theme={theme}
                        />
                    );
                })}
            </View>

            <View style={styles.bottomSection}>
                {/* Profile placeholder */}
                <CircleUser size={32} color={theme.colors.onSurfaceVariant} strokeWidth={1.5} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: LAYOUT.RAIL_WIDTH, // Slightly wider for premium feel
        height: '100%',
        paddingVertical: 32,
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRightWidth: StyleSheet.hairlineWidth,
        zIndex: 1000,
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
