import { Typography } from '@/src/cdk/components/Typography';
import { Image as ExpoImage } from 'expo-image';
import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

const CastItem = memo(({ person, theme, onPress, palette }: { person: any; theme: any; onPress: () => void; palette: any }) => {
    return (
        <Pressable onPress={onPress}>
            <View style={styles.castItem}>
                <ExpoImage
                    source={person.profile ? { uri: person.profile } : require('@/assets/images/icon.png')}
                    style={[styles.castImage, { borderColor: palette.primary, borderWidth: 1 }]}
                />
                <Typography
                    variant="label"
                    weight="black"
                    numberOfLines={1}
                    style={{ color: theme.colors.onSurface, marginTop: 8, fontSize: 12 }}
                >
                    {person.name}
                </Typography>
                <Typography
                    variant="label"
                    weight="medium"
                    numberOfLines={1}
                    style={{ color: theme.colors.onSurfaceVariant, opacity: 0.6, fontSize: 11 }}
                >
                    {person.character}
                </Typography>
            </View>
        </Pressable>
    );
});

interface CastSectionProps {
    cast: any[];
    theme: any;
    colors: any;
    onPersonPress: (id: string) => void;
}

export const CastSection = memo(({ cast, theme, colors, onPersonPress }: CastSectionProps) => {
    if (!cast || cast.length === 0) return null;

    return (
        <View style={styles.section}>
            <Typography variant="h3" weight="black" style={styles.sectionTitle}>Cast</Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.castScroll}>
                {cast.map((person) => (
                    <CastItem
                        key={person.id}
                        person={person}
                        theme={theme}
                        palette={colors}
                        onPress={() => onPersonPress(person.id)}
                    />
                ))}
            </ScrollView>
        </View>
    );
});

const styles = StyleSheet.create({
    section: {
        marginTop: 24,
    },
    sectionTitle: {
        color: 'white',
        marginBottom: 16,
    },
    castScroll: {
        gap: 16,
    },
    castItem: {
        width: 100,
        alignItems: 'center',
    },
    castImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
    }
});
