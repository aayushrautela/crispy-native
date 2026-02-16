import { useTheme } from '@/src/core/ThemeContext';
import { Typography } from '@/src/core/ui/Typography';
import { isMagnetUrl } from '@/src/features/player/utils/streamUtils';
import { Check } from 'lucide-react-native';
import React from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';

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
                const isSelected = !!currentStreamUrl && !!item.url && item.url === currentStreamUrl;
                const isTorrent = !!item.infoHash || isMagnetUrl(item.url);
                const isDisabled = Platform.OS === 'ios' && isTorrent;
                return (
                    <Pressable
                        onPress={() => onSelectStream(item)}
                        disabled={isDisabled}
                        style={[
                            styles.item,
                            {
                                backgroundColor: isSelected
                                    ? theme.colors.primaryContainer
                                    : 'transparent',
                                opacity: isDisabled ? 0.45 : 1,
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
                                {isDisabled && (
                                    <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                        Android only
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
});
