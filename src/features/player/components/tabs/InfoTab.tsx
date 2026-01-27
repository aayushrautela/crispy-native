import { useTheme } from '@/src/core/ThemeContext';
import { TMDBMeta } from '@/src/core/services/TMDBService';
import { Typography } from '@/src/core/ui/Typography';
import { MetaPalette } from '@/src/features/meta/hooks/useMetaAggregator';
import { Play } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

const { width } = Dimensions.get('window');

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
    const isSeries = meta.type === 'series' || meta.type === 'tv';

    // Dynamic Accent Colors
    const activeColor = colors.vibrant || theme.colors.primary;
    const activeOnColor = colors.vibrant ? '#000000' : theme.colors.onPrimary;

    // Seasons list from meta
    const seasons = useMemo(() => {
        if (!meta.seasons) return [];
        return meta.seasons
            .filter(s => s.seasonNumber > 0)
            .sort((a, b) => a.seasonNumber - b.seasonNumber);
    }, [meta.seasons]);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header Section */}
                <View style={styles.header}>
                    <Image
                        source={{ uri: meta.poster }}
                        style={styles.poster}
                        resizeMode="cover"
                    />
                    <View style={styles.headerInfo}>
                        <Typography variant="h3" numberOfLines={2} style={{ color: theme.colors.onSurface }}>
                            {meta.title}
                        </Typography>
                        <View style={styles.metaRow}>
                            <Typography variant="label" style={{ color: activeColor }}>
                                {meta.year}
                            </Typography>
                            {meta.runtime && (
                                <>
                                    <View style={[styles.dot, { backgroundColor: theme.colors.onSurfaceVariant }]} />
                                    <Typography variant="label" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {meta.runtime}
                                    </Typography>
                                </>
                            )}
                            {meta.rating && (
                                <>
                                    <View style={[styles.dot, { backgroundColor: theme.colors.onSurfaceVariant }]} />
                                    <Typography variant="label" style={{ color: theme.colors.onSurfaceVariant }}>
                                        ★ {meta.rating}
                                    </Typography>
                                </>
                            )}
                        </View>
                        {meta.genres && meta.genres.length > 0 && (
                            <View style={styles.genres}>
                                {meta.genres.slice(0, 3).map(g => (
                                    <View key={g} style={[styles.genreChip, { borderColor: theme.colors.outline }]}>
                                        <Typography variant="label-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {g}
                                        </Typography>
                                    </View>
                                ))}
                            </View>
                        )}
                        <Typography
                            variant="body-small"
                            style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
                            numberOfLines={4}
                        >
                            {meta.description}
                        </Typography>
                    </View>
                </View>

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
                                                    ? activeOnColor
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
                                        onSelectEpisode={() => onSelectEpisode?.(ep)}
                                        onPress={() => onSelectEpisode?.(ep)}
                                        style={[
                                            styles.episodeItem,
                                            {
                                                backgroundColor: isSelected
                                                    ? theme.colors.surfaceContainerHigh
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
        flexDirection: 'row',
        padding: 16,
        gap: 16,
    },
    poster: {
        width: 100,
        height: 150,
        borderRadius: 8,
        backgroundColor: '#2a2a2a',
    },
    headerInfo: {
        flex: 1,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 8,
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        marginHorizontal: 6,
    },
    genres: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    genreChip: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
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
