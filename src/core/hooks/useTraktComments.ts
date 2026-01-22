import { useCallback, useEffect, useState } from 'react';
import { TraktService } from '../api/TraktService';
import { TraktContentComment } from '../api/trakt-types';

interface UseTraktCommentsProps {
    id: string | undefined;
    type: 'movie' | 'show' | 'season' | 'episode';
    season?: number;
    episode?: number;
    enabled?: boolean;
}

export function useTraktComments({ id, type, season, episode, enabled = true }: UseTraktCommentsProps) {
    const [comments, setComments] = useState<TraktContentComment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const loadComments = useCallback(async (pageNum: number = 1, append: boolean = false) => {
        if (!enabled || !id) return;

        setIsLoading(true);
        setError(null);
        try {
            const results = await TraktService.getComments(type, id, {
                season,
                episode,
                page: pageNum,
                limit: 10
            });

            if (results.length < 10) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }

            if (append) {
                setComments(prev => {
                    // Filter out duplicates just in case
                    const existingIds = new Set(prev.map(c => c.id));
                    const newComments = results.filter(c => !existingIds.has(c.id));
                    return [...prev, ...newComments];
                });
            } else {
                setComments(results);
            }
            setPage(pageNum);
        } catch (e) {
            console.error('[useTraktComments] Error:', e);
            setError('Failed to load comments');
        } finally {
            setIsLoading(false);
        }
    }, [id, type, season, episode, enabled]);

    useEffect(() => {
        // Reset when ID or type changes
        setPage(1);
        setHasMore(true);
        loadComments(1, false);
    }, [id, type, season, episode, enabled]);

    const loadMore = useCallback(() => {
        if (!isLoading && hasMore) {
            loadComments(page + 1, true);
        }
    }, [isLoading, hasMore, page, loadComments]);

    return {
        comments,
        isLoading,
        error,
        hasMore,
        loadMore,
        refresh: () => loadComments(1, false)
    };
}
