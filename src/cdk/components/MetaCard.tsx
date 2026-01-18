import React, { useState } from 'react';
import { StyleSheet, View, Image, Text, Pressable } from 'react-native';
import { ExpressiveSurface } from './ExpressiveSurface';
import { MetaPreview } from '../../core/api/AddonService';
import { useRouter } from 'expo-router';
import { useTheme } from '../../core/ThemeContext';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface MetaCardProps {
    item: MetaPreview;
    width?: number;
    onPress?: () => void;
}

export const MetaCard = ({ item, width = 120, onPress }: MetaCardProps) => {
    const router = useRouter();
    const { theme } = useTheme();
    const [focused, setFocused] = useState(false);

    const aspectRatio = item.posterShape === 'landscape' ? 16 / 9 : item.posterShape === 'square' ? 1 : 2 / 3;
    const height = width / aspectRatio;

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            router.push(`/meta/${item.id}`);
        }
    };

    const animatedImageStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: withSpring(focused ? 1.1 : 1) }],
        };
    });

    return (
        <View style={[styles.container, { width }]}>
            <ExpressiveSurface
                variant="filled"
                rounding="xl"
                style={[styles.surface, { height }]}
                onPress={handlePress}
                onFocusChange={setFocused}
            >
                <View style={styles.imageContainer}>
                    {item.poster ? (
                        <Animated.Image
                            source={{ uri: item.poster }}
                            style={[styles.image, animatedImageStyle]}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={[styles.placeholder, { backgroundColor: theme.colors.surfaceVariant }]}>
                            <Text style={[styles.title, { color: theme.colors.onSurfaceVariant }]}>{item.name}</Text>
                        </View>
                    )}
                </View>
            </ExpressiveSurface>
            <Text
                numberOfLines={1}
                style={[styles.label, { color: theme.colors.onSurface }]}
            >
                {item.name}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 8,
    },
    surface: {
        overflow: 'hidden',
    },
    imageContainer: {
        flex: 1,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
    },
    title: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    label: {
        fontSize: 12,
        fontWeight: '500',
        paddingHorizontal: 4,
    },
});
