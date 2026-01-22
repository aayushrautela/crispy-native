import { BottomSheetRef, CustomBottomSheet } from '@/src/cdk/components/BottomSheet';
import { Typography } from '@/src/cdk/components/Typography';
import { TraktContentComment } from '@/src/core/api/trakt-types';
import { useTraktComments } from '@/src/core/hooks/useTraktComments';
import { useTheme } from '@/src/core/ThemeContext';
import { Star } from 'lucide-react-native';
import React, { memo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { CommentCard } from './CommentCard';

interface CommentsSectionProps {
    id: string | undefined;
    type: 'movie' | 'show' | 'season' | 'episode';
    season?: number;
    episode?: number;
    colors: any;
}

export const CommentsSection = memo(({ id, type, season, episode, colors }: CommentsSectionProps) => {
    const { theme } = useTheme();
    const { comments, isLoading } = useTraktComments({ id, type, season, episode });
    const [selectedComment, setSelectedComment] = useState<TraktContentComment | null>(null);
    const bottomSheetRef = useRef<BottomSheetRef>(null);

    const handleCommentPress = (comment: TraktContentComment) => {
        setSelectedComment(comment);
        bottomSheetRef.current?.present();
    };

    if (!isLoading && comments.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Typography variant="label" weight="black" style={styles.title}>TRAKT REVIEWS</Typography>
                <Typography variant="label" style={styles.countText}>
                    {isLoading ? 'Loading...' : `${comments.length}+ reviews`}
                </Typography>
            </View>

            <FlatList
                data={comments}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <CommentCard comment={item} onPress={() => handleCommentPress(item)} palette={colors} />
                )}
                contentContainerStyle={styles.listContent}
            />

            <CustomBottomSheet
                ref={bottomSheetRef}
                title={selectedComment ? (selectedComment.user.name || selectedComment.user.username) : 'Review'}
                enableDynamicSizing
            >
                {selectedComment && (
                    <View style={styles.modalContent}>
                        {selectedComment.user_stats?.rating && (
                            <View style={styles.modalRating}>
                                <Star size={16} color="#FFD700" fill="#FFD700" />
                                <Typography variant="label" weight="black" style={styles.ratingText}>
                                    {selectedComment.user_stats.rating}/10
                                </Typography>
                            </View>
                        )}
                        <Typography variant="body" style={styles.fullCommentText}>
                            {selectedComment.comment.replace(/\[spoiler\]/gi, '').replace(/\[\/spoiler\]/gi, '')}
                        </Typography>
                        <Typography variant="label" style={styles.modalFooter}>
                            Posted on {new Date(selectedComment.created_at).toLocaleDateString()}
                        </Typography>
                    </View>
                )}
            </CustomBottomSheet>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        marginTop: 32,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 16,
    },
    title: {
        color: 'white',
        letterSpacing: 2,
        fontSize: 10,
        opacity: 0.6,
    },
    countText: {
        color: 'white',
        opacity: 0.4,
        fontSize: 10,
    },
    listContent: {
        paddingRight: 20,
    },
    modalContent: {
        paddingHorizontal: 4,
        paddingBottom: 20,
    },
    modalRating: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 16,
    },
    ratingText: {
        color: 'white',
        fontSize: 14,
    },
    fullCommentText: {
        color: 'white',
        opacity: 0.9,
        lineHeight: 24,
        fontSize: 16,
        marginBottom: 24,
    },
    modalFooter: {
        color: 'white',
        opacity: 0.4,
        fontSize: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingTop: 16,
    }
});
