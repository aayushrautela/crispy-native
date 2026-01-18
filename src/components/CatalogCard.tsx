import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { MetaPreview } from '@/src/core/api/AddonService';
import { useTheme } from '@/src/core/ThemeContext';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface CatalogCardProps {
    item: MetaPreview;
    width?: number;
}

export const CatalogCard = ({ item, width = 120 }: CatalogCardProps) => {
    const router = useRouter();
    const { theme } = useTheme();
    const [focused, setFocused] = useState(false);

    // Stremio poster shapes: poster (2:3), landscape (16:9), square (1:1)
    const aspectRatio = item.posterShape === 'landscape' ? 16 / 9 : item.posterShape === 'square' ? 1 : 2 / 3;
    const height = width / aspectRatio;

    const handlePress = () => {
        router.push({
            pathname: `/meta/${item.id}`,
            params: { type: item.type }
        });
    };

    const animatedImageStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: withSpring(focused ? 1.05 : 1) }],
        };
    });

    return (
        <View style={[styles.container, { width }]}>
            <ExpressiveSurface
                variant="filled"
                rounding="xl"
                style={[styles.surface, { height, borderColor: focused ? theme.colors.primary : 'transparent' }]}
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
                            <Text style={[styles.placeholderTitle, { color: theme.colors.onSurfaceVariant }]}>
                                {item.name}
                            </Text>
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
        borderWidth: 2,
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
    placeholderTitle: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        paddingHorizontal: 4,
        letterSpacing: 0.2,
    },
});
