import { Typography } from '@/src/cdk/components/Typography';
import { TraktContentComment } from '@/src/core/api/trakt-types';
import { useTheme } from '@/src/core/ThemeContext';
import { MessageSquare, Star, ThumbsUp } from 'lucide-react-native';
import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

const CARD_WIDTH = 280;

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

interface CommentCardProps {
    comment: TraktContentComment;
    onPress: () => void;
    palette: any;
}

export const CommentCard = memo(({ comment, onPress, palette }: CommentCardProps) => {
    const { theme } = useTheme();
    const [isSpoilerRevealed, setIsSpoilerRevealed] = useState(false);

    const user = comment.user;
    const username = user.name || user.username || 'Anonymous';

    const renderContent = () => {
        if (comment.spoiler && !isSpoilerRevealed) {
            return (
                <Pressable onPress={() => setIsSpoilerRevealed(true)} style={styles.spoilerPlaceholder}>
                    <Typography variant="label" style={{ color: '#FF5252', fontWeight: 'bold', fontSize: 11 }}>
                        ⚠️ Contains spoilers. Tap to reveal.
                    </Typography>
                </Pressable>
            );
        }

        let text = comment.comment;
        text = text.replace(/\[spoiler\]/gi, '').replace(/\[\/spoiler\]/gi, '');

        return (
            <Typography variant="label" numberOfLines={4} style={styles.commentText}>
                {text}
            </Typography>
        );
    };

    return (
        <Pressable onPress={onPress}>
            <View style={[styles.card, { backgroundColor: hexToRgba(palette.vibrant, 0.16) }]}>
                <View style={styles.header}>
                    <View style={styles.userInfo}>
                        <Typography variant="label" weight="bold" style={styles.username}>
                            {username}
                        </Typography>
                        {user.vip && (
                            <View style={[styles.vipBadge, { backgroundColor: palette.lightVibrant }]}>
                                <Typography variant="label" style={styles.vipText}>VIP</Typography>
                            </View>
                        )}
                    </View>
                    {comment.user_stats?.rating && (
                        <View style={styles.rating}>
                            <Star size={10} color="#FFD700" fill="#FFD700" />
                            <Typography variant="label" weight="black" style={styles.ratingText}>
                                {comment.user_stats.rating}/10
                            </Typography>
                        </View>
                    )}
                </View>

                <View style={styles.content}>
                    {renderContent()}
                </View>

                <View style={styles.footer}>
                    <Typography variant="label" style={styles.timeText}>
                        {new Date(comment.created_at).toLocaleDateString()}
                    </Typography>
                    <View style={styles.stats}>
                        {comment.likes > 0 && (
                            <View style={styles.statItem}>
                                <ThumbsUp size={10} color="white" style={{ opacity: 0.6 }} />
                                <Typography variant="label" style={styles.statText}>{comment.likes}</Typography>
                            </View>
                        )}
                        {comment.replies > 0 && (
                            <View style={styles.statItem}>
                                <MessageSquare size={10} color="white" style={{ opacity: 0.6 }} />
                                <Typography variant="label" style={styles.statText}>{comment.replies}</Typography>
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
        color: 'white',
        opacity: 0.7,
        fontSize: 11,
        lineHeight: 16,
    },
    spoilerPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 82, 82, 0.05)',
        borderRadius: 8,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    timeText: {
        color: 'white',
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
        color: 'white',
        opacity: 0.6,
        fontSize: 10,
    },
});
