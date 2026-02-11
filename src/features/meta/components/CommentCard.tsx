import { TraktContentComment } from '@/src/core/services/trakt-types';
import { useTheme } from '@/src/core/ThemeContext';
import { Typography } from '@/src/core/ui/Typography';
import { MessageSquare, Star, ThumbsUp } from 'lucide-react-native';
import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

const CARD_WIDTH = 280;

interface CommentCardProps {
    comment: TraktContentComment;
    onPress: () => void;
}

export const CommentCard = memo(function CommentCard({ comment, onPress }: CommentCardProps) {
    const { theme } = useTheme();
    const [isSpoilerRevealed, setIsSpoilerRevealed] = useState(false);

    const cardBg = (theme.colors as any).surfaceContainerHigh
        || (theme.colors as any).surfaceContainer
        || (theme.colors as any).surfaceContainerHighest
        || theme.colors.surfaceVariant;

    const user = comment.user;
    const username = user.name || user.username || 'Anonymous';

    const renderContent = () => {
        if (comment.spoiler && !isSpoilerRevealed) {
            return (
                <Pressable onPress={() => setIsSpoilerRevealed(true)} style={styles.spoilerPlaceholder}>
                    <Typography variant="label" style={{ color: theme.colors.error, fontWeight: 'bold', fontSize: 11 }}>
                        ⚠️ Contains spoilers. Tap to reveal.
                    </Typography>
                </Pressable>
            );
        }

        let text = comment.comment;
        text = text.replace(/\[spoiler\]/gi, '').replace(/\[\/spoiler\]/gi, '');

        return (
            <Typography variant="label" numberOfLines={4} style={[styles.commentText, { color: theme.colors.onSurfaceVariant }]}>
                {text}
            </Typography>
        );
    };

    return (
        <Pressable onPress={onPress}>
            <View style={[styles.card, { backgroundColor: cardBg }]}>
                <View style={styles.header}>
                    <View style={styles.userInfo}>
                        <Typography variant="label" weight="bold" style={[styles.username, { color: theme.colors.onSurface }]}>
                            {username}
                        </Typography>
                        {user.vip && (
                            <View style={[styles.vipBadge, { backgroundColor: theme.colors.tertiaryContainer }]}>
                                <Typography variant="label" style={[styles.vipText, { color: theme.colors.onTertiaryContainer }]}>VIP</Typography>
                            </View>
                        )}
                    </View>
                    {comment.user_stats?.rating && (
                        <View style={styles.rating}>
                            <Star size={10} color="#FFD700" fill="#FFD700" />
                            <Typography variant="label" weight="black" style={[styles.ratingText, { color: theme.colors.onSurface }]}>
                                {comment.user_stats.rating}/10
                            </Typography>
                        </View>
                    )}
                </View>

                <View style={styles.content}>
                    {renderContent()}
                </View>

                <View style={styles.footer}>
                    <Typography variant="label" style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
                        {new Date(comment.created_at).toLocaleDateString()}
                    </Typography>
                    <View style={styles.stats}>
                        {comment.likes > 0 && (
                            <View style={styles.statItem}>
                                <ThumbsUp size={10} color={theme.colors.onSurfaceVariant} style={{ opacity: 0.8 }} />
                                <Typography variant="label" style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>{comment.likes}</Typography>
                            </View>
                        )}
                        {comment.replies > 0 && (
                            <View style={styles.statItem}>
                                <MessageSquare size={10} color={theme.colors.onSurfaceVariant} style={{ opacity: 0.8 }} />
                                <Typography variant="label" style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>{comment.replies}</Typography>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Pressable>
    );
});

const styles = StyleSheet.create({
    card: {
        width: CARD_WIDTH,
        padding: 16,
        borderRadius: 16, // Match Catalog standard
        height: 160,
        marginRight: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    username: {
        color: 'white',
        fontSize: 13,
    },
    vipBadge: {
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    vipText: {
        color: 'black',
        fontSize: 8,
        fontWeight: 'bold',
    },
    rating: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ratingText: {
        color: 'white',
        fontSize: 10,
    },
    content: {
        flex: 1,
    },
    commentText: {
        opacity: 0.8,
        fontSize: 11,
        lineHeight: 16,
    },
    spoilerPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 82, 82, 0.08)',
        borderRadius: 8,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    timeText: {
        opacity: 0.4,
        fontSize: 10,
    },
    stats: {
        flexDirection: 'row',
        gap: 12,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        opacity: 0.6,
        fontSize: 10,
    },
});
