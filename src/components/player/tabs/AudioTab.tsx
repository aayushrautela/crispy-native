import { Typography } from '@/src/cdk/components/Typography';
import { useTheme } from '@/src/core/ThemeContext';
import { Check } from 'lucide-react-native';
import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

interface AudioTrack {
    id: string | number;
    title: string;
    language?: string;
}

interface AudioTabProps {
    tracks?: AudioTrack[];
    selectedTrackId?: string | number;
    onSelectTrack: (track: AudioTrack) => void;
}

export function AudioTab({
    tracks = [],
    selectedTrackId,
    onSelectTrack
}: AudioTabProps) {
    const { theme } = useTheme();

    if (!tracks || tracks.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                    No audio tracks available
                </Typography>
            </View>
        );
    }

    return (
        <FlatList
            data={tracks}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
                const isSelected = item.id === selectedTrackId;
                return (
                    <Pressable
                        onPress={() => onSelectTrack(item)}
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
                        <Typography
                            variant="label-large"
                            style={{
                                flex: 1,
                                color: isSelected
                                    ? theme.colors.onPrimaryContainer
                                    : theme.colors.onSurface
                            }}
                        >
                            {item.title}
                        </Typography>
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
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    }
});
