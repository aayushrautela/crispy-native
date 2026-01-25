import { useTraktStore } from '@/src/core/stores/traktStore';
import { useUserStore } from '@/src/core/stores/userStore';
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
} from '../../../core/services/trakt-types';
import { TraktService } from '../../../core/services/TraktService';

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
    recommendations: any[];

    // Actions
    checkAuthStatus: () => Promise<void>;
    loadAllCollections: (force?: boolean) => Promise<void>;

    // Status Checks
    isMovieWatched: (imdbId: string) => boolean;
    isEpisodeWatched: (imdbId: string, season: number, episode: number) => boolean;
    isInWatchlist: (imdbId: string, type: 'movie' | 'series') => boolean;
    isInCollection: (imdbId: string, type: 'movie' | 'series') => boolean;
    getUserRating: (imdbId: string, type: 'movie' | 'series') => number | null;
    getWatchState: (imdbId: string, type: 'movie' | 'series') => { state: 'watch' | 'continue' | 'rewatch'; progress?: number; episode?: any };

    // Write Actions
    markMovieAsWatched: (imdbId: string, watchedAt?: Date) => Promise<boolean>;
    removeMovieFromHistory: (imdbId: string) => Promise<boolean>;
    markEpisodeAsWatched: (imdbId: string, season: number, episode: number, watchedAt?: Date) => Promise<boolean>;
    addToWatchlist: (imdbId: string, type: 'movie' | 'series') => Promise<boolean>;
    removeFromWatchlist: (imdbId: string, type: 'movie' | 'series') => Promise<boolean>;
    addToCollection: (imdbId: string, type: 'movie' | 'series') => Promise<boolean>;
    removeFromCollection: (imdbId: string, type: 'movie' | 'series') => Promise<boolean>;
    rateContent: (imdbId: string, type: 'movie' | 'series' | 'episode', rating: number) => Promise<boolean>;
    removeContentRating: (imdbId: string, type: 'movie' | 'series' | 'episode') => Promise<boolean>;
}

const TraktContext = createContext<TraktContextProps | undefined>(undefined);

