import { Typography } from '@/src/cdk/components/Typography';
import { Screen } from '@/src/cdk/layout/Screen';
import { useAddonStore } from '@/src/core/stores/addonStore';
import { useTheme } from '@/src/core/ThemeContext';
import { Search } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { CatalogRow } from '../../components/CatalogRow';

export default function DiscoverScreen() {
    const { manifests } = useAddonStore();
    const { theme } = useTheme();

    const allCatalogs = useMemo(() => {
        return Object.entries(manifests).flatMap(([url, manifest]) =>
            (manifest.catalogs || []).map(catalog => ({
                ...catalog,
                addonName: manifest.name,
                addonUrl: url
            }))
        );
    }, [manifests]);

    return (
        <Screen scrollable>
            {/* Header with Search Entry */}
            <View style={styles.header}>
                <Typography variant="h1" className="text-white font-extrabold tracking-tight">
                    Discover
                </Typography>
                <View style={[styles.searchBar, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                    <Search size={20} color={theme.colors.onSurfaceVariant} />
                    <TextInput
                        placeholder="Search for movies, TV shows..."
                        placeholderTextColor={theme.colors.onSurfaceVariant}
                        style={[styles.searchInput, { color: theme.colors.onSurface }]}
                        editable={false} // Redirect to search tab logic can go here
                    />
                </View>
            </View>

            <View className="pb-24 pt-4">
                {allCatalogs.length > 0 ? (
                    <View style={{ gap: 32 }}>
                        {allCatalogs.map((catalog, idx) => (
                            <CatalogRow
                                key={`${catalog.addonUrl}-${catalog.id}-${catalog.type}-${idx}`}
                                title={catalog.name || `${catalog.addonName} - ${catalog.type}`}
                                catalogType={catalog.type}
                                catalogId={catalog.id}
                            />
                        ))}
                    </View>
                ) : (
                    <View className="px-6 py-20 items-center justify-center">
                        <View style={[styles.emptyIcon, { backgroundColor: theme.colors.surfaceVariant }]}>
                            <Search size={32} color={theme.colors.onSurfaceVariant} />
                        </View>
                        <Typography variant="body" className="text-zinc-500 text-center mt-4">
                            No catalogs found. Add some addons to see content here.
                        </Typography>
                    </View>
                )}
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 20,
        paddingTop: 48,
        paddingBottom: 16,
        gap: 20,
    },
    searchBar: {
        height: 56,
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        gap: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
