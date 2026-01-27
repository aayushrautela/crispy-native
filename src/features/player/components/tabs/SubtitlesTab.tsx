import { useTheme } from '@/src/core/ThemeContext';
import { Typography } from '@/src/core/ui/Typography';
import { Check, Clock, Minus, Plus } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

interface SubtitleTrack {
    id: string | number;
    title: string;
    language?: string;
    isExternal?: boolean;
    addonName?: string;
}

interface SubtitlesTabProps {
    tracks?: SubtitleTrack[];
    selectedTrackId?: string | number | null;
    onSelectTrack: (track: SubtitleTrack | null) => void;
    delay?: number;
    onUpdateDelay?: (delay: number) => void;
    size?: number;
    onUpdateSize?: (size: number) => void;
    offset?: number;
    onUpdateOffset?: (offset: number) => void;
}

export function SubtitlesTab({
    tracks = [],
    selectedTrackId,
    onSelectTrack,
    delay = 0,
    onUpdateDelay,
    size = 24,
    onUpdateSize,
    offset = 0,
    onUpdateOffset
}: SubtitlesTabProps) {
    const { theme } = useTheme();
    const [selectedLang, setSelectedLang] = useState<string | null>(null);

    // Extract unique languages
    const languages = useMemo(() => {
        const langs = new Set<string>();
        tracks.forEach(t => {
            if (t.language) langs.add(t.language.toLowerCase());
        });
        return Array.from(langs).sort();
    }, [tracks]);

    // Filter tracks by language
    const filteredTracks = useMemo(() => {
        if (!selectedLang) return tracks;
        return tracks.filter(t => t.language?.toLowerCase() === selectedLang);
    }, [tracks, selectedLang]);

    const renderHeader = () => (
        <View style={styles.header}>
            {/* Language Chips */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipContainer}
            >
                <Pressable
                    onPress={() => setSelectedLang(null)}
                    style={[
                        styles.chip,
                        {
                            backgroundColor: selectedLang === null
                                ? theme.colors.primary
                                : theme.colors.surfaceVariant
                        }
                    ]}
                >
                    <Typography
                        variant="label-large"
                        style={{ color: selectedLang === null ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}
                    >
                        All
                    </Typography>
                </Pressable>
                {languages.map(lang => (
                    <Pressable
                        key={lang}
                        onPress={() => setSelectedLang(lang)}
                        style={[
                            styles.chip,
                            {
                                backgroundColor: selectedLang === lang
                                    ? theme.colors.primary
                                    : theme.colors.surfaceVariant
                            }
                        ]}
                    >
                        <Typography
                            variant="label-large"
                            style={{
                                color: selectedLang === lang ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
                                textTransform: 'uppercase'
                            }}
                        >
                            {lang}
                        </Typography>
                    </Pressable>
                ))}
            </ScrollView>

            {/* Delay Controls */}
            {onUpdateDelay && (
                <View style={[styles.controlCard, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                    <View style={styles.controlHeader}>
                        <View style={styles.controlTitle}>
                            <Clock size={16} color={theme.colors.onSurfaceVariant} />
                            <Typography variant="label-medium" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
                                DELAY
                            </Typography>
                        </View>
                        <Pressable onPress={() => onUpdateDelay(0)}>
                            <Typography variant="label-medium" style={{ color: theme.colors.primary }}>
                                RESET
                            </Typography>
                        </Pressable>
                    </View>
                    <View style={styles.controlRow}>
                        <Pressable
                            onPress={() => onUpdateDelay((delay || 0) - 0.25)}
                            style={[styles.controlBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                        >
                            <Minus size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                        <View style={styles.controlValue}>
                            <Typography variant="title-medium" style={{ color: theme.colors.onSurface }}>
                                {(delay || 0).toFixed(2)}s
                            </Typography>
                        </View>
                        <Pressable
                            onPress={() => onUpdateDelay((delay || 0) + 0.25)}
                            style={[styles.controlBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                        >
                            <Plus size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                    </View>
                </View>
            )}

            {/* Size Controls */}
            {onUpdateSize && (
                <View style={[styles.controlCard, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                    <View style={styles.controlHeader}>
                        <View style={styles.controlTitle}>
                            <Typography variant="label-medium" style={{ color: theme.colors.onSurfaceVariant }}>
                                SIZE
                            </Typography>
                        </View>
                    </View>
                    <View style={styles.controlRow}>
                        <Pressable
                            onPress={() => onUpdateSize(Math.max(12, (size || 24) - 2))}
                            style={[styles.controlBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                        >
                            <Minus size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                        <View style={styles.controlValue}>
                            <Typography variant="title-medium" style={{ color: theme.colors.onSurface }}>
                                {size || 24}px
                            </Typography>
                        </View>
                        <Pressable
                            onPress={() => onUpdateSize(Math.min(64, (size || 24) + 2))}
                            style={[styles.controlBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                        >
                            <Plus size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                    </View>
                </View>
            )}

            {/* Offset Controls */}
            {onUpdateOffset && (
                <View style={[styles.controlCard, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                    <View style={styles.controlHeader}>
                        <View style={styles.controlTitle}>
                            <Typography variant="label-medium" style={{ color: theme.colors.onSurfaceVariant }}>
                                VERTICAL OFFSET
                            </Typography>
                        </View>
                        <Pressable onPress={() => onUpdateOffset(0)}>
                            <Typography variant="label-medium" style={{ color: theme.colors.primary }}>
                                RESET
                            </Typography>
                        </Pressable>
                    </View>
                    <View style={styles.controlRow}>
                        <Pressable
                            onPress={() => onUpdateOffset((offset || 0) - 10)}
                            style={[styles.controlBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                        >
                            <Minus size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                        <View style={styles.controlValue}>
                            <Typography variant="title-medium" style={{ color: theme.colors.onSurface }}>
                                {offset || 0}px
                            </Typography>
                        </View>
                        <Pressable
                            onPress={() => onUpdateOffset((offset || 0) + 10)}
                            style={[styles.controlBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                        >
                            <Plus size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                    </View>
                </View>
            )}

            <View style={styles.divider}>
                <Typography variant="label-medium" style={{ color: theme.colors.onSurfaceVariant }}>
                    TRACKS ({filteredTracks.length})
                </Typography>
            </View>
        </View>
    );

    return (
        <FlatList
            data={[{ id: 'off', title: 'Off' }, ...filteredTracks]}
            keyExtractor={(item) => item.id.toString()}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
                const isSelected = item.id === (selectedTrackId ?? 'off');
                const track = item as SubtitleTrack;
                return (
                    <Pressable
                        onPress={() => onSelectTrack(item.id === 'off' ? null : track)}
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
                                variant="label-large"
                                style={{
                                    color: isSelected
                                        ? theme.colors.onPrimaryContainer
                                        : theme.colors.onSurface
                                }}
                            >
                                {item.title}
                            </Typography>
                            {track.isExternal && (
                                <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                    External • {track.addonName || 'Addon'}
                                </Typography>
                            )}
                            {!track.isExternal && item.id !== 'off' && (
                                <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Embedded
                                </Typography>
                            )}
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
    listContent: {
        paddingBottom: 24,
    },
    header: {
        marginBottom: 16,
    },
    chipContainer: {
        gap: 8,
        paddingHorizontal: 4,
        paddingBottom: 16,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    controlCard: {
        padding: 16,
        borderRadius: 16,
        marginHorizontal: 4,
        marginBottom: 16,
    },
    controlHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    controlTitle: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    controlRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    controlBtn: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    controlValue: {
        flex: 1,
        alignItems: 'center',
    },
    divider: {
        paddingHorizontal: 4,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        marginBottom: 8,
    },
    item: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    }
});
