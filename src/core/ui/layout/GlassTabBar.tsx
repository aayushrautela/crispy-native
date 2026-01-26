import { useTheme } from '@/src/core/ThemeContext';
import { usePathname, useRouter } from 'expo-router';
import { Compass, Home, Library, Search, Settings } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface } from '../Surface';
import { Touchable } from '../Touchable';

const ROUTES = [
    { name: 'index', path: '/', title: 'Home', icon: Home },
    { name: 'search', path: '/search', title: 'Search', icon: Search },
    { name: 'discover', path: '/discover', title: 'Discover', icon: Compass },
    { name: 'library', path: '/library', title: 'Library', icon: Library },
    { name: 'settings', path: '/settings', title: 'Settings', icon: Settings },
];

const GlassTabItem = ({
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
    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: withSpring(isActive ? 1.15 : 1) }],
            opacity: withSpring(isActive ? 1 : 0.5)
        };
    });

    const Icon = route.icon;

    return (
        <Touchable
            onPress={onPress}
            haptic="selection"
            style={styles.tab}
        >
            <Animated.View style={animatedStyle}>
                <Icon
                    color='#FFFFFF'
                    size={24}
                />
            </Animated.View>

            {isActive && (
                <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
            )}
        </Touchable>
    );
};

export const GlassTabBar = () => {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const pathname = usePathname();
    const router = useRouter();

    return (
        <View style={[styles.container, { bottom: 32 + insets.bottom }]}>
            <Surface
                variant="glass"
                intensity={60}
                style={[
                    styles.surface,
                    {
                        backgroundColor: 'rgba(0,0,0,0.4)',
                        borderColor: 'rgba(255,255,255,0.1)',
                    }
                ]}
            >
                {ROUTES.map((route) => {
                    const isActive = route.name === 'index'
                        ? pathname === '/'
                        : pathname.startsWith(route.path);

                    return (
                        <GlassTabItem
                            key={route.name}
                            route={route}
                            isActive={isActive}
                            onPress={() => router.push(route.path as any)}
                            theme={theme}
                        />
                    );
                })}
            </Surface>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },
    surface: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        height: 64,
        borderRadius: 32,
        borderWidth: 1,
        width: '85%',
        maxWidth: 400,
    },
    tab: {
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dot: {
        position: 'absolute',
        bottom: 10,
        width: 4,
        height: 4,
        borderRadius: 2,
    },
});
