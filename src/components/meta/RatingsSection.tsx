import { Typography } from '@/src/cdk/components/Typography';
import { ArrowUpRight, Star } from 'lucide-react-native';
import React, { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

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

const RatingCard = memo(({ source, score, label, icon, palette }: { source: string; score: string; label: string; icon: React.ReactNode; palette: any }) => (
    <View style={[styles.ratingCard, { backgroundColor: hexToRgba(palette.vibrant, 0.16) }]}>
        <View style={styles.ratingIconContainer}>
            {icon}
        </View>
        <View style={styles.ratingInfo}>
            <Typography variant="label" weight="black" style={{ color: 'white', fontSize: 13 }}>{score}</Typography>
            <Typography variant="label" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{label}</Typography>
        </View>
        <View style={styles.ratingArrowContainer}>
            <ArrowUpRight size={14} color="rgba(255,255,255,0.7)" />
        </View>
    </View>
));

interface RatingsSectionProps {
    enriched: any;
    colors: any;
}

export const RatingsSection = memo(({ enriched, colors }: RatingsSectionProps) => {
    return (
        <View style={styles.ratingsSection}>
            <Typography variant="h3" weight="black" style={styles.sectionTitle}>Ratings</Typography>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.ratingsScrollContent}
            >
                <RatingCard
                    source="imdb"
                    score={enriched.rating ? `${enriched.rating}/10` : '5.7/10'}
                    label="IMDb"
                    palette={colors}
                    icon={
                        <View style={[styles.sourceIconCircle, { backgroundColor: '#F5C518' }]}>
                            <Typography variant="label" weight="black" style={{ color: 'black', fontSize: 8 }}>IMDb</Typography>
                        </View>
                    }
                />
                <RatingCard
                    source="rt"
                    score="51%"
                    label="Rotten Tomatoes"
                    palette={colors}
                    icon={<Star size={24} color="#00C853" fill="#00C853" />}
                />
            </ScrollView>
        </View>
    );
});

const styles = StyleSheet.create({
    ratingsSection: {
        marginTop: 24,
        width: '100%',
    },
    sectionTitle: {
        color: 'white',
        marginBottom: 16,
    },
    ratingsScrollContent: {
        gap: 16,
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
    ratingArrowContainer: {
        marginLeft: 8,
    },
    sourceIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
