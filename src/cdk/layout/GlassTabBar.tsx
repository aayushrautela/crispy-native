import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Surface } from '../components/Surface';
import { Touchable } from '../components/Touchable';

const GlassTabItem = ({
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
            transform: [{ scale: withSpring(isFocused ? 1.15 : 1) }],
            opacity: withSpring(isFocused ? 1 : 0.5)
        };
    });

    return (
        <Touchable
            onPress={onPress}
            haptic="selection"
            style={styles.tab}
        >
            <Animated.View style={animatedStyle}>
                {options.tabBarIcon && options.tabBarIcon({
                    focused: isFocused,
                    color: '#FFFFFF',
                    size: 24
                })}
            </Animated.View>

            {isFocused && (
                <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
            )}
        </Touchable>
    );
};

export const GlassTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
    const { theme } = useTheme();

    return (
        <View style={styles.container}>
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
                {state.routes.map((route, index) => (
                    <GlassTabItem
                        key={route.key}
                        route={route}
                        index={index}
                        state={state}
                        descriptors={descriptors}
                        navigation={navigation}
                        theme={theme}
                    />
                ))}
            </Surface>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 32,
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
