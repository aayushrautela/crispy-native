import { Typography } from '@/src/cdk/components/Typography';
import { useTheme } from '@/src/core/ThemeContext';
import { Check } from 'lucide-react-native';
import React from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

interface SubtitleTrack {
    id: string | number;
    title: string; // e.g., "English", "Spanish"
    language?: string;
    isExternal?: boolean;
}

interface SubtitlesTabProps {
    tracks?: SubtitleTrack[];
    selectedTrackId?: string | number | null; // null for Off
    onSelectTrack: (track: SubtitleTrack | null) => void;
}

export function SubtitlesTab({
    tracks = [],
    selectedTrackId,
    onSelectTrack
}: SubtitlesTabProps) {
    const { theme } = useTheme();

    const allOptions = [
        { id: 'off', title: 'Off' },
        ...tracks
    ];

    return (
        <FlatList
            data={allOptions}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
                const isSelected = item.id === (selectedTrackId ?? 'off');
                return (
                    <Pressable
                        onPress={() => onSelectTrack(item.id === 'off' ? null : item as SubtitleTrack)}
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
