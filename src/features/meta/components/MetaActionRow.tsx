import { useTheme } from '@/src/core/ThemeContext';
import { Typography } from '@/src/core/ui/Typography';
import { Bookmark, Check, Circle, LayoutGrid, Star } from 'lucide-react-native';
import React, { memo } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

interface MetaActionRowProps {
    isAuthenticated: boolean;
    isListed: boolean;
    isCollected: boolean;
    isWatched: boolean;
    isSeries: boolean;
    userRating: number | null;
    onWatchlistToggle: () => void;
    onCollectionToggle: () => void;
    onWatchedToggle: () => void;
    onRatePress: () => void;
    palette: any;
    style?: ViewStyle;
}

export const MetaActionRow = memo(({
    isAuthenticated,
    isListed,
    isCollected,
    isWatched,
    isSeries,
    userRating,
    onWatchlistToggle,
    onCollectionToggle,
    onWatchedToggle,
    onRatePress,
    palette,
    style
}: MetaActionRowProps) => {
    const { theme } = useTheme();
    const iconColor = theme.colors.onSurface;
    const itemBg = palette.secondaryContainer;

    return (
        <View style={[styles.iconActionRow, style]} >
            <Pressable
                style={styles.iconActionItem}
                onPress={onWatchlistToggle}
                disabled={!isAuthenticated}
            >
                <View style={[styles.pill, { backgroundColor: itemBg }]}>
                    <Bookmark
                        size={22}
                        color={iconColor}
                        fill={isListed ? iconColor : 'transparent'}
                    />
                </View>
                <Typography variant="label" style={[styles.iconActionLabel, { color: iconColor, opacity: 0.8 }]}>
                    Watchlist
                </Typography>
            </Pressable>

            <Pressable
                style={styles.iconActionItem}
                onPress={onCollectionToggle}
                disabled={!isAuthenticated}
            >
                <View style={[styles.pill, { backgroundColor: itemBg }]}>
                    <LayoutGrid
                        size={22}
                        color={iconColor}
                        fill={isCollected ? iconColor : 'transparent'}
                    />
                </View>
                <Typography variant="label" style={[styles.iconActionLabel, { color: iconColor, opacity: 0.8 }]}>
                    Collection
                </Typography>
            </Pressable>

            {!isSeries && (
                <Pressable
                    style={styles.iconActionItem}
                    onPress={onWatchedToggle}
                    disabled={!isAuthenticated}
                >
                    <View style={[styles.pill, { backgroundColor: itemBg }]}>
                        {isWatched ? (
                            <Check size={22} color={iconColor} />
                        ) : (
                            <Circle size={22} color={iconColor} />
                        )}
                    </View>
                    <Typography variant="label" style={[styles.iconActionLabel, { color: iconColor, opacity: 0.8 }]}>
                        Watched
                    </Typography>
                </Pressable>
            )}

            <Pressable
                style={styles.iconActionItem}
                onPress={onRatePress}
                disabled={!isAuthenticated}
            >
                <View style={[styles.pill, { backgroundColor: itemBg }]}>
                    <Star
                        size={22}
                        color={userRating ? '#FFD700' : iconColor}
                        fill={userRating ? '#FFD700' : 'transparent'}
                    />
                </View>
                <Typography variant="label" style={[styles.iconActionLabel, userRating ? { color: '#FFD700' } : { color: iconColor, opacity: 0.8 }]}>
                    {userRating ? `Rated ${userRating * 2}` : 'Rate'}
                </Typography>
            </Pressable>
        </View >
    );
});

const styles = StyleSheet.create({
    iconActionRow: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
    iconActionItem: { alignItems: 'center', gap: 6 },
    pill: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    iconActionLabel: { fontSize: 10, fontWeight: '600' },
});
