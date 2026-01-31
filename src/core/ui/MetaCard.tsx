import { useRouter } from 'expo-router';
import React from 'react';
import { Image as ExpoImage } from 'expo-image';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../core/ThemeContext';
import { MetaPreview } from '../services/AddonService';
import { Typography } from './Typography';

interface MetaCardProps {
    item: MetaPreview;
    width?: number;
    onPress?: () => void;
}

export const MetaCard = ({ item, width = 144, onPress }: MetaCardProps) => {
    const router = useRouter();
    const { theme } = useTheme();

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

    return (
        <View style={[styles.container, { width }]}> 
            <Pressable
                onPress={handlePress}
                accessibilityRole="button"
                android_ripple={{ color: 'rgba(255,255,255,0.08)', borderless: false }}
                style={({ pressed }) => [
                    styles.surface,
                    {
                        height,
                        backgroundColor: theme.colors.surfaceVariant,
                    },
                    pressed && styles.surfacePressed,
                ]}
            >
                <View style={styles.imageContainer}>
                    {item.poster ? (
                        <ExpoImage
                            recyclingKey={item.id}
                            source={{ uri: item.poster }}
                            style={styles.image}
                            contentFit="cover"
                            transition={Platform.OS === 'android' ? 0 : 150}
                            cachePolicy="memory-disk"
                        />
                    ) : (
                        <View style={styles.placeholder}>
                            <Typography
                                variant="label-small"
                                weight="bold"
                                numberOfLines={3}
                                style={{
                                    color: theme.colors.onSurfaceVariant,
                                    textAlign: 'center',
                                }}
                            >
                                {item.name}
                            </Typography>
                        </View>
                    )}
                </View>
            </Pressable>
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
        borderRadius: 12,
    },
    surfacePressed: {
        transform: [{ scale: 0.985 }],
        opacity: 0.92,
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
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    label: {
        paddingHorizontal: 0,
        marginTop: 2,
    },
});
