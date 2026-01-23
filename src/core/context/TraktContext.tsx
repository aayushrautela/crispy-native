
import debounce from 'lodash.debounce';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    TraktCollectionItem,
    TraktPlaybackItem,
    TraktRatingItem,
    TraktUser,
    TraktWatchedMovie,
    TraktWatchedShow,
    TraktWatchlistItem
} from '../api/trakt-types';
import { TraktService } from '../api/TraktService';
import { useUserStore } from '../stores/userStore';

interface TraktContextProps {
    isAuthenticated: boolean;
    isLoading: boolean;
    userProfile: TraktUser | null;

    // Library Data
    watchedMovies: TraktWatchedMovie[];
    watchedShows: TraktWatchedShow[];
    watchlistMovies: TraktWatchlistItem[];
    watchlistShows: TraktWatchlistItem[];
    collectionMovies: TraktCollectionItem[];
    collectionShows: TraktCollectionItem[];
    continueWatching: TraktPlaybackItem[];
    ratedContent: TraktRatingItem[];

    // Actions
    checkAuthStatus: () => Promise<void>;
    loadAllCollections: (force?: boolean) => Promise<void>;

    // Status Checks
    isMovieWatched: (imdbId: string) => boolean;
    isEpisodeWatched: (imdbId: string, season: number, episode: number) => boolean;
    isInWatchlist: (imdbId: string, type: 'movie' | 'show') => boolean;
    isInCollection: (imdbId: string, type: 'movie' | 'show') => boolean;
    getUserRating: (imdbId: string, type: 'movie' | 'show') => number | null;
    getWatchState: (imdbId: string, type: 'movie' | 'show') => { state: 'watch' | 'continue' | 'rewatch'; progress?: number; episode?: any };

    // Write Actions
    markMovieAsWatched: (imdbId: string, watchedAt?: Date) => Promise<boolean>;
    removeMovieFromHistory: (imdbId: string) => Promise<boolean>;
    markEpisodeAsWatched: (imdbId: string, season: number, episode: number, watchedAt?: Date) => Promise<boolean>;
    addToWatchlist: (imdbId: string, type: 'movie' | 'show') => Promise<boolean>;
    removeFromWatchlist: (imdbId: string, type: 'movie' | 'show') => Promise<boolean>;
    addToCollection: (imdbId: string, type: 'movie' | 'show') => Promise<boolean>;
    removeFromCollection: (imdbId: string, type: 'movie' | 'show') => Promise<boolean>;
    rateContent: (imdbId: string, type: 'movie' | 'show' | 'episode', rating: number) => Promise<boolean>;
    removeContentRating: (imdbId: string, type: 'movie' | 'show' | 'episode') => Promise<boolean>;
}

const TraktContext = createContext<TraktContextProps | undefined>(undefined);

