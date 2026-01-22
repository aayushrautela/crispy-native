import { Shimmer } from '@/src/cdk/components/Shimmer';
import { Typography } from '@/src/cdk/components/Typography';
import { SectionHeader } from '@/src/components/SectionHeader';
import { OmdbData, OmdbService } from '@/src/core/api/OmdbService';
import { Star } from 'lucide-react-native';
import React, { memo, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { MetacriticIcon, RottenTomatoesIcon } from './RatingIcons';

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

const RatingCard = memo(({ score, label, icon, palette }: { score: string; label: string; icon: React.ReactNode; palette: any }) => (
    <View style={[styles.ratingCard, { backgroundColor: hexToRgba(palette.vibrant, 0.16) }]}>
        <View style={styles.ratingIconContainer}>
            {icon}
        </View>
        <View style={styles.ratingInfo}>
            <Typography variant="label" weight="black" style={{ color: 'white', fontSize: 13 }}>{score}</Typography>
            <Typography variant="label" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{label}</Typography>
        </View>
    </View>
));

interface RatingsSectionProps {
    enriched: any;
    colors: any;
}

export const RatingsSection = memo(({ enriched, colors }: RatingsSectionProps) => {
    const [omdb, setOmdb] = useState<OmdbData | null>(null);
    const [isLoadingOmdb, setIsLoadingOmdb] = useState(false);

    useEffect(() => {
        const fetchOmdb = async () => {
            if (enriched.imdbId) {
                setIsLoadingOmdb(true);
                try {
                    const data = await OmdbService.getData(enriched.imdbId);
                    setOmdb(data);
                } finally {
                    setIsLoadingOmdb(false);
                }
            }
        };
        fetchOmdb();
    }, [enriched.imdbId]);

    // Parse ratings
    const ratings = React.useMemo(() => {
        if (!omdb?.Ratings) return [];
        return omdb.Ratings.map(r => {
            let icon = <Star size={24} color="#FFD700" fill="#FFD700" />;
            let label = r.Source;

            if (r.Source === 'Internet Movie Database') {
                label = 'IMDb';
                icon = (
                    <View style={[styles.sourceIconCircle, { backgroundColor: '#F5C518' }]}>
                        <Typography variant="label" weight="black" style={{ color: 'black', fontSize: 8 }}>IMDb</Typography>
                    </View>
                );
            } else if (r.Source === 'Rotten Tomatoes') {
                icon = <RottenTomatoesIcon size={28} />;
            } else if (r.Source === 'Metacritic') {
                icon = <MetacriticIcon size={28} />;
            }

            return { score: r.Value, label, icon };
        });
    }, [omdb]);

    // Fallback if no OMDB or no ratings
    const fallbackRating = enriched.rating ? {
        score: `${enriched.rating}/10`,
        label: 'TMDB',
        icon: (
            <View style={[styles.sourceIconCircle, { backgroundColor: '#01B4E4' }]}>
                <Typography variant="label" weight="black" style={{ color: 'white', fontSize: 8 }}>TMDB</Typography>
            </View>
        )
    } : null;

    const displayRatings = ratings.length > 0 ? ratings : (fallbackRating ? [fallbackRating] : []);

    if (displayRatings.length === 0 && !isLoadingOmdb) return null;

    return (
        <View style={styles.ratingsSection}>
            <SectionHeader
                title="Ratings"
                hideAction
                textColor="white"
                style={{ paddingHorizontal: 20 }}
            />
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.ratingsScrollContent}
            >
                {displayRatings.map((r, i) => (
                    <RatingCard
                        key={i}
                        score={r.score}
                        label={r.label}
                        palette={colors}
                        icon={r.icon}
                    />
                ))}
                {isLoadingOmdb && ratings.length === 0 && (
                    <>
                        <Shimmer width={160} height={64} borderRadius={32} style={{ marginRight: 16 }} />
                        <Shimmer width={160} height={64} borderRadius={32} />
                    </>
                )}
            </ScrollView>
        </View>
    );
});

const styles = StyleSheet.create({
    ratingsSection: {
        marginTop: 24,
        width: '100%',
    },

    ratingsScrollContent: {
        gap: 16,
        paddingHorizontal: 20,
    },
    ratingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 99,
        minWidth: 160,
    },
    ratingIconContainer: {
        marginRight: 12,
    },
    ratingInfo: {
        flex: 1,
    },

    sourceIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
