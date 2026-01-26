import { AddonService } from '@/src/core/services/AddonService';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { ExpressiveSurface } from '@/src/core/ui/ExpressiveSurface';
import { LoadingIndicator } from '@/src/core/ui/LoadingIndicator';
import { Typography } from '@/src/core/ui/Typography';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import { Cpu, Globe, Play } from 'lucide-react-native';
import React from 'react';
import { ListRenderItem, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StreamSelectorProps {
    type: string;
    id: string;
    onSelect: (stream: any) => void;
    hideHeader?: boolean;
    onStreamsLoaded?: (streams: any[]) => void;
}

export const StreamSelector = ({ type, id, onSelect, hideHeader = false, onStreamsLoaded }: StreamSelectorProps) => {
    const { theme } = useTheme();
    const { manifests } = useUserStore();
    const { bottom } = useSafeAreaInsets();

    const { data: streams, isLoading } = useQuery({
        queryKey: ['streams', type, id],
        queryFn: async () => {
            console.log(`[StreamSelector] Fetching streams for type: ${type}, id: ${id}`);
            const addonUrls = Object.keys(manifests);

            const streamAddons = addonUrls.filter(url => {
                const m = manifests[url];
                const supportsStreams = m?.resources?.some(r =>
                    typeof r === 'string' ? r === 'stream' : r?.name === 'stream'
                );
                console.log(`[StreamSelector] Addon ${m?.name || url} supports streams: ${supportsStreams}`);
                return supportsStreams;
            });

            if (streamAddons.length === 0) {
                console.warn('[StreamSelector] No addons support "stream" resource');
                return [];
            }

            const results = await Promise.allSettled(
                streamAddons.map(url => {
                    console.log(`[StreamSelector] Calling AddonService.getStreams for ${url}`);
                    return AddonService.getStreams(url, type, id);
                })
            );

            const fetchedStreams = results
                .filter((r): r is PromiseFulfilledResult<{ streams: any[] }> => r.status === 'fulfilled')
                .flatMap(r => r.value.streams || [])
                .filter(Boolean);

            console.log(`[StreamSelector] Found ${fetchedStreams.length} streams`);
            return fetchedStreams;
        },
    });

    React.useEffect(() => {
        if (streams && onStreamsLoaded) {
            // Pre-process streams to match what StreamsTab expects
            const formattedStreams = streams.map(s => {
                const mainTitle = s.name?.replace(/\n/g, ' ') || "Stream";
                const subtitle = s.title || s.description || "";

                // Extract quality/size if possible or pass subtitle as is
                // StreamsTab expects: title, quality?, size?
                // We'll map mainTitle -> title, and put details in quality/size if we can parse them,
                // or just put subtitle in quality for now to ensure visibility.

                return {
                    ...s,
                    title: mainTitle, // The addon name / main identifier
                    quality: subtitle, // Detailed description
                    // We can add more parsing logic here if needed
                };
            });
            onStreamsLoaded(formattedStreams);
        }
    }, [streams, onStreamsLoaded]);

    const renderBadges = (title: string) => {
        const badges = [];
        const lowerTitle = title.toLowerCase();

        if (lowerTitle.includes('4k') || lowerTitle.includes('2160p')) badges.push({ text: '4K', color: '#FFD700' });
        else if (lowerTitle.includes('1080p')) badges.push({ text: '1080p', color: '#E0E0E0' });
        else if (lowerTitle.includes('720p')) badges.push({ text: '720p', color: '#BDBDBD' });

        if (lowerTitle.includes('hdr')) badges.push({ text: 'HDR', color: '#FF4081' });
        if (lowerTitle.includes('dv') || lowerTitle.includes('vision')) badges.push({ text: 'DV', color: '#7C4DFF' });
        if (lowerTitle.includes('dolby') || lowerTitle.includes('5.1') || lowerTitle.includes('7.1')) badges.push({ text: 'DDP', color: '#00E5FF' });

        if (badges.length === 0) return null;

        return (
            <View style={styles.badgeRow}>
                {badges.map((b, i) => (
                    <View key={i} style={[styles.badge, { borderColor: b.color + '40' }]}>
                        <Typography variant="label-small" weight="black" style={{ color: b.color, fontSize: 9 }}>
                            {b.text}
                        </Typography>
                    </View>
                ))}
            </View>
        );
    };

    const renderItem: ListRenderItem<any> = ({ item, index }) => {
        if (!item) return null;

        const mainTitle = item.name?.replace(/\n/g, ' ') || "Stream";
        const subtitle = item.title || item.description || "";

        const isTorrent = !!item.infoHash;
        const isYT = !!item.ytId;

        return (
            <View style={{ paddingHorizontal: hideHeader ? 20 : 24, marginBottom: 12 }}>
                <ExpressiveSurface
                    variant="tonal"
                    rounding="xl"
                    onPress={() => onSelect(item)}
                    style={styles.streamItem}
                >
                    <View style={[styles.iconBox, { backgroundColor: theme.colors.surfaceContainer }]}>
                        {isTorrent ? (
                            <Cpu size={22} color={theme.colors.primary} />
                        ) : isYT ? (
                            <Globe size={22} color={"#FF0000"} />
                        ) : (
                            <Globe size={22} color={theme.colors.secondary} />
                        )}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="title-medium" weight="bold" style={{ color: theme.colors.onSecondaryContainer }}>
                                {mainTitle}
                            </Typography>
                            {renderBadges(subtitle)}
                        </View>
                        <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.8 }}>
                            {subtitle}
                        </Typography>
                    </View>
                    <View style={[styles.playButton, { backgroundColor: theme.colors.primary + '15' }]}>
                        <Play size={16} color={theme.colors.primary} fill={theme.colors.primary} />
                    </View>
                </ExpressiveSurface>
            </View>
        );
    };

    if (isLoading) {
        return (
            <View style={styles.loading}>
                <LoadingIndicator color={theme.colors.primary} />
                <Typography variant="body-medium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                    Searching for streams...
                </Typography>
            </View>
        );
    }

    return (
        <View style={[styles.container, hideHeader && { paddingTop: 0, paddingHorizontal: 0 }]}>
            {!hideHeader && (
                <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
                    <Typography variant="headline-small" weight="black" style={{ color: theme.colors.onSurface }}>
                        Available Streams
                    </Typography>
                </View>
            )}

            <BottomSheetFlatList
                data={streams || []}
                keyExtractor={(item, index) => `${item.url || index}-${index}`}
                renderItem={renderItem}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Typography variant="body-large" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                            No streams found for this content. Try adding more addons in Settings.
                        </Typography>
                    </View>
                }
                contentContainerStyle={{ paddingBottom: bottom + 40 }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: 32,
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
    streamItem: {
        padding: 16,
        paddingLeft: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 4,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
    }
});
