import { useTheme } from '@/src/core/ThemeContext';
import { Typography } from '@/src/core/ui/Typography';
import { Check, Clock, Minus, Plus } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

interface EmbeddedSubtitleTrack {
    id: string | number;
    title?: string;
    name?: string;
    language?: string;
}

interface ExternalSubtitleOption {
    key: string;
    kind: 'external';
    url: string;
    title: string;
    lang?: string;
    addonName?: string;
}

interface SubtitlesTabProps {
    // Track selection
    embeddedTracks?: EmbeddedSubtitleTrack[];
    selectedEmbeddedId?: number;
    externalOptions?: ExternalSubtitleOption[];
    selectedExternalUrl?: string | null;
    loading?: boolean;

    onSelectEmbedded?: (id: number) => void;
    onSelectExternal?: (url: string) => void;
    onSelectOff?: () => void;

    // Overlay controls
    delay?: number;
    onUpdateDelay?: (delay: number) => void;
    fontSize?: number;
    onUpdateFontSize?: (size: number) => void;
    offset?: number;
    onUpdateOffset?: (offset: number) => void;
}

export function SubtitlesTab({
    embeddedTracks = [],
    selectedEmbeddedId = -1,
    externalOptions = [],
    selectedExternalUrl = null,
    loading = false,
    onSelectEmbedded,
    onSelectExternal,
    onSelectOff,
    delay = 0,
    onUpdateDelay,
    fontSize = 24,
    onUpdateFontSize,
    offset = 0,
    onUpdateOffset,
}: SubtitlesTabProps) {
    const { theme } = useTheme();
    const surfaceContainerHigh = (theme.colors as any).surfaceContainerHigh || theme.colors.surfaceVariant;

    const showSelection = !!onSelectOff || !!onSelectEmbedded || !!onSelectExternal;
    const offSelected = !selectedExternalUrl && (selectedEmbeddedId === -1 || selectedEmbeddedId === undefined);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {showSelection && (
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Typography variant="title-medium" style={{ color: theme.colors.onSurface }}>
                            Subtitles
                        </Typography>
                        {loading && <ActivityIndicator size="small" color={theme.colors.primary} />}
                    </View>

                    <Pressable
                        onPress={() => onSelectOff?.()}
                        style={[
                            styles.item,
                            {
                                backgroundColor: offSelected ? theme.colors.primaryContainer : 'transparent',
                            }
                        ]}
                    >
                        <Typography
                            variant="label-large"
                            style={{
                                flex: 1,
                                color: offSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurface,
                            }}
                        >
                            Off
                        </Typography>
                        {offSelected && <Check size={20} color={theme.colors.onPrimaryContainer} />}
                    </Pressable>
                </View>
            )}

            {showSelection && (
                <View style={styles.section}>
                    <Typography variant="title-medium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
                        Embedded
                    </Typography>
                    {embeddedTracks.length === 0 ? (
                        <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                            No embedded subtitles
                        </Typography>
                    ) : (
                        embeddedTracks.map((t) => {
                            const id = Number(t.id);
                            const isSelected = !selectedExternalUrl && Number.isFinite(id) && id === selectedEmbeddedId;
                            return (
                                <Pressable
                                    key={String(t.id)}
                                    onPress={() => {
                                        if (!Number.isFinite(id)) return;
                                        onSelectEmbedded?.(id);
                                    }}
                                    style={[
                                        styles.item,
                                        {
                                            backgroundColor: isSelected ? theme.colors.primaryContainer : 'transparent',
                                        }
                                    ]}
                                >
                                    <Typography
                                        variant="label-large"
                                        style={{
                                            flex: 1,
                                            color: isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurface,
                                        }}
                                    >
                                        {t.name || t.title || t.language || `Track ${t.id}`}
                                    </Typography>
                                    {isSelected && <Check size={20} color={theme.colors.onPrimaryContainer} />}
                                </Pressable>
                            );
                        })
                    )}
                </View>
            )}

            {showSelection && (
                <View style={styles.section}>
                    <Typography variant="title-medium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
                        From Addons
                    </Typography>
                    {externalOptions.length === 0 ? (
                        <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                            No external subtitles found
                        </Typography>
                    ) : (
                        externalOptions.map((opt) => {
                            const isSelected = !!selectedExternalUrl && opt.url === selectedExternalUrl;
                            return (
                                <Pressable
                                    key={opt.key}
                                    onPress={() => onSelectExternal?.(opt.url)}
                                    style={[
                                        styles.item,
                                        {
                                            backgroundColor: isSelected ? theme.colors.primaryContainer : 'transparent',
                                        }
                                    ]}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Typography
                                            variant="label-large"
                                            style={{
                                                color: isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurface,
                                            }}
                                        >
                                            {opt.title || 'Subtitle'}
                                        </Typography>
                                        {(opt.addonName || opt.lang) && (
                                            <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                                                {[opt.lang, opt.addonName].filter(Boolean).join(' • ')}
                                            </Typography>
                                        )}
                                    </View>
                                    {isSelected && <Check size={20} color={theme.colors.onPrimaryContainer} />}
                                </Pressable>
                            );
                        })
                    )}
                </View>
            )}

            {onUpdateDelay && (
                <View style={styles.section}>
                    <View style={styles.row}>
                        <View style={[styles.row, { flex: 1 }]}>
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
                    <View style={[styles.row, { marginTop: 12 }]}>
                        <Pressable
                            onPress={() => onUpdateDelay((delay || 0) - 0.25)}
                            style={[styles.controlBtn, { backgroundColor: surfaceContainerHigh }]}
                        >
                            <Minus size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                        <View style={styles.valueBox}>
                            <Typography variant="title-medium" style={{ color: theme.colors.onSurface }}>
                                {(delay || 0).toFixed(2)}s
                            </Typography>
                        </View>
                        <Pressable
                            onPress={() => onUpdateDelay((delay || 0) + 0.25)}
                            style={[styles.controlBtn, { backgroundColor: surfaceContainerHigh }]}
                        >
                            <Plus size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                    </View>
                </View>
            )}

            {onUpdateFontSize && (
                <View style={styles.section}>
                    <View style={styles.row}>
                        <View style={[styles.row, { flex: 1 }]}>
                            <Typography variant="label-medium" style={{ color: theme.colors.onSurfaceVariant }}>
                                SIZE
                            </Typography>
                        </View>
                        <Pressable onPress={() => onUpdateFontSize(24)}>
                            <Typography variant="label-medium" style={{ color: theme.colors.primary }}>
                                RESET
                            </Typography>
                        </Pressable>
                    </View>
                    <View style={[styles.row, { marginTop: 12 }]}>
                        <Pressable
                            onPress={() => onUpdateFontSize(Math.max(10, (fontSize || 24) - 2))}
                            style={[styles.controlBtn, { backgroundColor: surfaceContainerHigh }]}
                        >
                            <Minus size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                        <View style={styles.valueBox}>
                            <Typography variant="title-medium" style={{ color: theme.colors.onSurface }}>
                                {Math.round(fontSize || 24)}
                            </Typography>
                        </View>
                        <Pressable
                            onPress={() => onUpdateFontSize(Math.min(72, (fontSize || 24) + 2))}
                            style={[styles.controlBtn, { backgroundColor: surfaceContainerHigh }]}
                        >
                            <Plus size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                    </View>
                </View>
            )}

            {onUpdateOffset && (
                <View style={styles.section}>
                    <View style={styles.row}>
                        <View style={[styles.row, { flex: 1 }]}>
                            <Typography variant="label-medium" style={{ color: theme.colors.onSurfaceVariant }}>
                                POSITION
                            </Typography>
                        </View>
                        <Pressable onPress={() => onUpdateOffset(0)}>
                            <Typography variant="label-medium" style={{ color: theme.colors.primary }}>
                                RESET
                            </Typography>
                        </Pressable>
                    </View>
                    <View style={[styles.row, { marginTop: 12 }]}>
                        <Pressable
                            onPress={() => onUpdateOffset((offset || 0) - 6)}
                            style={[styles.controlBtn, { backgroundColor: surfaceContainerHigh }]}
                        >
                            <Minus size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                        <View style={styles.valueBox}>
                            <Typography variant="title-medium" style={{ color: theme.colors.onSurface }}>
                                {Math.round(offset || 0)}
                            </Typography>
                        </View>
                        <Pressable
                            onPress={() => onUpdateOffset((offset || 0) + 6)}
                            style={[styles.controlBtn, { backgroundColor: surfaceContainerHigh }]}
                        >
                            <Plus size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                    </View>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 18,
    },
    section: {
        gap: 8,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    item: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    controlBtn: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    valueBox: {
        flex: 1,
        alignItems: 'center',
    },
});
