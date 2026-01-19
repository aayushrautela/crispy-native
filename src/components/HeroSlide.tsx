import { ExpressiveButton } from '@/src/cdk/components/ExpressiveButton';
import { Typography } from '@/src/cdk/components/Typography';
import { useTheme } from '@/src/core/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Info, Play, Star } from 'lucide-react-native';
import React from 'react';
import { Dimensions, Image, ImageBackground, StyleSheet, View } from 'react-native';
import Animated, { interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Meta } from '../core/hooks/useHeroItems';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_WIDTH = SCREEN_WIDTH - 32;
const ASPECT_RATIO = 1; // Shorter (Square)
const HERO_HEIGHT = HERO_WIDTH / ASPECT_RATIO;

interface HeroSlideProps {
    item: Meta;
    index: number;
    scrollX: SharedValue<number>;
    onWatch: (item: Meta) => void;
    onInfo: (item: Meta) => void;
}

export const HeroSlide = ({ item, index, scrollX, onWatch, onInfo }: HeroSlideProps) => {
    const { theme } = useTheme();

    // Animated Parallax Style
    const animatedStyle = useAnimatedStyle(() => {
        const input = [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH];
        const scale = interpolate(scrollX.value, input, [0.96, 1, 0.96]);
        const opacity = interpolate(scrollX.value, input, [0.8, 1, 0.8]);
        return {
            transform: [{ scale }],
            opacity,
        };
    });

    const isUpcoming = React.useMemo(() => {
        if (!item.released) return false;
        const releaseDate = new Date(item.released);
        const now = new Date();
        return releaseDate > now;
    }, [item.released]);

    return (
        <View style={styles.itemContainer}>
            <Animated.View style={[styles.heroCard, { backgroundColor: theme.colors.surfaceVariant }, animatedStyle]}>
                <ImageBackground
                    source={{ uri: item.background }}
                    style={styles.backgroundImage}
                >
                    <LinearGradient
                        colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']}
                        locations={[0, 0.3, 0.6, 1]}
                        style={styles.gradient}
                    >
                        <View style={styles.content}>
                            {/* Branding Section */}
                            <View style={styles.brandingSection}>
                                {item.logo ? (
                                    <Image source={{ uri: item.logo }} style={styles.logo} resizeMode="contain" />
                                ) : (
                                    <Typography variant="headline-large" weight="black" style={{ color: 'white' }}>
                                        {item.name}
                                    </Typography>
                                )}
                                {isUpcoming && (
                                    <View style={styles.newTag}>
                                        <Typography variant="label-large" weight="black" style={{ color: theme.colors.primary }}>#UPCOMING</Typography>
                                    </View>
                                )}
                            </View>

                            {/* Meta Row */}
                            <View style={styles.metaRow}>
                                {item.released && (
                                    <Typography variant="label-medium" weight="bold" style={{ color: 'white' }}>
                                        {item.released.split('-')[0]}
                                    </Typography>
                                )}
                                {item.rating && (
                                    <View style={styles.metaRowItem}>
                                        <Star size={14} color="#FFD700" fill="#FFD700" />
                                        <Typography variant="label-medium" weight="bold" style={{ color: 'white', marginLeft: 4 }}>{item.rating}</Typography>
                                    </View>
                                )}
                                <Typography variant="label-medium" weight="medium" style={{ color: 'white', opacity: 0.6 }} numberOfLines={1}>
                                    {item.genres?.slice(0, 3).join(' • ')}
                                </Typography>
                            </View>

                            {/* Description */}
                            <Typography
                                variant="body-medium"
                                numberOfLines={3}
                                style={{ color: 'white', opacity: 0.7, marginBottom: 20 }}
                            >
                                {item.description}
                            </Typography>

                            {/* Actions */}
                            <View style={styles.actionRow}>
                                <ExpressiveButton
                                    title="Watch Now"
                                    variant="primary"
                                    onPress={() => onWatch(item)}
                                    icon={<Play size={20} color="black" fill="black" />}
                                    style={styles.actionBtn}
                                />
                                <ExpressiveButton
                                    title="More Info"
                                    variant="tonal"
                                    onPress={() => onInfo(item)}
                                    icon={<Info size={20} color="white" />}
                                    style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                                    textStyle={{ color: 'white' }}
                                />
                            </View>
                        </View>
                    </LinearGradient>
                </ImageBackground>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    itemContainer: {
        width: SCREEN_WIDTH,
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    heroCard: {
        width: HERO_WIDTH,
        height: HERO_HEIGHT,
        borderRadius: 32,
        overflow: 'hidden',
    },
    backgroundImage: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: 24,
        paddingBottom: 56, // Reduced padding
    },
    content: {
    },
    brandingSection: {
        marginBottom: 8,
        alignItems: 'flex-start',
        width: '100%', // Ensure container takes full width
    },
    logo: {
        width: 250, // Constrain width so it doesn't look centered in a huge box
        height: 80,
        marginBottom: 8,
        alignSelf: 'flex-start',
    },
    newTag: {
        marginTop: -4,
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    metaRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        justifyContent: 'center', // Align Center
    },
    actionBtn: {
        width: 140,
        height: 44, // Slightly shorter for sleeker pill look
        borderRadius: 100,
    },
});
