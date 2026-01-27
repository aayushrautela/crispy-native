
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
    style
}: MetaActionRowProps) => {
    return (
        <View style={[styles.iconActionRow, style]}>
            <Pressable
                style={styles.iconActionItem}
                onPress={onWatchlistToggle}
                disabled={!isAuthenticated}
            >
                <Bookmark
                    size={24}
                    color="white"
                    fill={isListed ? 'white' : 'transparent'}
                />
                <Typography variant="label" style={[styles.iconActionLabel, { color: 'white' }]}>
                    Watchlist
                </Typography>
            </Pressable>

            <Pressable
                style={styles.iconActionItem}
                onPress={onCollectionToggle}
                disabled={!isAuthenticated}
            >
                <LayoutGrid
                    size={24}
                    color="white"
                    fill={isCollected ? 'white' : 'transparent'}
                />
                <Typography variant="label" style={[styles.iconActionLabel, { color: 'white' }]}>
                    Collection
                </Typography>
            </Pressable>

            {!isSeries && (
                <Pressable
                    style={styles.iconActionItem}
                    onPress={onWatchedToggle}
                    disabled={!isAuthenticated}
                >
                    {isWatched ? (
                        <Check size={24} color={'white'} />
                    ) : (
                        <Circle size={24} color="white" />
                    )}
                    <Typography variant="label" style={[styles.iconActionLabel, { color: 'white' }]}>
                        Watched
                    </Typography>
                </Pressable>
            )}

            <Pressable
                style={styles.iconActionItem}
                onPress={onRatePress}
                disabled={!isAuthenticated}
            >
                <Star
                    size={24}
                    color={userRating ? '#FFD700' : 'white'}
                    fill={userRating ? '#FFD700' : 'transparent'}
                />
                <Typography variant="label" style={[styles.iconActionLabel, userRating && { color: '#FFD700' }]}>
                    {userRating ? `Rated ${userRating * 2}` : 'Rate'}
                </Typography>
            </Pressable>
        </View>
    );
});

const styles = StyleSheet.create({
    iconActionRow: { flexDirection: 'row', justifyContent: 'center', gap: 32 },
    iconActionItem: { alignItems: 'center', gap: 8 },
    iconActionLabel: { fontSize: 10 },
});
