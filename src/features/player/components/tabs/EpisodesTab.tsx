import { Typography } from '@/src/core/ui/Typography';
import { useTheme } from '@/src/core/ThemeContext';
import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

interface Episode {
    id: string | number;
    title: string;
    overview?: string;
    stillPath?: string;
}

interface EpisodesTabProps {
    episodes?: Episode[];
    currentEpisodeId?: string | number;
    onSelectEpisode: (episode: Episode) => void;
}

export function EpisodesTab({
    episodes = [],
    currentEpisodeId,
    onSelectEpisode
}: EpisodesTabProps) {
    const { theme } = useTheme();
    const surfaceContainerHigh = (theme.colors as any).surfaceContainerHigh || theme.colors.surfaceVariant;

    if (!episodes || episodes.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                    No episodes available
                </Typography>
            </View>
        );
    }

    return (
        <FlatList
            data={episodes}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
                const isSelected = item.id === currentEpisodeId;
                return (
                    <Pressable
                        onPress={() => onSelectEpisode(item)}
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
                                {item.title}
                            </Typography>
                            {item.overview && (
                                <Typography
                                    variant="body-small"
                                    numberOfLines={2}
                                    style={{
                                        color: isSelected
                                            ? theme.colors.onPrimaryContainer
                                            : theme.colors.onSurfaceVariant,
                                        opacity: 0.8,
                                        marginTop: 4
                                    }}
                                >
                                    {item.overview}
                                </Typography>
                            )}
                        </View>
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
    }
});
