import { useStreams } from '../hooks/useStreams';
import { useTheme } from '@/src/core/ThemeContext';
import { ExpressiveSurface } from '@/src/core/ui/ExpressiveSurface';
import { LoadingIndicator } from '@/src/core/ui/LoadingIndicator';
import { Typography } from '@/src/core/ui/Typography';
import type { Stream, StreamListItem } from '@/src/features/player/types/streams';
import type { StreamAddon } from '@/src/features/player/streams/streamAddons';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Image as ExpoImage } from 'expo-image';
import React from 'react';
import { ListRenderItem, ScrollView, StyleSheet, View } from 'react-native';
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
    onSelect: (stream: Stream) => void;
    hideHeader?: boolean;
    onStreamsLoaded?: (streams: Stream[]) => void;
    isVisible?: boolean;
    metadata?: StreamMetadata;
}

type AddonFilterValue = 'all' | string;

function getAddonLabel(addon: StreamAddon): string {
    return addon.name || addon.url;
}

function stripInternalStreamFields(item: StreamListItem): Stream {
    // Keep the payload stremio-like for downstream consumers.
    // Internal fields are for UI identity and filtering only.
    const { _streamKey, _sourceAddonUrl, _sourceAddonName, ...rest } = item;
    return rest;
}

function AddonFilterRow({
    addons,
    selected,
    countsByAddonUrl,
    totalCount,
    isFinal,
    onSelect,
}: {
    addons: StreamAddon[];
    selected: AddonFilterValue;
    countsByAddonUrl: Record<string, number>;
    totalCount: number;
    isFinal: boolean;
    onSelect: (value: AddonFilterValue) => void;
}) {
    const { theme } = useTheme();

    const values = React.useMemo<AddonFilterValue[]>(() => ['all', ...addons.map((a) => a.url)], [addons]);
    const activeIndex = React.useMemo(() => values.indexOf(selected), [selected, values]);

    if (addons.length <= 1) return null;

    const renderChip = (value: AddonFilterValue, label: string, count: number, disabled: boolean, index: number) => {
        const isSelected = selected === value;

        return (
            <View key={String(value)} style={{ opacity: disabled ? 0.45 : 1 }} pointerEvents={disabled ? 'none' : 'auto'}>
                <ExpressiveSurface
                    rounding="3xl"
                    selected={isSelected}
                    index={index}
                    activeIndex={activeIndex}
                    onPress={() => onSelect(value)}
                    style={styles.addonChip}
                >
                    <View style={styles.addonChipContent}>
                        <Typography
                            variant="label"
                            weight="bold"
                            numberOfLines={1}
                            style={{ color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface, maxWidth: 200 }}
                        >
                            {label}
                        </Typography>
                        <Typography
                            variant="label"
                            weight="black"
                            style={[styles.addonCountText, { color: isSelected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }]}
                        >
                            {count}
                        </Typography>
                    </View>
                </ExpressiveSurface>
            </View>
        );
    };

    return (
        <View style={styles.addonRow}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.addonRowContent}
                keyboardShouldPersistTaps="handled"
            >
                {renderChip('all', 'All', totalCount, false, 0)}
                {addons.map((addon, idx) => {
                    const count = countsByAddonUrl[addon.url] ?? 0;
                    const disabled = isFinal && count === 0;
                    return renderChip(addon.url, getAddonLabel(addon), count, disabled, idx + 1);
                })}
            </ScrollView>
        </View>
    );
}

