import { Typography } from '@/src/cdk/components/Typography';
import { useTheme } from '@/src/core/ThemeContext';
import { Check } from 'lucide-react-native';
import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

interface Stream {
    url: string;
    title: string;
    quality?: string;
    size?: string;
    seeders?: number;
}

interface StreamsTabProps {
    streams?: Stream[];
    currentStreamUrl?: string;
    onSelectStream: (stream: Stream) => void;
}

export function StreamsTab({
    streams = [],
    currentStreamUrl,
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
            keyExtractor={(item, index) => item.url + index}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
                const isSelected = item.url === currentStreamUrl;
                return (
                    <Pressable
                        onPress={() => onSelectStream(item)}
                        style={[
                            styles.item,
                            {
                                backgroundColor: isSelected
                                    ? theme.colors.primaryContainer
                                    : 'transparent',
                                borderColor: theme.colors.outlineVariant
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
                                {item.title}
                            </Typography>
                            <View style={styles.metaRow}>
                                {item.quality && (
                                    <View style={[styles.badge, { backgroundColor: theme.colors.secondaryContainer }]}>
                                        <Typography variant="label-small" style={{ color: theme.colors.onSecondaryContainer }}>
                                            {item.quality}
                                        </Typography>
                                    </View>
                                )}
                                {item.size && (
                                    <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {item.size}
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
        borderWidth: 1,
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
