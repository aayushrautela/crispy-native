import { SectionHeader } from '@/src/core/ui/SectionHeader';
import { Typography } from '@/src/core/ui/Typography';
import { Image as ExpoImage } from 'expo-image';
import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

const CastItem = memo(({ person, theme, onPress, palette }: { person: any; theme: any; onPress: () => void; palette: any }) => {
    return (
        <Pressable onPress={onPress}>
            <View style={styles.castItem}>
                <ExpoImage
                    source={person.profile ? { uri: person.profile } : require('@/assets/images/icon.png')}
                    style={styles.castImage}
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
    palette: any;
    onPersonPress: (id: string) => void;
}

export const CastSection = memo(({ cast, theme, colors, palette, onPersonPress }: CastSectionProps) => {
    if (!cast || cast.length === 0) return null;

    return (
        <View style={styles.section}>
            <SectionHeader
                title="Cast"
                hideAction
                style={{ paddingHorizontal: 20 }}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.castScroll}>
                {cast.map((person, index) => (
                    <CastItem
                        key={`${person.id}-${index}`}
                        person={person}
                        theme={theme}
                        palette={palette}
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
    castScroll: {
        gap: 16,
        paddingHorizontal: 20,
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
