import { TraktContentComment } from '@/src/core/services/trakt-types';
import { BottomSheetRef, CustomBottomSheet } from '@/src/core/ui/BottomSheet';
import { SectionHeader } from '@/src/core/ui/SectionHeader';
import { useTheme } from '@/src/core/ThemeContext';
import { Typography } from '@/src/core/ui/Typography';
import { useTraktComments } from '@/src/features/trakt/hooks/useTraktComments';
import { Star } from 'lucide-react-native';
import React, { memo, useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { CommentCard } from './CommentCard';

interface CommentsSectionProps {
    id: string | undefined;
    type: 'movie' | 'show' | 'episode';
    season?: number;
    episode?: number;
}

export const CommentsSection = memo(function CommentsSection({ id, type, season, episode }: CommentsSectionProps) {
    const { theme } = useTheme();
    const { height: screenHeight } = useWindowDimensions();
    const { comments, isLoading } = useTraktComments({ id, type, season, episode });
    const [selectedComment, setSelectedComment] = useState<TraktContentComment | null>(null);
    const bottomSheetRef = useRef<BottomSheetRef>(null);

    const skeletonBg = (theme.colors as any).surfaceContainerHigh || theme.colors.surfaceVariant;

    const handleCommentPress = useCallback((comment: TraktContentComment) => {
        setSelectedComment(comment);
        bottomSheetRef.current?.present();
    }, []);

    const renderComment = useCallback(({ item }: { item: TraktContentComment }) => (
        <CommentCard comment={item} onPress={() => handleCommentPress(item)} />
    ), [handleCommentPress]);

    if (!isLoading && comments.length === 0) return null;

    return (
        <View style={styles.container}>
            <SectionHeader
                title="Reviews"
                hideAction
                style={{ paddingHorizontal: 20 }}
            />

            {isLoading && comments.length === 0 ? (
                <View style={[styles.listContent, { flexDirection: 'row', gap: 16 }]}>
                    <View style={{ width: 280, height: 160, borderRadius: 24, backgroundColor: skeletonBg }} />
                    <View style={{ width: 280, height: 160, borderRadius: 24, backgroundColor: skeletonBg }} />
                </View>
            ) : (
                <FlatList
                    data={comments}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderComment}
                    contentContainerStyle={styles.listContent}
                />
            )}

            <CustomBottomSheet
                ref={bottomSheetRef}
                // Render title inside scrollable content so dynamic sizing accounts for it.
                enableDynamicSizing
                scrollable
                // Give short reviews enough room (no mandatory scrolling),
                // while still capping very long reviews.
                maxHeight={screenHeight * 0.5}
            >
                {selectedComment && (
                    <View style={styles.modalContent}>
                        <Typography variant="title-large" weight="bold" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
                            {selectedComment.user.name || selectedComment.user.username || 'Review'}
                        </Typography>
                        {selectedComment.user_stats?.rating && (
                            <View style={styles.modalRating}>
                                <Star size={16} color="#FFD700" fill="#FFD700" />
                                <Typography variant="label" weight="black" style={[styles.ratingText, { color: theme.colors.onSurface }]}>
                                    {selectedComment.user_stats.rating}/10
                                </Typography>
                            </View>
                        )}
                        <Typography variant="body" style={[styles.fullCommentText, { color: theme.colors.onSurface }] }>
                            {selectedComment.comment.replace(/\[spoiler\]/gi, '').replace(/\[\/spoiler\]/gi, '')}
                        </Typography>
                        <Typography
                            variant="label"
                            style={[
                                styles.modalFooter,
                                { color: theme.colors.onSurfaceVariant, borderTopColor: theme.colors.outlineVariant || theme.colors.outline },
                            ]}
                        >
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

    listContent: {
        paddingHorizontal: 20,
    },
    modalContent: {
        paddingBottom: 0,
    },
    modalTitle: {
        color: 'white',
        textAlign: 'center',
        marginBottom: 16,
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
