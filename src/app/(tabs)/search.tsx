import { Touchable } from '@/src/cdk/components/Touchable';
import { Typography } from '@/src/cdk/components/Typography';
import { CatalogCard } from '@/src/components/CatalogCard';
import { AddonService } from '@/src/core/api/AddonService';
import { useAddonStore } from '@/src/core/stores/addonStore';
import { useTheme } from '@/src/core/ThemeContext';
import { useQuery } from '@tanstack/react-query';
import { Info, Search as SearchIcon, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

export default function SearchScreen() {
    const { theme } = useTheme();
    const [query, setQuery] = useState('');
    const { manifests } = useAddonStore();

    const addonUrls = Object.keys(manifests);

    const { data: results, isLoading } = useQuery({
        queryKey: ['search', query, addonUrls],
        queryFn: async () => {
            if (!query.trim()) return [];

            const types = ['movie', 'series'];
            const allResults = await Promise.allSettled(
                addonUrls.flatMap(url =>
                    types.map(type => AddonService.search(url, type, query))
                )
            );

            const flattened = allResults
                .filter((r): r is PromiseFulfilledResult<{ metas: any[] }> => r.status === 'fulfilled')
                .flatMap(r => r.value.metas);

            // Deduplicate
            const seen = new Set();
            return flattened.filter(m => {
                const key = `${m.type}-${m.id}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        },
        enabled: query.trim().length > 2,
    });

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.header}>
                <Typography variant="h1" className="text-white font-extrabold tracking-tight mb-4">Search</Typography>
                <View style={[styles.searchBar, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                    <SearchIcon size={20} color={theme.colors.onSurfaceVariant} />
                    <TextInput
                        placeholder="Search for movies, TV shows..."
                        placeholderTextColor={theme.colors.onSurfaceVariant}
                        style={[styles.input, { color: theme.colors.onSurface }]}
                        value={query}
                        onChangeText={setQuery}
                        autoFocus
                    />
                    {query.length > 0 && (
                        <Touchable onPress={() => setQuery('')}>
                            <X size={20} color={theme.colors.onSurfaceVariant} />
                        </Touchable>
                    )}
                </View>
            </View>

            {query.length > 2 ? (
                <FlatList
                    data={results}
                    keyExtractor={(item, index) => `${item.id}-${index}`}
                    numColumns={3}
                    contentContainerStyle={styles.listContent}
                    columnWrapperStyle={styles.columnWrapper}
                    renderItem={({ item }) => (
                        <View style={styles.gridItem}>
                            <CatalogCard item={item} />
                        </View>
                    )}
                    ListEmptyComponent={() => !isLoading && (
                        <View style={styles.empty}>
                            <View style={[styles.infoIcon, { backgroundColor: theme.colors.surfaceVariant }]}>
                                <Info size={32} color={theme.colors.onSurfaceVariant} />
                            </View>
                            <Typography variant="body" className="text-zinc-500 mt-4">
                                No results found for "{query}"
                            </Typography>
                        </View>
                    )}
                />
            ) : (
                <View style={styles.empty}>
                    <View style={[styles.infoIcon, { backgroundColor: theme.colors.surfaceVariant }]}>
                        <SearchIcon size={32} color={theme.colors.onSurfaceVariant} />
                    </View>
                    <Typography variant="body" className="text-zinc-500 mt-4">
                        Search across all your addons
                    </Typography>
                </View>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 64,
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 56,
        borderRadius: 28,
        gap: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: 12,
        paddingBottom: 100,
    },
    columnWrapper: {
        justifyContent: 'flex-start',
        gap: 8,
        marginBottom: 8,
    },
    gridItem: {
        width: '32%',
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    infoIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
