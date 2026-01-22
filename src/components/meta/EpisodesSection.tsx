import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { Typography } from '@/src/cdk/components/Typography';
import { Image as ExpoImage } from 'expo-image';
import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

const hexToRgba = (hex: string, opacity: number) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const EpisodeItem = memo(({ episode, palette, onPress }: { episode: any; palette: any; onPress: () => void }) => {
    return (
        <Pressable onPress={onPress}>
            <View style={[styles.episodeCard, { backgroundColor: hexToRgba(palette.vibrant, 0.16) }]}>
                <ExpoImage source={{ uri: episode.thumbnail || episode.poster }} style={styles.episodeThumb} />
                <View style={styles.episodeInfo}>
                    <Typography variant="label" weight="black" numberOfLines={1} style={{ color: 'white' }}>
                        E{episode.episode || episode.number}: {episode.name || episode.title}
                    </Typography>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2 }}>
                        {episode.runtime && (
                            <Typography variant="label" style={{ color: 'white', opacity: 0.6 }}>
                                {episode.runtime}
                            </Typography>
                        )}
                        {episode.released && (
                            <Typography variant="label" style={{ color: 'white', opacity: 0.6 }}>
                                {new Date(episode.released).toLocaleDateString()}
                            </Typography>
                        )}
                    </View>
                    <Typography
                        variant="label"
                        numberOfLines={2}
                        style={{ color: 'white', opacity: 0.7, marginTop: 4, fontSize: 11 }}
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
    colors: any;
    theme: any;
    enrichedSeasons?: any[];
}

export const EpisodesSection = memo(({
    seasons,
    activeSeason,
    setActiveSeason,
    seasonEpisodes,
    onEpisodePress,
    colors,
    theme,
    enrichedSeasons
}: EpisodesSectionProps) => {
    return (
        <View style={styles.section}>
            <Typography variant="label" weight="black" style={styles.label}>SEASON</Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonScroll}>
                {seasons.map((s, idx) => (
                    <ExpressiveSurface
                        key={s}
                        onPress={() => setActiveSeason(s)}
                        selected={activeSeason === s}
                        index={idx}
                        activeIndex={seasons.indexOf(activeSeason)}
                        rounding="3xl"
                        variant="filled"
                        style={[
                            styles.seasonChip,
                            activeSeason === s
                                ? { backgroundColor: colors.lightVibrant }
                                : { backgroundColor: hexToRgba(colors.vibrant, 0.16) }
                        ]}
                    >
                        <Typography
                            variant="label"
                            weight="bold"
                            style={{ color: activeSeason === s ? 'black' : theme.colors.onSurface }}
                        >
                            {enrichedSeasons?.find(fs => fs.seasonNumber === s)?.name || `Season ${s}`}
                        </Typography>
                    </ExpressiveSurface>
                ))}
            </ScrollView>

            <Typography variant="h3" weight="black" style={styles.sectionTitle}>Episodes</Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.episodeScroll}>
                {(seasonEpisodes || []).map((ep, idx) => (
                    <EpisodeItem
                        key={ep.id || idx}
                        episode={ep}
                        palette={colors}
                        onPress={() => onEpisodePress(ep)}
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
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 12,
    },
    seasonScroll: {
        gap: 10,
        paddingBottom: 16,
    },
    seasonChip: {
        paddingHorizontal: 16,
        height: 40,
    },
    sectionTitle: {
        color: 'white',
        marginBottom: 16,
    },
    episodeScroll: {
        gap: 16,
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
    }
});
