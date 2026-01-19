import { ExpressiveButton } from '@/src/cdk/components/ExpressiveButton';
import { Typography } from '@/src/cdk/components/Typography';
import { MetaPreview } from '@/src/core/api/AddonService';
import { useCatalog } from '@/src/core/hooks/useDiscovery';
import { useTheme } from '@/src/core/ThemeContext';
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { CatalogCard } from './CatalogCard';

const CARD_WIDTH = 140;
const ITEM_GAP = 16;
const SNAP_INTERVAL = CARD_WIDTH + ITEM_GAP;

interface CatalogRowProps {
    title: string;
    items?: MetaPreview[];
    isLoading?: boolean;
    onSeeAll?: () => void;
    catalogType?: string;
    catalogId?: string;
    extra?: Record<string, any>;
    addonUrl?: string;
}

export const CatalogRow = ({
    title,
    items: propItems,
    isLoading: propLoading,
    onSeeAll,
    catalogType,
    catalogId,
    extra,
    addonUrl
}: CatalogRowProps) => {
    const { theme } = useTheme();

    const { data, isLoading: queryLoading } = useCatalog(
        catalogType || '',
        catalogId || '',
        extra,
        addonUrl
    );

    const items = propItems || data?.metas || [];
    const isLoading = propLoading || (!!catalogId && queryLoading);

    if (!isLoading && items.length === 0 && !!catalogId) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Typography
                    variant="h2"
                    weight="black"
                    style={{
                        color: theme.colors.onSurface,
                        fontSize: 20,
                        letterSpacing: -0.5
                    }}
                >
                    {title}
                </Typography>
                <ExpressiveButton
                    title="See All"
                    variant="text"
                    onPress={onSeeAll || (() => { })}
                    size="sm"
                    style={styles.seeAllBtn}
                    textStyle={{ color: theme.colors.primary, fontWeight: '700' }}
                />
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
                                {
                                    backgroundColor: theme.colors.surfaceVariant,
                                    width: CARD_WIDTH,
                                    height: CARD_WIDTH * 1.5,
                                    borderRadius: 12 // Matches lg rounding
                                }
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
                        <CatalogCard item={item} width={CARD_WIDTH} />
                    )}
                    snapToInterval={SNAP_INTERVAL}
                    decelerationRate="fast"
                    snapToAlignment="start"
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
        marginBottom: 8,
    },
    seeAllBtn: {
        marginRight: -8,
    },
    scrollContent: {
        paddingHorizontal: 20,
        gap: ITEM_GAP,
    },
    skeleton: {
        opacity: 0.2, // Subtle skeleton
    },
});
