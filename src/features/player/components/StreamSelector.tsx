import { useStreams } from '../hooks/useStreams';
import { useTheme } from '@/src/core/ThemeContext';
import { useUserStore } from '@/src/core/stores/userStore';
import { ExpressiveSurface } from '@/src/core/ui/ExpressiveSurface';
import { LoadingIndicator } from '@/src/core/ui/LoadingIndicator';
import { Typography } from '@/src/core/ui/Typography';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Image as ExpoImage } from 'expo-image';
import React from 'react';
import { ListRenderItem, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface StreamMetadata {
    title: string;
    subtitle?: string;
    overview?: string;
    thumbnail?: string;
}

interface StreamSelectorProps {
    type: string;
    id: string;
    onSelect: (stream: any) => void;
    hideHeader?: boolean;
    onStreamsLoaded?: (streams: any[]) => void;
    isVisible?: boolean;
    metadata?: StreamMetadata;
}

export const StreamSelector = ({ type, id, onSelect, hideHeader = false, onStreamsLoaded, isVisible = true, metadata }: StreamSelectorProps) => {
    const { theme } = useTheme();
    const { bottom } = useSafeAreaInsets();

    const addons = useUserStore((s) => s.addons);
    const manifests = useUserStore((s) => s.manifests);

    const { data: streams, isLoading } = useStreams(type, id, isVisible);

    const stremioType = React.useMemo(() => (type === 'movie' ? 'movie' : 'series'), [type]);

    const enabledAddons = React.useMemo(() => addons.filter((a) => a.enabled !== false), [addons]);

    const missingManifestCount = React.useMemo(
        () => enabledAddons.filter((addon) => !manifests[addon.url]).length,
        [enabledAddons, manifests]
    );

    const enabledStreamAddonCount = React.useMemo(() => {
        return enabledAddons.filter((addon) => {
            const m = manifests[addon.url];
            return m?.resources?.some((r) => {
                if (typeof r === 'string') return r === 'stream';
                if (r?.name !== 'stream') return false;
                if (Array.isArray(r.types) && r.types.length > 0 && !r.types.includes(stremioType)) return false;
                return true;
            });
        }).length;
    }, [enabledAddons, manifests, stremioType]);

    React.useEffect(() => {
        if (streams && onStreamsLoaded) {
            // Pre-process streams to match what StreamsTab expects
            const formattedStreams = streams.map(s => {
                const mainTitle = s.name?.replace(/\n/g, ' ') || "Stream";
                const subtitle = s.title || s.description || "";

                return {
                    ...s,
                    title: mainTitle,
                    quality: subtitle,
                };
            });
            onStreamsLoaded(formattedStreams);
        }
    }, [streams, onStreamsLoaded]);

    const listPaddingHorizontal = React.useMemo(() => (hideHeader ? 20 : 24), [hideHeader]);

    const contentContainerStyle = React.useMemo(
        () => ({
            // Let the sheet control overall sizing; keep just enough room for gesture nav.
            paddingBottom: Math.max(bottom, 12) + 12,
            paddingHorizontal: listPaddingHorizontal,
        }),
        [bottom, listPaddingHorizontal]
    );

    const handleSelect = React.useCallback((item: any) => {
        onSelect(item);
    }, [onSelect]);

    const keyExtractor = React.useCallback((item: any, index: number) => {
        const key = item?.url || item?.id || item?.infoHash;
        return key ? String(key) : String(index);
    }, []);

    const renderItem = React.useCallback<ListRenderItem<any>>(({ item }: { item: any }) => {
        if (!item) return null;

        const mainTitle = item.name?.replace(/\n/g, ' ') || 'Stream';
        const subtitle = item.title || item.description || '';

        return (
            <ExpressiveSurface
                variant="tonal"
                rounding="none"
                disableLayoutAnimation
                onPress={() => handleSelect(item)}
                style={styles.streamItem}
            >
                <View style={styles.streamTextBlock}>
                    <Typography variant="title-medium" weight="bold" style={[styles.streamTitle, { color: theme.colors.onSecondaryContainer }]}>
                        {mainTitle}
                    </Typography>
                    <Typography variant="body-small" style={[styles.streamSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                        {subtitle}
                    </Typography>
                </View>
            </ExpressiveSurface>
        );
    }, [handleSelect, theme.colors.onSecondaryContainer, theme.colors.onSurfaceVariant]);

    const renderHeader = () => {
        if (!metadata) {
            if (hideHeader) return null;
            return (
                <View style={styles.simpleHeader}>
                    <Typography variant="headline-small" weight="black" style={{ color: theme.colors.onSurface }}>
                        Available Streams
                    </Typography>
                </View>
            );
        }

        return (
            <View style={styles.headerContainer}>
                <View style={styles.metaRow}>
                    {metadata.thumbnail && (
                        <ExpoImage
                            source={{ uri: metadata.thumbnail }}
                            style={styles.thumbnail}
                            contentFit="cover"
                        />
                    )}
                    <View style={styles.titleStack}>
                        <Typography variant="title-large" weight="black" numberOfLines={1}>
                            {metadata.title}
                        </Typography>
                        {metadata.subtitle && (
                            <Typography variant="label" weight="bold" style={{ opacity: 0.6 }}>
                                {metadata.subtitle}
                            </Typography>
                        )}
                    </View>
                </View>

                {metadata.overview && (
                    <Typography variant="body-medium" style={styles.overview} numberOfLines={4}>
                        {metadata.overview}
                    </Typography>
                )}

                <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

                <Typography variant="label" weight="black" style={styles.sectionLabel}>
                    SELECT AN OPTION
                </Typography>
            </View>
        );
    };

    const renderLoadingState = () => {
        if (!isLoading) return null;
        return (
            <View style={styles.loading}>
                <LoadingIndicator size={48} color={theme.colors.primary} />
                <Typography variant="body-medium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                    Searching for streams...
                </Typography>
            </View>
        );
    };

    const renderEmptyState = () => {
        if (isLoading) return null;

        let message = 'No streams found for this content.';

        if (missingManifestCount > 0) {
            message = 'Syncing addon manifests...';
        } else if (enabledAddons.length === 0) {
            message = 'No addons enabled. Add one in Settings to find streams.';
        } else if (enabledStreamAddonCount === 0) {
            message = 'No stream addons enabled. Add one in Settings to find streams.';
        } else {
            message = 'No streams returned from your addons for this content.';
        }

        return (
            <View style={styles.empty}>
                <Typography variant="body-large" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                    {message}
                </Typography>
            </View>
        );
    };

    if (!isVisible) {
        return (
            <View style={styles.loading}>
                <LoadingIndicator size={48} color={theme.colors.primary} />
                <Typography variant="body-medium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                    Searching for streams...
                </Typography>
            </View>
        );
    }

    return (
        <View style={[{ flex: 1 }, (hideHeader || metadata) && { paddingTop: 0, paddingHorizontal: 0 }]}>
            <BottomSheetFlatList
                data={streams || []}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                style={{ flex: 1 }}
                ListEmptyComponent={renderEmptyState}
                ListFooterComponent={renderLoadingState}
                contentContainerStyle={contentContainerStyle}
                removeClippedSubviews
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        // Handled via inline styles for better nesting control
    },
    simpleHeader: {
        paddingHorizontal: 0,
        marginBottom: 24,
        paddingTop: 32,
    },
    headerContainer: {
        paddingHorizontal: 0,
        paddingTop: 12,
        marginBottom: 8,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
    },
    thumbnail: {
        width: 100,
        height: 56,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    titleStack: {
        flex: 1,
        gap: 2,
    },
    overview: {
        opacity: 0.8,
        lineHeight: 20,
        marginBottom: 20,
    },
    divider: {
        height: 1,
        width: '100%',
        marginBottom: 20,
        opacity: 0.2,
    },
    sectionLabel: {
        opacity: 0.5,
        fontSize: 12,
        letterSpacing: 1,
        marginBottom: 12,
    },
    loading: {
        height: 300,
        alignItems: 'center',
        justifyContent: 'center',
    },
    empty: {
        padding: 40,
        alignItems: 'center',
    },
    separator: {
        height: 8,
    },
    streamItem: {
        width: '100%',
        borderRadius: 10,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    streamTextBlock: {
        width: '100%',
        gap: 2,
    },
    streamTitle: {
        lineHeight: 20,
    },
    streamSubtitle: {
        opacity: 0.8,
    },
});
