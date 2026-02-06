import { Meta } from '@/src/core/hooks/useHeroItems';
import { ExpressiveButton } from '@/src/core/ui/ExpressiveButton';
import { Typography } from '@/src/core/ui/Typography';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Info, Play, Star } from 'lucide-react-native';
import React, { memo } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';

// Stable colors interface to avoid passing full theme object
export interface HeroThemeColors {
    primary: string;
    surfaceVariant: string;
    background: string;
}

interface HeroSlideProps {
    item: Meta;
    index: number;
    scrollX: SharedValue<number>;
    width: number;
    height: number;
    themeColors: HeroThemeColors;
    isFocused: boolean;
    onWatch: (item: Meta) => void;
    onInfo: (item: Meta) => void;
}

const HeroSlideComponent = ({ 
    item, 
    index, 
    scrollX, 
    width, 
    height, 
    themeColors, 
    isFocused, 
    onWatch, 
    onInfo 
}: HeroSlideProps) => {
    
    // Animated Parallax Style - Only subscribe to updates if this slide is near viewport
    // Note: In a FlatList with removeClippedSubviews, off-screen views are unmounted,
    // but for the ones in window, we want to optimize.
    const animatedStyle = useAnimatedStyle(() => {
        const input = [(index - 1) * width, index * width, (index + 1) * width];
        const opacity = interpolate(scrollX.value, input, [0.8, 1, 0.8], 'clamp');
        return {
            opacity,
        };
    });

    const isUpcoming = React.useMemo(() => {
        if (!item.released) return false;
        // Simple string comparison usually works for ISO dates, but new Date is safer
        const releaseDate = new Date(item.released);
        const now = new Date();
        return releaseDate > now;
    }, [item.released]);

    // Pre-computed styles based on props
    const containerStyle: ViewStyle = { width };
    const cardStyle: ViewStyle = { 
        backgroundColor: themeColors.surfaceVariant, 
        height,
        width 
    };

    return (
        <View style={containerStyle}>
            <Animated.View style={[
                styles.heroCard,
                cardStyle,
                animatedStyle
            ]}>
                <View style={styles.backgroundImage}>
                    <ExpoImage
                        recyclingKey={item.id}
                        source={{ uri: item.background }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={Platform.OS === 'android' ? 0 : 200}
                        cachePolicy="memory-disk"
                        priority={isFocused ? 'high' : 'normal'}
                    />
                    <LinearGradient
                        colors={[
                            'rgba(0,0,0,0.5)',
                            'transparent',
                            'transparent',
                            'rgba(0,0,0,0.4)',
                            themeColors.background
                        ]}
                        locations={[0, 0.2, 0.5, 0.8, 1]}
                        style={styles.gradient}
                    >
                        <View style={styles.content}>
                            {/* Branding Section */}
                            <View style={styles.brandingSection}>
                                {item.logo ? (
                                    <ExpoImage
                                        source={{ uri: item.logo }}
                                        style={styles.logo}
                                        contentFit="contain"
                                        transition={Platform.OS === 'android' ? 0 : 200}
                                        cachePolicy="memory-disk"
                                        priority={isFocused ? 'high' : 'low'}
                                    />
                                ) : (
                                    <Typography variant="headline-large" weight="black" style={{ color: 'white' }}>
                                        {item.name}
                                    </Typography>
                                )}
                                {isUpcoming && (
                                    <View style={styles.newTag}>
                                        <Typography variant="label-large" weight="black" style={{ color: themeColors.primary }}>#UPCOMING</Typography>
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
                                style={{ color: 'white', opacity: 0.7, marginBottom: 24 }}
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
                                    title=""
                                    variant="tonal"
                                    onPress={() => onInfo(item)}
                                    icon={<Info size={22} color="white" />}
                                    style={styles.infoBtn}
                                />
                            </View>
                        </View>
                    </LinearGradient>
                </View>
            </Animated.View>
        </View>
    );
};

// Optimized equality check for React.memo
const arePropsEqual = (prev: HeroSlideProps, next: HeroSlideProps) => {
    return (
        prev.item.id === next.item.id &&
        prev.isFocused === next.isFocused &&
        prev.width === next.width &&
        prev.height === next.height &&
        prev.themeColors.primary === next.themeColors.primary && // Shallow check colors
        prev.themeColors.background === next.themeColors.background
        // scrollX is a SharedValue ref, so it doesn't change
        // onWatch/onInfo should be stable callbacks
    );
};

export const HeroSlide = memo(HeroSlideComponent, arePropsEqual);

const styles = StyleSheet.create({
    heroCard: {
        overflow: 'hidden',
    },
    backgroundImage: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: 24,
        paddingBottom: 40,
    },
    content: {
        maxWidth: 600, 
    },
    brandingSection: {
        marginBottom: 8,
        alignItems: 'flex-start',
        width: '100%',
    },
    logo: {
        width: 300,
        height: 120,
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
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    actionBtn: {
        width: 160,
        height: 52,
        borderRadius: 100,
    },
    infoBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 0,
    },
});
