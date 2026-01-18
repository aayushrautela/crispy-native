import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Text, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '@/src/core/ThemeContext';
import { Search as SearchIcon, SlidersHorizontal } from 'lucide-react-native';
import { MetaCard } from '@/src/cdk/components/MetaCard';
import { Touchable } from '@/src/cdk/components/Touchable';
import { useAddonStore } from '@/src/core/stores/addonStore';
import { ContentRow } from '@/src/cdk/components/ContentRow';
import { AddonService, MetaPreview } from '@/src/core/api/AddonService';
import { useQuery } from '@tanstack/react-query';

export default function SearchScreen() {
    const { theme } = useTheme();
    const [query, setQuery] = useState('');
    const [addonSearchEnabled, setAddonSearchEnabled] = useState(false);
    const { manifests } = useAddonStore();

    const addonUrls = Object.keys(manifests);

    const { data: results, isLoading } = useQuery({
        queryKey: ['search', query, addonSearchEnabled, addonUrls],
        queryFn: async () => {
            if (!query.trim()) return { additive: [], tmdb: [] };

            // In a real scenario, we'd query TMDB here. 
            // For now, let's query all addons if enabled
            if (addonSearchEnabled) {
                const addonResults = await Promise.allSettled(
                    addonUrls.map(url => AddonService.search(url, 'movie', query))
                );

                const groups = addonResults
                    .map((r, i) => ({
                        status: r.status,
                        value: r.status === 'fulfilled' ? r.value : null,
                        addonName: manifests[addonUrls[i]].name
                    }))
                    .filter(g => g.value && g.value.metas.length > 0);

                return { additive: groups, tmdb: [] };
            }

            return { additive: [], tmdb: [] };
        },
        enabled: !!query.trim(),
    });

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.header}>
                <View style={[styles.searchBar, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <SearchIcon size={20} color={theme.colors.onSurfaceVariant} />
                    <TextInput
                        placeholder="Search movies & shows..."
                        placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                        style={[styles.input, { color: theme.colors.onSurface }]}
                        value={query}
                        onChangeText={setQuery}
                        autoFocus
                    />
                    <Touchable
                        onPress={() => setAddonSearchEnabled(!addonSearchEnabled)}
                        style={[
                            styles.toggle,
                            addonSearchEnabled && { backgroundColor: theme.colors.primaryContainer }
                        ]}
                    >
                        <SlidersHorizontal
                            size={20}
                            color={addonSearchEnabled ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant}
                        />
                    </Touchable>
                </View>
            </View>

            {query.trim() ? (
                <FlatList
                    data={results?.tmdb || []}
                    keyExtractor={(item) => item.id}
                    numColumns={3}
                    ListHeaderComponent={() => (
                        <View>
                            {results?.additive.map((group: any) => (
                                <ContentRow
                                    key={group.addonName}
                                    title={group.addonName}
                                    items={group.value.metas}
                                />
                            ))}
                            {(results?.tmdb?.length ?? 0) > 0 && (
                                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>TMDB Results</Text>
                            )}
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <View style={styles.gridItem}>
                            <MetaCard item={item} width={110} />
                        </View>
                    )}
                    ListEmptyComponent={() => !isLoading && (
                        <View style={styles.empty}>
                            <Text style={{ color: theme.colors.onSurfaceVariant }}>No results found</Text>
                        </View>
                    )}
                />
            ) : (
                <View style={styles.empty}>
                    <SearchIcon size={64} color={theme.colors.surfaceVariant} />
                    <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>Search across your addons</Text>
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
        paddingHorizontal: 16,
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
        fontWeight: '500',
    },
    toggle: {
        padding: 8,
        borderRadius: 20,
    },
    listContent: {
        paddingBottom: 100,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        paddingHorizontal: 20,
        marginTop: 16,
        marginBottom: 12,
    },
    gridItem: {
        flex: 1 / 3,
        alignItems: 'center',
        padding: 8,
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.5,
        paddingTop: 100,
    }
});