export function TraktProvider({ children }: { children: ReactNode }) {
    const { traktAuth } = useUserStore();
    const isAuthenticated = !!traktAuth.accessToken;
    const [userProfile, setUserProfile] = useState<TraktUser | null>(null);

    // Consume Zustand Store
    const store = useTraktStore();
    const {
        watchlist,
        collection,
        continueWatching,
        ratedContent,
        isLoading,
        setIsLoading,
        setWatchlist,
        setCollection,
        setContinueWatching,
        setRatedContent,
        setWatchedShowsRaw,
        setWatchedHistory,
        recommendations,
        setRecommendations,
        hydrate,
        isInWatchlist: storeIsInWatchlist,
        isInCollection: storeIsInCollection,
        isWatched: storeIsWatched,
        isEpisodeWatched: storeIsEpisodeWatched
    } = store;

    // Derived Lists for specific Types (matching webui interface)
    const watchlistMovies = useMemo(() => watchlist.filter(i => i.type === 'movie').map(i => ({ ...i, movie: i.movie, type: 'movie' } as any)), [watchlist]); // Cast as any because PlaybackItem != WatchlistItem exactly, but close enough for UI
    const watchlistShows = useMemo(() => watchlist.filter(i => i.type === 'episode' || i.show).map(i => ({ ...i, show: i.show, type: 'show' } as any)), [watchlist]);

    const collectionMovies = useMemo(() => collection.filter(i => i.type === 'movie').map(i => ({ ...i, movie: i.movie, type: 'movie' } as any)), [collection]);
    const collectionShows = useMemo(() => collection.filter(i => i.type === 'episode' || i.show).map(i => ({ ...i, show: i.show, type: 'show' } as any)), [collection]);

    // Compatibility for legacy types
    const watchedMovies: TraktWatchedMovie[] = [];
    const watchedShows: TraktWatchedShow[] = [];

    const checkAuthStatus = useCallback(async () => {
        // user profile fetching could be added to TraktService if needed
        // For now just relies on store token presence
    }, []);

    const loadAllCollections = useCallback(async (force = false) => {
        if (!isAuthenticated) return;
        setIsLoading(true);
        try {
            const [w, c, p, r, watchedShowsRaw] = await Promise.all([
                TraktService.getWatchlist(),
                TraktService.getCollection(),
                TraktService.getContinueWatching(),
                TraktService.getRated(),
                TraktService.getWatchedShows(),
                TraktService.getMixedRecommendations(20)
            ]);

            const h = await TraktService.getWatched();

            // Atomic Store Updates
            setWatchlist(w || []);
            setCollection(c || []);
            setContinueWatching(p || []);
            setRatedContent(r || []);
            setWatchedShowsRaw(watchedShowsRaw || []);
            setWatchedHistory(h || []);
            setRecommendations(rec || []);

        } catch (e) {
            console.error('Failed to load Trakt collections', e);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, setIsLoading, setWatchlist, setCollection, setContinueWatching, setRatedContent, setWatchedShowsRaw, setWatchedHistory]);

    // Initial Load & Hydration
    useEffect(() => {
        hydrate(); // Load from MMKV immediately
        if (isAuthenticated) {
            loadAllCollections();
        }
    }, [isAuthenticated, hydrate]);

    // Debounced Sync
    const debouncedSync = useMemo(
        () => debounce(() => {
            loadAllCollections(true);
        }, 2000),
        [loadAllCollections]
    );



    // --- Status Checks ---

    const isMovieWatched = useCallback((imdbId: string) => {
        return storeIsWatched(`imdb:${imdbId}`) || storeIsWatched(imdbId);
    }, [storeIsWatched]);

    const isEpisodeWatched = useCallback((imdbId: string, season: number, episode: number) => {
        return storeIsEpisodeWatched(imdbId, season, episode);
    }, [storeIsEpisodeWatched]);

    const isInWatchlist = useCallback((id: string | number, type: 'movie' | 'series') => {
        const idStr = String(id);
        if (idStr.startsWith('tt')) return storeIsInWatchlist(`imdb:${idStr}`);
        if (idStr.startsWith('tmdb:')) return storeIsInWatchlist(`tmdb:${idStr.replace('tmdb:', '')}`);
        if (idStr.startsWith('trakt:')) return storeIsInWatchlist(`trakt:${idStr.replace('trakt:', '')}`);
        return storeIsInWatchlist(`${type}:${idStr}`) || storeIsInWatchlist(idStr);
    }, [storeIsInWatchlist]);

    const isInCollection = useCallback((id: string | number, type: 'movie' | 'series') => {
        const idStr = String(id);
        if (idStr.startsWith('tt')) return storeIsInCollection(`imdb:${idStr}`);
        if (idStr.startsWith('tmdb:')) return storeIsInCollection(`tmdb:${idStr.replace('tmdb:', '')}`);
        if (idStr.startsWith('trakt:')) return storeIsInCollection(`trakt:${idStr.replace('trakt:', '')}`);
        return storeIsInCollection(`${type}:${idStr}`) || storeIsInCollection(idStr);
    }, [storeIsInCollection]);

    const getUserRating = useCallback((id: string | number, type: 'movie' | 'series'): number | null => {
        const idStr = String(id);
        const item = ratedContent.find(r => {
            const media = type === 'movie' ? r.movie : r.show;
            if (!media) return false;

            // Fast match via Universal IDs
            if (idStr.startsWith('tt')) return media.ids.imdb === idStr;
            if (idStr.startsWith('tmdb:')) return media.ids.tmdb === parseInt(idStr.replace('tmdb:', ''), 10);
            if (idStr.startsWith('trakt:')) return media.ids.trakt === parseInt(idStr.replace('trakt:', ''), 10);

            // Raw numeric check
            return media.ids.tmdb === parseInt(idStr, 10) || media.ids.trakt === parseInt(idStr, 10);
        });
        return item ? Math.round(item.rating / 2) : null; // 10 -> 5 scale
    }, [ratedContent]);

    const getWatchState = useCallback((id: string | number, type: 'movie' | 'series') => {
        const idStr = String(id);
        // 1. Check Continue Watching
        const playbackItem = continueWatching.find(item => {
            const media = item.movie || item.show;
            if (!media) return false;

            if (idStr.startsWith('tt')) return media.ids.imdb === idStr;
            if (idStr.startsWith('tmdb:')) return media.ids.tmdb === parseInt(idStr.replace('tmdb:', ''), 10);
            if (idStr.startsWith('trakt:')) return media.ids.trakt === parseInt(idStr.replace('trakt:', ''), 10);

            return media.ids.tmdb === parseInt(idStr, 10) || media.ids.trakt === parseInt(idStr, 10);
        });

        if (playbackItem) {
            return {
                state: 'continue' as const,
                progress: playbackItem.progress,
                episode: playbackItem.episode
            };
        }

        // 2. Check Watched
        if (isMovieWatched(idStr)) {
            return { state: 'rewatch' as const };
        }

        return { state: 'watch' as const };
    }, [continueWatching, isMovieWatched]);


    // --- Actions ---

    // --- Actions ---

    const addToWatchlist = useCallback(async (id: string, type: 'movie' | 'show') => {
        if (!isAuthenticated) return false;

        const success = await TraktService.addToWatchlist(id, type);
        if (success) {
            debouncedSync();
            return true;
        } else {
            return false;
        }
    }, [isAuthenticated, debouncedSync]);

    const removeFromWatchlist = useCallback(async (id: string, type: 'movie' | 'show') => {
        if (!isAuthenticated) return false;

        const success = await TraktService.removeFromWatchlist(id, type);
        if (success) {
            debouncedSync();
            return true;
        } else {
            return false;
        }
    }, [isAuthenticated, debouncedSync]);

    const addToCollection = useCallback(async (id: string, type: 'movie' | 'show') => {
        if (!isAuthenticated) return false;

        const success = await TraktService.addToCollection(id, type);
        if (success) {
            debouncedSync();
            return true;
        } else {
            return false;
        }
    }, [isAuthenticated, debouncedSync]);

    const removeFromCollection = useCallback(async (id: string, type: 'movie' | 'show') => {
        if (!isAuthenticated) return false;

        const success = await TraktService.removeFromCollection(id, type);
        if (success) {
            debouncedSync();
            return true;
        } else {
            return false;
        }
    }, [isAuthenticated, debouncedSync]);

    const rateContent = useCallback(async (id: string, type: 'movie' | 'show' | 'episode', rating: number) => {
        if (!isAuthenticated) return false;

        const traktRating = rating * 2; // 5 -> 10 scale

        // Optimistic Update
        const optimisticItem: TraktRatingItem = {
            rating: traktRating,
            rated_at: new Date().toISOString(),
            type: type,
            // Minimal optimistic object
            movie: type === 'movie' ? { ids: { imdb: id } as any, title: '' } as any : undefined,
            show: type === 'show' ? { ids: { imdb: id } as any, title: '' } as any : undefined,
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

        const success = await TraktService.addRating(id, type, rating);
        if (success) {
            debouncedSync();
            return true;
        } else {
            return false;
        }
    }, [isAuthenticated, debouncedSync]);

    const removeContentRating = useCallback(async (id: string, type: 'movie' | 'show' | 'episode') => {
        if (!isAuthenticated) return false;

        setRatedContent(prev => {
            return prev.filter(r => {
                const media = type === 'movie' ? r.movie : r.show;
                if (!media) return true;
                if (id.startsWith('tt')) return media.ids.imdb !== id;
                return media.ids.tmdb !== parseInt(id, 10);
            });
        });

        const success = await TraktService.removeRating(id, type);
        if (success) {
            debouncedSync();
            return true;
        } else {
            return false;
        }
    }, [isAuthenticated, debouncedSync]);

    const markMovieAsWatched = useCallback(async (id: string) => {
        if (!isAuthenticated) return false;

        const success = await TraktService.addToHistory(id, 'movie');
        if (success) {
            debouncedSync();
            return true;
        } else {
            return false;
        }
    }, [isAuthenticated, debouncedSync]);

    const removeMovieFromHistory = useCallback(async (id: string) => {
        if (!isAuthenticated) return false;

        const success = await TraktService.removeFromHistory(id, 'movie');
        if (success) {
            debouncedSync();
            return true;
        } else {
            return false;
        }
    }, [isAuthenticated, debouncedSync]);

    // Placeholder
    const markEpisodeAsWatched = useCallback(async () => false, []);

    const contextValue = useMemo(() => ({
        isAuthenticated,
        isLoading,
        userProfile,
        watchedMovies,
        watchedShows,
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
        removeContentRating,
        recommendations
    }), [
        isAuthenticated,
        isLoading,
        userProfile,
        watchedMovies,
        watchedShows,
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
        removeContentRating,
        recommendations
    ]);

    return (
        <TraktContext.Provider value={contextValue}>
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
