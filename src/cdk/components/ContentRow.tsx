import React from 'react';
import { StyleSheet, View, Text, ScrollView, FlatList } from 'react-native';
import { MetaCard } from './MetaCard';
import { MetaPreview } from '../../core/api/AddonService';
import { useTheme } from '../../core/ThemeContext';

interface ContentRowProps {
    title: string;
    items?: MetaPreview[];
    isLoading?: boolean;
}

export const ContentRow = ({ title, items = [], isLoading }: ContentRowProps) => {
    const { theme } = useTheme();

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
                                { backgroundColor: theme.colors.surfaceVariant, width: 120, height: 180, borderRadius: 28 }
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
                        <MetaCard item={item} width={120} />
                    )}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        paddingHorizontal: 20,
        marginBottom: 12,
        letterSpacing: 0.1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        gap: 12,
    },
    skeleton: {
        opacity: 0.5,
    },
});
