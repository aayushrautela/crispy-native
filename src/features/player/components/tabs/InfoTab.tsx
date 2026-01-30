import { useTheme } from '@/src/core/ThemeContext';
import { TMDBMeta } from '@/src/core/services/TMDBService';
import { Typography } from '@/src/core/ui/Typography';
import { MetaPalette } from '@/src/features/meta/hooks/useMetaAggregator';
import { Play } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

interface InfoTabProps {
    meta: Partial<TMDBMeta>;
    seasonEpisodes?: any[];
    activeSeason?: number;
    onSeasonChange?: (season: number) => void;
    currentEpisodeId?: string | number;
    onSelectEpisode?: (episode: any) => void;
    colors: MetaPalette;
}

export function InfoTab({
    meta,
    seasonEpisodes = [],
    activeSeason = 1,
    onSeasonChange,
    currentEpisodeId,
    onSelectEpisode,
    colors,
}: InfoTabProps) {
    const { theme } = useTheme();
    const surfaceContainerHigh = (theme.colors as any).surfaceContainerHigh || theme.colors.surfaceVariant;
    const isSeries = meta.type === 'series';

    // Dynamic Accent Colors
    const activeColor = colors.vibrant || theme.colors.primary;

    // Seasons list from meta
    const seasons = useMemo(() => {
        if (!meta.seasons) return [];
        return meta.seasons
            .filter(s => s.seasonNumber > 0)
            .sort((a, b) => a.seasonNumber - b.seasonNumber);
    }, [meta.seasons]);

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header Section - Screenshot Style */}
                <View style={styles.header}>
                    <Typography variant="h3" style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>
                        {meta.title || (meta as any).name}
                    </Typography>
                    
                    <View style={styles.metaRow}>
                        <Typography variant="label" style={{ color: theme.colors.onSurfaceVariant }}>
                            {meta.year}
                        </Typography>
                        <View style={[styles.dot, { backgroundColor: theme.colors.onSurfaceVariant }]} />
                        {meta.runtime && (
                            <>
                                <Typography variant="label" style={{ color: theme.colors.onSurfaceVariant }}>
                                    {meta.runtime}
                                </Typography>
                                <View style={[styles.dot, { backgroundColor: theme.colors.onSurfaceVariant }]} />
                            </>
                        )}
                        {meta.maturityRating && (
                            <>
                                <View style={[styles.ratingBadge, { borderColor: theme.colors.outline }]}>
                                    <Typography variant="label-small" style={{ color: theme.colors.onSurfaceVariant, fontWeight: 'bold' }}>
                                        {meta.maturityRating}
                                    </Typography>
                                </View>
                                <View style={[styles.dot, { backgroundColor: theme.colors.onSurfaceVariant }]} />
                            </>
                        )}
                    </View>

                    {meta.genres && meta.genres.length > 0 && (
                        <Typography variant="label" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
                            {meta.genres.join(' ')}
                        </Typography>
                    )}

                    <Typography variant="label" style={{ color: theme.colors.onSurfaceVariant, fontWeight: 'bold', marginBottom: 8 }}>
                        SYNOPSIS
                    </Typography>
                    
                    <Typography
                        variant="body"
                        style={{ color: theme.colors.onSurface, lineHeight: 22 }}
                    >
                        {meta.description || (meta as any).overview}
                    </Typography>
                </View>

                {/* Cast Section - Screenshot Style */}
                {Array.isArray((meta as any).cast) && (meta as any).cast.length > 0 && (
                    <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
                        <Typography variant="label" style={{ color: theme.colors.onSurfaceVariant, fontWeight: 'bold', marginBottom: 16 }}>
                            CAST
                        </Typography>
                        <View style={{ gap: 16 }}>
                            {(meta as any).cast.slice(0, 10).map((c: any) => (
                                <View key={`${c.id || c.name}`} style={styles.castRow}>
                                    {c.profile ? (
                                        <Image source={{ uri: c.profile }} style={styles.castAvatar} />
                                    ) : (
                                        <View style={[styles.castAvatar, { backgroundColor: theme.colors.surfaceVariant }]} />
                                    )}
                                    <View style={styles.castInfo}>
                                        <Typography variant="title-medium" style={{ color: theme.colors.onSurface, fontWeight: '500' }}>
                                            {c.name}
                                        </Typography>
                                        {c.character && (
                                            <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                                {c.character}
                                            </Typography>
                                        )}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Series Content */}
                {isSeries && seasons.length > 0 && (
                    <View style={styles.seriesSection}>
                        <View style={styles.divider} />

                        {/* Season Selector */}
                        <View style={styles.seasonSelector}>
                            <Typography variant="label" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8, paddingHorizontal: 16 }}>
                                SEASONS
                            </Typography>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.seasonList}
                            >
                                {seasons.map(s => (
                                    <Pressable
                                        key={s.id}
                                        onPress={() => onSeasonChange?.(s.seasonNumber)}
                                        style={[
                                            styles.seasonChip,
                                            {
                                                backgroundColor: activeSeason === s.seasonNumber
                                                    ? activeColor
                                                    : theme.colors.surfaceVariant
                                            }
                                        ]}
                                    >
                                        <Typography
                                            variant="label"
                                            style={{
                                                color: activeSeason === s.seasonNumber
                                                    ? (colors.vibrant ? '#000000' : theme.colors.onPrimary)
                                                    : theme.colors.onSurfaceVariant
                                            }}
                                        >
                                            S{s.seasonNumber}
                                        </Typography>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Episodes List */}
                        <View style={styles.episodesList}>
                            <Typography variant="label" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8, paddingHorizontal: 16, marginTop: 16 }}>
                                EPISODES
                            </Typography>
                            {seasonEpisodes.map((ep, index) => {
                                const isSelected = ep.episode.toString() === currentEpisodeId?.toString();
                                return (
                                    <Pressable
                                        key={ep.episode || index}
                                        onPress={() => onSelectEpisode?.(ep)}
                                        style={[
                                            styles.episodeItem,
                                            {
                                                backgroundColor: isSelected
                                                    ? surfaceContainerHigh
                                                    : 'transparent'
                                            }
                                        ]}
                                    >
                                        <View style={styles.episodeThumbnail}>
                                            {ep.thumbnail ? (
                                                <Image source={{ uri: ep.thumbnail }} style={StyleSheet.absoluteFillObject} />
                                            ) : (
                                                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.surfaceVariant }]} />
                                            )}
                                            {isSelected && (
                                                <View style={styles.playingOverlay}>
                                                    <Play size={16} color="white" fill="white" />
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.episodeInfo}>
                                            <Typography
                                                variant="title-medium"
                                                style={{
                                                    color: isSelected ? activeColor : theme.colors.onSurface
                                                }}
                                                numberOfLines={1}
                                            >
                                                {ep.episode}. {ep.name}
                                            </Typography>
                                            <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={2}>
                                                {ep.overview}
                                            </Typography>
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 24,
    },
    header: {
        padding: 16,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 8,
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        marginHorizontal: 8,
    },
    ratingBadge: {
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
    },
    castRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    castAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    castInfo: {
        flex: 1,
    },
    seriesSection: {
        marginTop: 8,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginBottom: 16,
    },
    seasonSelector: {
        marginBottom: 8,
    },
    seasonList: {
        paddingHorizontal: 16,
        gap: 8,
    },
    seasonChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    episodesList: {
        gap: 4,
    },
    episodeItem: {
        flexDirection: 'row',
        padding: 12,
        marginHorizontal: 8,
        borderRadius: 8,
        gap: 12,
        alignItems: 'center',
    },
    episodeThumbnail: {
        width: 120,
        height: 68,
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    episodeInfo: {
        flex: 1,
        justifyContent: 'center',
    },
});
