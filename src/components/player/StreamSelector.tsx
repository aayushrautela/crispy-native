import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { Typography } from '@/src/cdk/components/Typography';
import { AddonService } from '@/src/core/api/AddonService';
import { useAddonStore } from '@/src/core/stores/addonStore';
import { useTheme } from '@/src/core/ThemeContext';
import { useQuery } from '@tanstack/react-query';
import { Cpu, Globe, Play } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

interface StreamSelectorProps {
    type: string;
    id: string;
    onSelect: (stream: any) => void;
}

export const StreamSelector = ({ type, id, onSelect }: StreamSelectorProps) => {
    const { theme } = useTheme();
    const { manifests } = useAddonStore();

    const { data: streams, isLoading } = useQuery({
        queryKey: ['streams', type, id],
        queryFn: async () => {
            const addonUrls = Object.keys(manifests);
            const results = await Promise.allSettled(
                addonUrls.map(url => AddonService.getStreams(url, type, id))
            );

            return results
                .filter((r): r is PromiseFulfilledResult<{ streams: any[] }> => r.status === 'fulfilled')
                .flatMap(r => r.value.streams)
                .filter(Boolean); // Defensive: filter out null/undefined
        },
    });

    if (isLoading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>Searching for streams...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Typography variant="h3" className="text-white mb-6">Available Streams</Typography>

            <FlatList
                data={streams}
                keyExtractor={(_, index) => index.toString()}
                contentContainerStyle={{ gap: 12 }}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Typography variant="body" className="text-zinc-500 text-center">
                            No streams found for this content. Try adding more addons in Settings.
                        </Typography>
                    </View>
                }
                renderItem={({ item }) => {
                    if (!item) return null; // Defensive check

                    // Align with Crispy-webui: stream.name is the addon/source, stream.title is metadata
                    const mainTitle = item.name?.replace(/\n/g, ' ') || "Stream";
                    const subtitle = item.title || item.description || "No description available";

                    const isTorrent = !!item.infoHash;
                    const isYT = !!item.ytId;
                    const isExternal = !!item.externalUrl;

                    return (
                        <ExpressiveSurface
                            variant="filled"
                            rounding="xl"
                            onPress={() => onSelect(item)}
                            style={styles.streamItem}
                        >
                            <View style={[styles.iconBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                                {isTorrent ? (
                                    <Cpu size={20} color={theme.colors.primary} />
                                ) : isYT ? (
                                    <Globe size={20} color={"#FF0000"} />
                                ) : (
                                    <Globe size={20} color={theme.colors.secondary} />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Typography variant="body" weight="black" style={{ color: 'white' }} numberOfLines={1}>
                                    {mainTitle}
                                </Typography>
                                <Typography variant="label" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.6, fontSize: 12 }} numberOfLines={2}>
                                    {subtitle}
                                </Typography>
                            </View>
                            <Play size={20} color={theme.colors.primary} fill={theme.colors.primary} style={{ opacity: 0.7 }} />
                        </ExpressiveSurface>
                    );
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
