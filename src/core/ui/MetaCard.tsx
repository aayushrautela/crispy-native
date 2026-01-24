import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { MetaPreview } from '../../core/api/AddonService';
import { useTheme } from '../../core/ThemeContext';
import { ExpressiveSurface } from './ExpressiveSurface';
import { Typography } from './Typography';

interface MetaCardProps {
    item: MetaPreview;
    width?: number;
    onPress?: () => void;
}

export const MetaCard = ({ item, width = 144, onPress }: MetaCardProps) => {
    const router = useRouter();
    const { theme } = useTheme();
    const [focused, setFocused] = useState(false);

    const aspectRatio = item.posterShape === 'landscape' ? 16 / 9 : item.posterShape === 'square' ? 1 : 2 / 3;
    const height = width / aspectRatio;

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            router.push({
                pathname: '/meta/[id]',
                params: { id: item.id }
            });
        }
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
                rounding="lg" // Standard MD3 rounded-xl equivalent
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
            <Typography
                variant="body-small"
                weight="bold"
                numberOfLines={1}
                style={{
                    color: theme.colors.onSurface,
                    marginTop: 4
                }}
            >
                {item.name}
            </Typography>
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
        paddingHorizontal: 0,
        marginTop: 2,
    },
});
