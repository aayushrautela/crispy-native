import { useCallback, useEffect, useState } from 'react';
import { TraktService } from '../../../core/services/TraktService';
import { useUserStore } from '../stores/userStore';

export type WatchState = 'watch' | 'continue' | 'rewatch';

export function useTraktWatchState(id: string | undefined, type: string | undefined) {
    const [state, setState] = useState<WatchState>('watch');
    const [progress, setProgress] = useState<number | undefined>(undefined);
    const [episode, setEpisode] = useState<any>(null);
    const [lastWatchedAt, setLastWatchedAt] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);

    const traktAuth = useUserStore(s => s.traktAuth);
    const isAuthenticated = !!traktAuth.accessToken;

    const checkState = useCallback(async () => {
        if (!isAuthenticated || !id || !type) {
            setState('watch');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const cleanId = id.startsWith('tmdb:') ? id.split(':')[1] : id;

            // 1. Check Continue Watching (Playback)
            const playback = await TraktService.getContinueWatching();

            const playbackItem = playback.find(item => {
                const media = item.type === 'movie' ? item.movie : item.show;
                if (!media) return false;
                const mIds = media.ids;

                // Compare IDs
                if (mIds.imdb && mIds.imdb === id) return true;
                if (mIds.tmdb && String(mIds.tmdb) === cleanId) return true;
                if (mIds.trakt && String(mIds.trakt) === cleanId) return true;
                return false;
            });

            if (playbackItem && playbackItem.progress > 2 && playbackItem.progress < 85) {
                setState('continue');
                setProgress(playbackItem.progress);
                setEpisode(playbackItem.episode);
                setIsLoading(false);
                return;
            }

            // 2. Check Watched History
            // For now, using getWatched (recently watched). 
            // Better would be a specific check, but this works for most cases without adding more API surface.
            const watched = await TraktService.getWatched();
            const watchedItem = watched.find(item => {
                const media = item.type === 'movie' ? item.movie : item.show;
                if (!media) return false;
                const mIds = media.ids;

                if (mIds.imdb && mIds.imdb === id) return true;
                if (mIds.tmdb && String(mIds.tmdb) === cleanId) return true;
                if (mIds.trakt && String(mIds.trakt) === cleanId) return true;
                return false;
            });

            if (watchedItem) {
                setState('rewatch');
                setLastWatchedAt(watchedItem.paused_at);
            } else {
                setState('watch');
            }
        } catch (e) {
            console.error('[useTraktWatchState] Error:', e);
            setState('watch');
        } finally {
            setIsLoading(false);
        }
    }, [id, type, isAuthenticated]);

    useEffect(() => {
        checkState();
    }, [checkState]);

    return { state, progress, episode, lastWatchedAt, isLoading, refresh: checkState, isAuthenticated };
}