export function TraktProvider({ children }: { children: ReactNode }) {
    const { traktAuth } = useUserStore();
    const isAuthenticated = !!traktAuth.accessToken;
    const [isLoading, setIsLoading] = useState<boolean>(isAuthenticated);
    const [userProfile, setUserProfile] = useState<TraktUser | null>(null);

    // State
    const [watchedMovies, setWatchedMovies] = useState<TraktWatchedMovie[]>([]);
    const [watchedShows, setWatchedShows] = useState<TraktWatchedShow[]>([]); // Note: This structure differs from playback items
    // We might need to fetch full history or derive from playback/watched sync

    // For native app simplification, we'll map getWatched() response (PlaybackItems) 
    // to separate arrays if needed, or just use sets for checking status.
    // TraktService.getWatched() returns TraktPlaybackItem[] (hydrated).
    // Let's stick to the requested interface but adapt our data source.

    const [watchlist, setWatchlist] = useState<TraktPlaybackItem[]>([]);
    const [collection, setCollection] = useState<TraktPlaybackItem[]>([]);
    const [continueWatching, setContinueWatching] = useState<TraktPlaybackItem[]>([]);
    const [ratedContent, setRatedContent] = useState<TraktRatingItem[]>([]);

    // Helper Sets for O(1) Access
    const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
    const [collectionIds, setCollectionIds] = useState<Set<string>>(new Set());
    const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());

    // Derived Lists for specific Types (matching webui interface)
    const watchlistMovies = useMemo(() => watchlist.filter(i => i.type === 'movie').map(i => ({ ...i, movie: i.movie, type: 'movie' } as any)), [watchlist]); // Cast as any because PlaybackItem != WatchlistItem exactly, but close enough for UI
    const watchlistShows = useMemo(() => watchlist.filter(i => i.type === 'episode' || i.show).map(i => ({ ...i, show: i.show, type: 'show' } as any)), [watchlist]);

    const collectionMovies = useMemo(() => collection.filter(i => i.type === 'movie').map(i => ({ ...i, movie: i.movie, type: 'movie' } as any)), [collection]);
    const collectionShows = useMemo(() => collection.filter(i => i.type === 'episode' || i.show).map(i => ({ ...i, show: i.show, type: 'show' } as any)), [collection]);

    const checkAuthStatus = useCallback(async () => {
        // user profile fetching could be added to TraktService if needed
        // For now just relies on store token presence
    }, []);

    const loadAllCollections = useCallback(async (force = false) => {
        if (!isAuthenticated) return;
        setIsLoading(true);
        try {
            const [w, c, p, r] = await Promise.all([
                TraktService.getWatchlist(),
                TraktService.getCollection(),
                TraktService.getContinueWatching(),
                TraktService.getRated()
            ]);

            // We also need watched history for "watched" checks (completed items)
            // extending to fetch watched history
            const h = await TraktService.getWatched(); // This returns PlaybackItems derived from watched history

            setWatchlist(w);
            setCollection(c);
            setContinueWatching(p);
            setRatedContent(r);

            // Rebuild Sets
            const newWatchlistIds = new Set<string>();
            w.forEach(item => {
                if (item.meta?.id) newWatchlistIds.add(item.meta.id);
                // Also add raw IDs
                if (item.movie?.ids?.imdb) newWatchlistIds.add(`movie:${item.movie.ids.imdb}`);
                if (item.movie?.ids?.tmdb) newWatchlistIds.add(`movie:${item.movie.ids.tmdb}`);
                if (item.show?.ids?.imdb) newWatchlistIds.add(`show:${item.show.ids.imdb}`);
                if (item.show?.ids?.tmdb) newWatchlistIds.add(`show:${item.show.ids.tmdb}`);
            });
            setWatchlistIds(newWatchlistIds);

            const newCollectionIds = new Set<string>();
            c.forEach(item => {
                if (item.meta?.id) newCollectionIds.add(item.meta.id);
                if (item.movie?.ids?.imdb) newCollectionIds.add(`movie:${item.movie.ids.imdb}`);
                if (item.movie?.ids?.tmdb) newCollectionIds.add(`movie:${item.movie.ids.tmdb}`);
                if (item.show?.ids?.imdb) newCollectionIds.add(`show:${item.show.ids.imdb}`);
                if (item.show?.ids?.tmdb) newCollectionIds.add(`show:${item.show.ids.tmdb}`);
            });
            setCollectionIds(newCollectionIds);

            const newWatchedIds = new Set<string>();
            h.forEach(item => {
                if (item.meta?.id) newWatchedIds.add(item.meta.id);
                if (item.movie?.ids?.imdb) newWatchedIds.add(`movie:${item.movie.ids.imdb}`);
                if (item.movie?.ids?.tmdb) newWatchedIds.add(`movie:${item.movie.ids.tmdb}`);
                // For shows, getWatched returns episodes, or we can transform 
                // We need to know if a SHOW/MOVIE is watched.
                if (item.type === 'movie' && item.movie) {
                    if (item.movie.ids.imdb) newWatchedIds.add(`movie:${item.movie.ids.imdb}`);
                    if (item.movie.ids.tmdb) newWatchedIds.add(`movie:${item.movie.ids.tmdb}`);
                }
                // Shows are tricky as they come as collected episodes. 
                // We will simply track if "show:" + id exists, it means *some* of it is watched.
                if (item.show) {
                    if (item.show.ids.imdb) newWatchedIds.add(`show:${item.show.ids.imdb}`);
                    if (item.show.ids.tmdb) newWatchedIds.add(`show:${item.show.ids.tmdb}`);
                }
            });
            setWatchedIds(newWatchedIds);

        } catch (e) {
            console.error('Failed to load Trakt collections', e);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated]);

    // Initial Load
    useEffect(() => {
        if (isAuthenticated) {
            loadAllCollections();
        }
    }, [isAuthenticated]);

    // Debounced Sync
    const debouncedSync = useMemo(
        () => debounce(() => {
            loadAllCollections(true);
        }, 2000),
        [loadAllCollections]
    );

    // Helpers
    const createTraktId = (id: string) => {
        if (id.startsWith('tt')) return { ids: { imdb: id } };
        const tmdbId = parseInt(id, 10);
        if (!isNaN(tmdbId)) return { ids: { tmdb: tmdbId } };
        return { ids: { tmdb: tmdbId } }; // Fallback
    };

    // --- Status Checks ---

    const isMovieWatched = useCallback((imdbId: string) => {
        return watchedIds.has(`movie:${imdbId}`) || watchedIds.has(imdbId);
    }, [watchedIds]);

    const isEpisodeWatched = useCallback((imdbId: string, season: number, episode: number) => {
        // This is harder with just sets. Requires detailed history check.
        // For now, return false or implement detailed check if needed.
        // Or store episodes in a specific set structure "showId:S:E"
        // Let's implement basic support via API check or detailed history download later
        return false;
    }, []);

    const isInWatchlist = useCallback((id: string, type: 'movie' | 'show') => {
        return watchlistIds.has(`${type}:${id}`) || watchlistIds.has(id);
    }, [watchlistIds]);

    const isInCollection = useCallback((id: string, type: 'movie' | 'show') => {
        return collectionIds.has(`${type}:${id}`) || collectionIds.has(id);
    }, [collectionIds]);

    const getUserRating = useCallback((id: string, type: 'movie' | 'show'): number | null => {
        const item = ratedContent.find(r => {
            const media = type === 'movie' ? r.movie : r.show;
            if (!media) return false;
            // Check IDs
            if (id.startsWith('tt')) return media.ids.imdb === id;
            return media.ids.tmdb === parseInt(id, 10);
        });
        return item ? Math.round(item.rating / 2) : null; // 10 -> 5 scale
    }, [ratedContent]);

    const getWatchState = useCallback((id: string, type: 'movie' | 'show') => {
        // 1. Check Continue Watching
        const playbackItem = continueWatching.find(item => {
            if (type === 'movie' && item.type === 'movie') {
                const m = item.movie;
                if (!m) return false;
                if (id.startsWith('tt')) return m.ids.imdb === id;
                return m.ids.tmdb === parseInt(id, 10);
            }
            if (type === 'show' && (item.type === 'episode' || item.show)) {
                const s = item.show;
                if (!s) return false;
                if (id.startsWith('tt')) return s.ids.imdb === id;
                return s.ids.tmdb === parseInt(id, 10);
            }
            return false;
        });

        if (playbackItem) {
            return {
                state: 'continue' as const,
                progress: playbackItem.progress,
                episode: playbackItem.episode
            };
        }

        // 2. Check Watched
        if (isMovieWatched(id) || (type === 'show' && watchedIds.has(`show:${id}`))) {
            return { state: 'rewatch' as const };
        }

        return { state: 'watch' as const };
    }, [continueWatching, isMovieWatched, watchedIds]);


    // --- Actions ---

    const addToWatchlist = useCallback(async (id: string, type: 'movie' | 'show') => {
        if (!isAuthenticated) return false;

        // Optimistic
        setWatchlistIds(prev => new Set(prev).add(`${type}:${id}`).add(id));

        const payload = type === 'movie' ? { movies: [createTraktId(id)] } : { shows: [createTraktId(id)] };
        try {
            await TraktService.addToWatchlist(type === 'movie' ? 'movies' : 'shows', payload);
            debouncedSync();
            return true;
        } catch {
            setWatchlistIds(prev => {
                const next = new Set(prev);
                next.delete(`${type}:${id}`);
                next.delete(id);
                return next;
            });
            return false;
        }
    }, [isAuthenticated, debouncedSync]);

    const removeFromWatchlist = useCallback(async (id: string, type: 'movie' | 'show') => {
        if (!isAuthenticated) return false;

        // Optimistic
        setWatchlistIds(prev => {
            const next = new Set(prev);
            next.delete(`${type}:${id}`);
            next.delete(id);
            return next;
        });

        const payload = type === 'movie' ? { movies: [createTraktId(id)] } : { shows: [createTraktId(id)] };
        try {
            await TraktService.removeFromWatchlist(type === 'movie' ? 'movies' : 'shows', payload);
            debouncedSync();
            return true;
        } catch {
            // Revert
            setWatchlistIds(prev => new Set(prev).add(`${type}:${id}`).add(id));
            return false;
        }
    }, [isAuthenticated, debouncedSync]);

    const addToCollection = useCallback(async (id: string, type: 'movie' | 'show') => {
        if (!isAuthenticated) return false;
        setCollectionIds(prev => new Set(prev).add(`${type}:${id}`).add(id));
        const payload = type === 'movie' ? { movies: [createTraktId(id)] } : { shows: [createTraktId(id)] };
        try {
            await TraktService.addToCollection(payload);
            debouncedSync();
            return true;
        } catch {
            setCollectionIds(prev => {
                const next = new Set(prev);
                next.delete(`${type}:${id}`);
                return next;
            });
            return false;
        }
    }, [isAuthenticated, debouncedSync]);

    const removeFromCollection = useCallback(async (id: string, type: 'movie' | 'show') => {
        if (!isAuthenticated) return false;
        setCollectionIds(prev => {
            const next = new Set(prev);
            next.delete(`${type}:${id}`);
            next.delete(id);
            return next;
        });
        const payload = type === 'movie' ? { movies: [createTraktId(id)] } : { shows: [createTraktId(id)] };
        try {
            await TraktService.removeFromCollection(payload);
            debouncedSync();
            return true;
        } catch {
            return false;
        }
    }, [isAuthenticated, debouncedSync]);

    const rateContent = useCallback(async (id: string, type: 'movie' | 'show' | 'episode', rating: number) => {
        if (!isAuthenticated) return false;

        const traktRating = rating * 2; // 5 -> 10 scale
        const payloadBase = createTraktId(id);
        const itemPayload = { ...payloadBase, rating: traktRating, rated_at: new Date().toISOString() };

        let payload: any = {};
        if (type === 'movie') payload.movies = [itemPayload];
        if (type === 'show') payload.shows = [itemPayload];
        if (type === 'episode') payload.episodes = [itemPayload];

        // Optimistic Update
        const optimisticItem: TraktRatingItem = {
            rating: traktRating,
            rated_at: new Date().toISOString(),
            type: type,
            movie: type === 'movie' ? { ids: payloadBase.ids, title: '' } as any : undefined,
            show: type === 'show' ? { ids: payloadBase.ids, title: '' } as any : undefined,
        };

        setRatedContent(prev => {
            const filtered = prev.filter(r => {
                const media = type === 'movie' ? r.movie : r.show;
                if (!media) return true;
                if (id.startsWith('tt')) return media.ids.imdb !== id;
                return media.ids.tmdb !== parseInt(id, 10);
            });
            return [...filtered, optimisticItem];
        });

        try {
            await TraktService.addRating(payload);
            debouncedSync();
            return true;
        } catch {
            return false;
        }
    }, [isAuthenticated, debouncedSync]);

    const removeContentRating = useCallback(async (id: string, type: 'movie' | 'show' | 'episode') => {
        if (!isAuthenticated) return false;

        const payloadBase = createTraktId(id);
        let payload: any = {};
        if (type === 'movie') payload.movies = [payloadBase];
        if (type === 'show') payload.shows = [payloadBase];
        if (type === 'episode') payload.episodes = [payloadBase];

        setRatedContent(prev => {
            return prev.filter(r => {
                const media = type === 'movie' ? r.movie : r.show;
                if (!media) return true;
                if (id.startsWith('tt')) return media.ids.imdb !== id;
                return media.ids.tmdb !== parseInt(id, 10);
            });
        });

        try {
            await TraktService.removeRating(payload);
            debouncedSync();
            return true;
        } catch {
            return false;
        }
    }, [isAuthenticated, debouncedSync]);

    const markMovieAsWatched = async (id: string) => {
        if (!isAuthenticated) return false;
        setWatchedIds(prev => new Set(prev).add(`movie:${id}`).add(id));
        try {
            await TraktService.addToHistory({ movies: [createTraktId(id)] });
            debouncedSync();
            return true;
        } catch { return false; }
    };

    const removeMovieFromHistory = async (id: string) => {
        if (!isAuthenticated) return false;
        setWatchedIds(prev => {
            const next = new Set(prev);
            next.delete(`movie:${id}`);
            next.delete(id);
            return next;
        });
        try {
            await TraktService.removeFromHistory({ movies: [createTraktId(id)] });
            debouncedSync();
            return true;
        } catch { return false; }
    };

    // Placeholder
    const markEpisodeAsWatched = async () => false;

    return (
        <TraktContext.Provider value={{
            isAuthenticated,
            isLoading,
            userProfile,
            watchedMovies: watchedMovies,
            watchedShows: watchedShows,
            watchlistMovies,
            watchlistShows,
            collectionMovies,
            collectionShows,
            continueWatching,
            ratedContent,
            checkAuthStatus,
            loadAllCollections,
            isMovieWatched,
            isEpisodeWatched,
            isInWatchlist,
            isInCollection,
            getUserRating,
            getWatchState,
            markMovieAsWatched,
            removeMovieFromHistory,
            markEpisodeAsWatched,
            addToWatchlist,
            removeFromWatchlist,
            addToCollection,
            removeFromCollection,
            rateContent,
            removeContentRating
        }}>
            {children}
        </TraktContext.Provider>
    );
}

export function useTraktContext() {
    const context = useContext(TraktContext);
    if (context === undefined) {
        throw new Error('useTraktContext must be used within a TraktProvider');
    }
    return context;
}