export const StreamSelector = ({ type, id, onSelect, hideHeader = false, onStreamsLoaded, isVisible = true, metadata }: StreamSelectorProps) => {
    const { theme } = useTheme();
    const { bottom } = useSafeAreaInsets();

    const streamsQuery = useStreams(type, id, isVisible);
    const streams = streamsQuery.data;

    const isSearching = React.useMemo(() => {
        if (!isVisible) return false;
        if (!id) return true;
        return streamsQuery.fetchStatus === 'fetching';
    }, [id, isVisible, streamsQuery.fetchStatus]);

    const enabledAddonCount = streamsQuery.enabledAddonCount;
    const missingManifestCount = streamsQuery.missingManifestCount;
    const streamAddons = streamsQuery.streamAddons;
    const enabledStreamAddonCount = streamAddons.length;

    const [addonFilter, setAddonFilter] = React.useState<AddonFilterValue>('all');

    React.useEffect(() => {
        setAddonFilter('all');
    }, [id, type]);

    React.useEffect(() => {
        if (addonFilter === 'all') return;
        if (streamAddons.some((a) => a.url === addonFilter)) return;
        setAddonFilter('all');
    }, [addonFilter, streamAddons]);

    const countsByAddonUrl = React.useMemo(() => {
        const counts: Record<string, number> = {};
        for (const s of streams) {
            const url = s._sourceAddonUrl;
            if (!url) continue;
            counts[url] = (counts[url] ?? 0) + 1;
        }
        return counts;
    }, [streams]);

    const filteredStreams = React.useMemo(() => {
        if (addonFilter === 'all') return streams;
        return streams.filter((s) => s._sourceAddonUrl === addonFilter);
    }, [addonFilter, streams]);

    React.useEffect(() => {
        if (streams && onStreamsLoaded) {
            // Pre-process streams to match what StreamsTab expects
            const formattedStreams = streams.map((s) => {
                const baseStream = stripInternalStreamFields(s);
                const mainTitle = baseStream.name?.replace(/\n/g, ' ') || 'Stream';
                const subtitle = baseStream.title || baseStream.description || '';

                return {
                    ...baseStream,
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

    const handleSelect = React.useCallback((item: StreamListItem) => {
        onSelect(stripInternalStreamFields(item));
    }, [onSelect]);

    const keyExtractor = React.useCallback((item: StreamListItem, index: number) => {
        const key = item?._streamKey || item?.url || item?.infoHash;
        return key ? String(key) : String(index);
    }, []);

    const renderItem = React.useCallback<ListRenderItem<StreamListItem>>(({ item }: { item: StreamListItem }) => {
        if (!item) return null;

        const mainTitle = item.name?.replace(/\n/g, ' ') || 'Stream';
        const subtitle = item.title || item.description || '';

        const cardBg =
            (theme.colors as any).surfaceContainerHigh ||
            (theme.colors as any).surfaceContainer ||
            (theme.colors as any).surfaceContainerHighest ||
            theme.colors.surfaceVariant;

        return (
            <ExpressiveSurface
                variant="outlined"
                rounding="xl"
                disableLayoutAnimation
                onPress={() => handleSelect(item)}
                style={[styles.streamItem, { backgroundColor: cardBg, borderColor: theme.colors.outlineVariant }]}
            >
                <View style={styles.streamTextBlock}>
                    <Typography variant="title-medium" weight="bold" style={[styles.streamTitle, { color: theme.colors.onSurface }]}>
                        {mainTitle}
                    </Typography>
                    <Typography variant="body-small" style={[styles.streamSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                        {subtitle}
                    </Typography>
                </View>
            </ExpressiveSurface>
        );
    }, [handleSelect, theme.colors]);

    const header = React.useMemo(() => {
        if (!metadata) {
            if (hideHeader) return null;
            return (
                <View style={styles.simpleHeader}>
                    <Typography variant="headline-small" weight="black" style={{ color: theme.colors.onSurface }}>
                        Available Streams
                    </Typography>
                    <AddonFilterRow
                        addons={streamAddons}
                        selected={addonFilter}
                        countsByAddonUrl={countsByAddonUrl}
                        totalCount={streams.length}
                        isFinal={streamsQuery.isFetched}
                        onSelect={setAddonFilter}
                    />
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

                <AddonFilterRow
                    addons={streamAddons}
                    selected={addonFilter}
                    countsByAddonUrl={countsByAddonUrl}
                    totalCount={streams.length}
                    isFinal={streamsQuery.isFetched}
                    onSelect={setAddonFilter}
                />
            </View>
        );
    }, [addonFilter, countsByAddonUrl, hideHeader, metadata, streamAddons, streams.length, streamsQuery.isFetched, theme.colors]);

    const renderLoadingState = () => {
        if (!isSearching) return null;
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
        if (isSearching) return null;

        if (addonFilter !== 'all' && streamsQuery.isFetched && streams.length > 0) {
            const addonName = streamAddons.find((a) => a.url === addonFilter)?.name;
            const label = addonName || 'this addon';

            return (
                <View style={styles.empty}>
                    <Typography variant="body-large" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                        {`No streams from ${label} for this content.`}
                    </Typography>
                    <ExpressiveSurface
                        variant="outlined"
                        rounding="3xl"
                        onPress={() => setAddonFilter('all')}
                        style={[styles.resetFilterButton, { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primary }]}
                    >
                        <Typography variant="label" weight="black" style={{ color: theme.colors.onPrimaryContainer }}>
                            Show all streams
                        </Typography>
                    </ExpressiveSurface>
                </View>
            );
        }

        let message = 'No streams found for this content.';

        if (missingManifestCount > 0) {
            message = 'Syncing addon manifests...';
        } else if (enabledAddonCount === 0) {
            message = 'No addons enabled. Add one in Settings to find streams.';
        } else if (enabledStreamAddonCount === 0) {
            message = 'No stream addons enabled. Add one in Settings to find streams.';
        } else if (streamsQuery.isFetched) {
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

    if (!isVisible) return null;

    return (
        <View style={[{ flex: 1 }, (hideHeader || metadata) && { paddingTop: 0, paddingHorizontal: 0 }]}>
            <BottomSheetFlatList
                data={filteredStreams}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                ListHeaderComponent={header}
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
        marginBottom: 8,
    },
    addonRow: {
        marginBottom: 16,
    },
    addonRowContent: {
        gap: 10,
        paddingBottom: 16,
        paddingTop: 4,
    },
    addonChip: {
        paddingHorizontal: 16,
        height: 40,
        justifyContent: 'center',
    },
    addonChipContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    addonCountText: {
        marginLeft: 10,
        opacity: 0.8,
    },
    resetFilterButton: {
        marginTop: 14,
        paddingVertical: 10,
        paddingHorizontal: 14,
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
