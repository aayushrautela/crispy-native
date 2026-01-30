import { useTheme } from '@/src/core/ThemeContext';
import { Typography } from '@/src/core/ui/Typography';
import { Check } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

export interface Stream {
    url?: string;
    title?: string;
    name?: string;
    quality?: string;
    size?: string;
    seeders?: number;
    infoHash?: string;
    fileIdx?: number;
    addonName?: string;
    behaviorHints?: { headers?: Record<string, string> };
}

interface StreamsTabProps {
    streams?: Stream[];
    currentStreamUrl?: string;
    isLoading?: boolean;
    onSelectStream: (stream: Stream) => void;
}

export function StreamsTab({
    streams = [],
    currentStreamUrl,
    isLoading = false,
    onSelectStream
}: StreamsTabProps) {
    const { theme } = useTheme();
    const surfaceContainerHigh = (theme.colors as any).surfaceContainerHigh || theme.colors.surfaceVariant;

    const guessQuality = (text: string) => {
        const t = text.toLowerCase();
        if (t.includes('2160') || t.includes('4k')) return '4K';
        if (t.includes('1080')) return '1080p';
        if (t.includes('720')) return '720p';
        if (t.includes('480')) return '480p';
        return undefined;
    };

    if (isLoading && (!streams || streams.length === 0)) {
        return (
            <View style={styles.emptyContainer}>
                <ActivityIndicator color={theme.colors.primary} />
                <View style={{ height: 12 }} />
                <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                    Fetching streams...
                </Typography>
            </View>
        );
    }

    if (!streams || streams.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                    No other streams available
                </Typography>
            </View>
        );
    }

    return (
        <FlatList
            data={streams}
            keyExtractor={(item, index) => `${item.url || 'stream'}-${index}`}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
                const primaryText = item.name || item.title || item.quality || (item.url ? 'Stream URL' : 'Stream');
                const quality = item.quality || guessQuality(primaryText);
                const isSelected = !!currentStreamUrl && !!item.url && item.url === currentStreamUrl;
                return (
                    <Pressable
                        onPress={() => onSelectStream(item)}
                        style={[
                            styles.item,
                            {
                                backgroundColor: isSelected
                                    ? theme.colors.primaryContainer
                                    : 'transparent',
                            }
                        ]}
                    >
                        <View style={{ flex: 1 }}>
                            <Typography
                                variant="title-medium"
                                style={{
                                    color: isSelected
                                        ? theme.colors.onPrimaryContainer
                                        : theme.colors.onSurface
                                }}
                            >
                                {primaryText}
                            </Typography>
                            <View style={styles.metaRow}>
                                {quality && (
                                    <View style={[styles.badge, { backgroundColor: theme.colors.secondaryContainer }]}>
                                        <Typography variant="label-small" style={{ color: theme.colors.onSecondaryContainer }}>
                                            {quality}
                                        </Typography>
                                    </View>
                                )}
                                {item.size && (
                                    <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {item.size}
                                    </Typography>
                                )}
                                {typeof item.seeders === 'number' && (
                                    <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {item.seeders} seeders
                                    </Typography>
                                )}
                                {item.addonName && (
                                    <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {item.addonName}
                                    </Typography>
                                )}
                            </View>
                        </View>
                        {isSelected && (
                            <Check
                                size={20}
                                color={theme.colors.onPrimaryContainer}
                            />
                        )}
                    </Pressable>
                );
            }}
        />
    );
}

const styles = StyleSheet.create({
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    listContent: {
        gap: 8,
    },
    item: {
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    }
});
