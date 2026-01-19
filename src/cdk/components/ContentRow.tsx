import React from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MetaPreview } from '../../core/api/AddonService';
import { useTheme } from '../../core/ThemeContext';
import { MetaCard } from './MetaCard';

interface ContentRowProps {
    title: string;
    items?: MetaPreview[];
    isLoading?: boolean;
}

export const ContentRow = ({ title, items = [], isLoading }: ContentRowProps) => {
    const { theme } = useTheme();
    const CARD_WIDTH = 144; // Matches WebUI Mobile w-[144px]

    return (
        <View style={styles.container}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                {title}
            </Text>

            {isLoading ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {[...Array(6)].map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.skeleton,
                                {
                                    backgroundColor: theme.colors.surfaceContainerHighest || theme.colors.surfaceVariant,
                                    width: CARD_WIDTH,
                                    height: CARD_WIDTH / (2 / 3),
                                    borderRadius: 16 // rounding-lg
                                }
                            ]}
                        />
                    ))}
                </ScrollView>
            ) : (
                <FlatList
                    data={items}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.scrollContent}
                    renderItem={({ item }) => (
                        <MetaCard item={item} width={CARD_WIDTH} />
                    )}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8, // py-2 in webui
    },
    title: {
        fontSize: 20, // Headline Small approx
        fontWeight: '700',
        paddingHorizontal: 24, // px-6 in webui
        marginBottom: 16, // mb-4 in webui
        letterSpacing: -0.2,
    },
    scrollContent: {
        paddingHorizontal: 24,
        gap: 16, // gap-4 in webui (16px)
    },
    skeleton: {
        opacity: 0.5,
    },
});
