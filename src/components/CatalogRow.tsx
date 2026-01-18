import { ExpressiveButton } from '@/src/cdk/components/ExpressiveButton';
import { MetaPreview } from '@/src/core/api/AddonService';
import { useCatalog } from '@/src/core/hooks/useDiscovery';
import { useTheme } from '@/src/core/ThemeContext';
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { CatalogCard } from './CatalogCard';

interface CatalogRowProps {
    title: string;
    items?: MetaPreview[];
    isLoading?: boolean;
    onSeeAll?: () => void;
    // Optional props for self-fetching
    catalogType?: string;
    catalogId?: string;
    extra?: Record<string, any>;
}

export const CatalogRow = ({
    title,
    items: propItems,
    isLoading: propLoading,
    onSeeAll,
    catalogType,
    catalogId,
    extra
}: CatalogRowProps) => {
    const { theme } = useTheme();

    const { data, isLoading: queryLoading } = useCatalog(
        catalogType || '',
        catalogId || '',
        extra
    );

    const items = propItems || data?.metas || [];
    const isLoading = propLoading || (!!catalogId && queryLoading);

    // Don't render empty rows unless loading
    if (!isLoading && items.length === 0 && !!catalogId) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                    {title}
                </Text>
                {onSeeAll && (
                    <ExpressiveButton
                        title="See All"
                        variant="text"
                        onPress={onSeeAll}
                        style={styles.seeAllBtn}
                    />
                )}
            </View>

            {isLoading ? (
                <FlatList
                    data={[...Array(6)]}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    renderItem={() => (
                        <View
                            style={[
                                styles.skeleton,
                                { backgroundColor: theme.colors.surfaceVariant, width: 120, height: 180, borderRadius: 28 }
                            ]}
                        />
                    )}
                />
            ) : (
                <FlatList
                    data={items}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item, index) => `${item.id}-${index}`}
                    contentContainerStyle={styles.scrollContent}
                    renderItem={({ item }) => (
                        <CatalogCard item={item} width={120} />
                    )}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: 0.1,
    },
    seeAllBtn: {
        marginRight: -8,
    },
    scrollContent: {
        paddingHorizontal: 16,
        gap: 12,
    },
    skeleton: {
        opacity: 0.5,
    },
});
