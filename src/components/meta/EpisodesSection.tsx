import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { Typography } from '@/src/cdk/components/Typography';
import { SectionHeader } from '@/src/components/SectionHeader';
import { Image as ExpoImage } from 'expo-image';
import { Eye } from 'lucide-react-native';
import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

const isDarkColor = (hex: string) => {
    if (!hex) return true;
    const c = hex.substring(1);      // strip #
    const rgb = parseInt(c, 16);   // convert rrggbb to decimal
    const r = (rgb >> 16) & 0xff;  // extract red
    const g = (rgb >> 8) & 0xff;   // extract green
    const b = (rgb >> 0) & 0xff;   // extract blue

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709

    return luma < 60;
};

const EpisodeItem = memo(({ episode, palette, onPress, watched }: { episode: any; palette: any; onPress: () => void; watched?: boolean }) => {
    const accentColor = useMemo(() => {
        if (isDarkColor(palette.lightVibrant)) {
            return palette.lightMuted;
        }
        return palette.lightVibrant;
    }, [palette]);

    return (
        <Pressable onPress={onPress}>
            <View style={[styles.episodeCard, { backgroundColor: hexToRgba(palette.vibrant, 0.16) }]}>
                <View>
                    <ExpoImage source={{ uri: episode.thumbnail || episode.poster }} style={styles.episodeThumb} />
                    {watched && (
                        <View style={styles.watchedOverlay}>
                            <View style={[styles.watchedBadge, { backgroundColor: accentColor }]}>
                                <Eye size={12} color="black" />
                                <Typography variant="label" weight="bold" style={{ color: 'black', fontSize: 10 }}>Watched</Typography>
                            </View>
                        </View>
                    )}
                </View>
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
    isWatched?: (epNumber: number) => boolean;
}

export const EpisodesSection = memo(({
    seasons,
    activeSeason,
    setActiveSeason,
    seasonEpisodes,
    onEpisodePress,
    colors,
    theme,
    enrichedSeasons,
    isWatched
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

            <SectionHeader
                title="Episodes"
                hideAction
                textColor="white"
                style={{ paddingHorizontal: 20 }}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.episodeScroll}>
                {(seasonEpisodes || []).map((ep, idx) => (
                    <EpisodeItem
                        key={ep.id || idx}
                        episode={ep}
                        palette={colors}
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
        color: 'rgba(255,255,255,0.5)',
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
