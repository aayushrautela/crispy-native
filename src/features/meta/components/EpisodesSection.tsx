import { ExpressiveSurface } from '@/src/core/ui/ExpressiveSurface';
import { SectionHeader } from '@/src/core/ui/SectionHeader';
import { useTheme } from '@/src/core/ThemeContext';
import { Typography } from '@/src/core/ui/Typography';
import { Image as ExpoImage } from 'expo-image';
import { Eye } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

const EpisodeItem = memo(function EpisodeItem({ episode, onPress, watched }: { episode: any; onPress: () => void; watched?: boolean }) {
    const { theme } = useTheme();
    const cardBg = (theme.colors as any).surfaceContainerHigh
        || (theme.colors as any).surfaceContainer
        || (theme.colors as any).surfaceContainerHighest
        || theme.colors.surfaceVariant;

    const badgeBg = theme.colors.secondaryContainer;
    const badgeFg = theme.colors.onSecondaryContainer;

    return (
        <Pressable onPress={onPress}>
            <View style={[styles.episodeCard, { backgroundColor: cardBg }]}>
                <View>
                    <ExpoImage source={{ uri: episode.thumbnail || episode.poster }} style={styles.episodeThumb} />
                    {watched && (
                        <View style={styles.watchedOverlay}>
                            <View style={[styles.watchedBadge, { backgroundColor: badgeBg }]}>
                                <Eye size={12} color={badgeFg} />
                                <Typography variant="label" weight="bold" style={{ color: badgeFg, fontSize: 10 }}>Watched</Typography>
                            </View>
                        </View>
                    )}
                </View>
                <View style={styles.episodeInfo}>
                    <Typography variant="label" weight="black" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
                        E{episode.episode || episode.number}: {episode.name || episode.title}
                    </Typography>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2 }}>
                        {episode.runtime && (
                            <Typography variant="label" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.85 }}>
                                {episode.runtime}
                            </Typography>
                        )}
                        {episode.released && (
                            <Typography variant="label" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.85 }}>
                                {new Date(episode.released).toLocaleDateString()}
                            </Typography>
                        )}
                    </View>
                    <Typography
                        variant="label"
                        numberOfLines={2}
                        style={{ color: theme.colors.onSurfaceVariant, opacity: 0.9, marginTop: 4, fontSize: 11 }}
                    >
                        {episode.overview || episode.description || 'No description available.'}
                    </Typography>
                </View>
            </View>
        </Pressable>
    );
});

interface EpisodesSectionProps {
    seasons: number[];
    activeSeason: number;
    setActiveSeason: (s: number) => void;
    seasonEpisodes: any[];
    onEpisodePress: (ep: any) => void;
    enrichedSeasons?: any[];
    isWatched?: (epNumber: number) => boolean;
}

const SeasonChip = memo(function SeasonChip({
    seasonNumber,
    seasonName,
    isActive,
    onPress,
    index,
    totalSeasons,
    activeSeasonIndex,
}: {
    seasonNumber: number;
    seasonName: string;
    isActive: boolean;
    onPress: (s: number) => void;
    index: number;
    totalSeasons: number;
    activeSeasonIndex: number;
}) {
    const { theme } = useTheme();

    return (
        <ExpressiveSurface
            onPress={() => onPress(seasonNumber)}
            selected={isActive}
            index={index}
            activeIndex={activeSeasonIndex}
            rounding="3xl"
            style={styles.seasonChip}
        >
            <Typography
                variant="label"
                weight="bold"
                style={{ color: isActive ? theme.colors.onPrimary : theme.colors.onSurface }}
            >
                {seasonName}
            </Typography>
        </ExpressiveSurface>
    );
});

export const EpisodesSection = memo(function EpisodesSection({
    seasons,
    activeSeason,
    setActiveSeason,
    seasonEpisodes,
    onEpisodePress,
    enrichedSeasons,
    isWatched
}: EpisodesSectionProps) {
    const { theme } = useTheme();
    const activeSeasonIndex = useMemo(() => seasons.indexOf(activeSeason), [seasons, activeSeason]);

    return (
        <View style={styles.section}>
            <Typography variant="label" weight="black" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>SEASON</Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonScroll}>
                {seasons.map((s, idx) => (
                    <SeasonChip
                        key={s}
                        seasonNumber={s}
                        seasonName={enrichedSeasons?.find(fs => fs.seasonNumber === s)?.name || `Season ${s}`}
                        isActive={activeSeason === s}
                        onPress={setActiveSeason}
                        index={idx}
                        totalSeasons={seasons.length}
                        activeSeasonIndex={activeSeasonIndex}
                    />
                ))}
            </ScrollView>

            <SectionHeader
                title="Episodes"
                hideAction
                style={{ paddingHorizontal: 20 }}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.episodeScroll}>
                {(seasonEpisodes || []).map((ep, idx) => (
                    <EpisodeItem
                        key={ep.id || idx}
                        episode={ep}
                        onPress={() => onEpisodePress(ep)}
                        watched={isWatched ? isWatched(ep.episode || ep.number) : false}
                    />
                ))}
            </ScrollView>
        </View>
    );
});

const styles = StyleSheet.create({
    section: {
        marginTop: 24,
    },
    label: {
        marginBottom: 12,
        paddingHorizontal: 20,
    },
    seasonScroll: {
        gap: 10,
        paddingBottom: 16,
        paddingHorizontal: 20,
    },
    seasonChip: {
        paddingHorizontal: 16,
        height: 40,
    },
    episodeScroll: {
        gap: 16,
        paddingHorizontal: 20,
    },
    episodeCard: {
        width: 280,
        borderRadius: 16,
        overflow: 'hidden',
    },
    episodeThumb: {
        width: '100%',
        height: 157,
    },
    episodeInfo: {
        padding: 12,
    },
    watchedOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
    },
    watchedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    }
});
