import { useTraktStore } from '@/src/core/stores/traktStore';
import { useUserStore } from '@/src/core/stores/userStore';
import { isStrictMediaId, parseAppEpisodeSuffix, toStrictBaseMediaId, toStrictMediaId } from '@/src/core/ids/mediaIds';
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
    isMovieWatched: (id: string) => boolean;
    isEpisodeWatched: (showId: string, season: number, episode: number) => boolean;
    isInWatchlist: (id: string, type: 'movie' | 'series') => boolean;
    isInCollection: (id: string, type: 'movie' | 'series') => boolean;
    getUserRating: (id: string, type: 'movie' | 'series') => number | null;
    getWatchState: (id: string, type: 'movie' | 'series') => { state: 'watch' | 'continue' | 'rewatch'; progress?: number; episode?: any };

    // Write Actions
    markMovieAsWatched: (id: string, watchedAt?: Date) => Promise<boolean>;
    removeMovieFromHistory: (id: string) => Promise<boolean>;
    markEpisodeAsWatched: (showId: string, season: number, episode: number, watchedAt?: Date) => Promise<boolean>;
    addToWatchlist: (id: string, type: 'movie' | 'series') => Promise<boolean>;
    removeFromWatchlist: (id: string, type: 'movie' | 'series') => Promise<boolean>;
    addToCollection: (id: string, type: 'movie' | 'series') => Promise<boolean>;
    removeFromCollection: (id: string, type: 'movie' | 'series') => Promise<boolean>;
    rateContent: (id: string, type: 'movie' | 'series' | 'episode', rating: number) => Promise<boolean>;
    removeContentRating: (id: string, type: 'movie' | 'series' | 'episode') => Promise<boolean>;
    
    // Scrobble
    scrobble: (action: 'start' | 'pause' | 'stop', id: string, type: 'movie' | 'series', progress: number, season?: number, episode?: number) => Promise<any>;
}

const TraktContext = createContext<TraktContextProps | undefined>(undefined);

export function TraktProvider({ children }: { children: ReactNode }) {
    const traktAuth = useUserStore((state) => state.traktAuth);
    const isAuthenticated = !!traktAuth.accessToken;
    const [userProfile, setUserProfile] = useState<TraktUser | null>(null);

    // Consume Zustand Store
    const store = useTraktStore();
    const {
        watchlist,
        collection,
        continueWatching,
        ratedContent,
        watchedShowsRaw,
        watchedHistory,
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
    const watchedMovies = watchedHistory as TraktWatchedMovie[];
    const watchedShows = watchedShowsRaw as TraktWatchedShow[];

    const checkAuthStatus = useCallback(async () => {
        // user profile fetching could be added to TraktService if needed
        // For now just relies on store token presence
    }, []);

    const loadAllCollections = useCallback(async (force = false) => {
        if (!isAuthenticated) return;
        setIsLoading(true);
        try {
            const [w, c, p, r, watchedShowsRaw, rec, profile] = await Promise.all([
                TraktService.getWatchlist(),
                TraktService.getCollection(),
                TraktService.getContinueWatching(),
                TraktService.getRated(),
                TraktService.getWatchedShows(),
                TraktService.getMixedRecommendations(20),
                TraktService.getInstance().getUserProfile()
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
            if (profile) setUserProfile(profile as TraktUser);

        } catch (e) {
            console.error('Failed to load Trakt collections', e);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, setIsLoading, setWatchlist, setCollection, setContinueWatching, setRatedContent, setWatchedShowsRaw, setWatchedHistory, setRecommendations]);

    // Initial Load & Hydration
    useEffect(() => {
        hydrate(); // Load from MMKV immediately
        if (isAuthenticated) {
            loadAllCollections();
        }
    }, [isAuthenticated, hydrate, loadAllCollections]);

    // Debounced Sync
    const debouncedSync = useMemo(
        () => debounce(() => {
            loadAllCollections(true);
        }, 2000),
        [loadAllCollections]
    );



    const toStrictKey = useCallback((id: string, typeHint?: 'movie' | 'series'): string | null => {
        const parsed = parseAppEpisodeSuffix(id);
        if (isStrictMediaId(parsed.baseId)) return parsed.baseId;

        if (typeHint) {
            return toStrictBaseMediaId(id, typeHint) || null;
        }
        return toStrictBaseMediaId(id, 'movie') || toStrictBaseMediaId(id, 'series');
    }, []);

    const getItemKey = useCallback((item: any): string | null => {
        const media = item?.movie || item?.show || item?.episode || item;
        const candidate = media?.id || item?.id
            || (media?.ids?.imdb ? `imdb:${media.ids.imdb}` : null)
            || (media?.ids?.tmdb ? `tmdb:${media.ids.tmdb}` : null)
            || (media?.ids?.trakt ? `trakt:${media.ids.trakt}` : null)
            || (item?.ids?.imdb ? `imdb:${item.ids.imdb}` : null)
            || (item?.ids?.tmdb ? `tmdb:${item.ids.tmdb}` : null)
            || (item?.ids?.trakt ? `trakt:${item.ids.trakt}` : null);

        if (!candidate) return null;
        const parsed = parseAppEpisodeSuffix(String(candidate));
        if (typeof candidate === 'string' && isStrictMediaId(parsed.baseId)) return parsed.baseId;
        return toStrictBaseMediaId(String(candidate), 'movie') || toStrictBaseMediaId(String(candidate), 'series');
    }, []);

    // --- Status Checks ---

    const isMovieWatched = useCallback((id: string) => {
        return storeIsWatched(id);
    }, [storeIsWatched]);

    const isEpisodeWatched = useCallback((showId: string, season: number, episode: number) => {
        return storeIsEpisodeWatched(showId, season, episode);
    }, [storeIsEpisodeWatched]);

    const isInWatchlist = useCallback((id: string, _type: 'movie' | 'series') => {
        return storeIsInWatchlist(id);
    }, [storeIsInWatchlist]);

    const isInCollection = useCallback((id: string, _type: 'movie' | 'series') => {
        return storeIsInCollection(id);
    }, [storeIsInCollection]);

    const getUserRating = useCallback((id: string, type: 'movie' | 'series'): number | null => {
        const targetKey = toStrictKey(id, type);
        if (!targetKey) return null;

        const item = ratedContent.find(r => {
            const media = type === 'movie' ? r.movie : r.show;
            const key = getItemKey(media || r);
            return !!key && key === targetKey;
        });

        return item ? Math.round(item.rating / 2) : null; // 10 -> 5 scale
    }, [getItemKey, ratedContent, toStrictKey]);

    const getWatchState = useCallback((id: string, type: 'movie' | 'series') => {
        const targetKey = toStrictKey(id, type);
        if (!targetKey) return { state: 'watch' as const };

        const playbackItem = continueWatching.find(item => {
            const media = item.movie || item.show;
            const key = getItemKey(media || item);
            return !!key && key === targetKey;
        });

        if (playbackItem) {
            return {
                state: 'continue' as const,
                progress: playbackItem.progress,
                episode: playbackItem.episode
            };
        }

        if (type === 'movie' && isMovieWatched(targetKey)) {
            return { state: 'rewatch' as const };
        }

        return { state: 'watch' as const };
    }, [continueWatching, getItemKey, isMovieWatched, toStrictKey]);


    // --- Actions ---

    // --- Actions ---

    const addToWatchlist = useCallback(async (id: string, type: 'movie' | 'series') => {
        const serviceType = type === 'series' ? 'show' : 'movie';
        if (!isAuthenticated) return false;

        const strictBaseId = toStrictKey(id, type);
        if (!strictBaseId) {
            console.warn('[TraktContext] Invalid id for addToWatchlist', { id, type });
            return false;
        }

        // Optimistic Add
        const optimisticItem: any = {
            id: strictBaseId,
            type: serviceType,
            movie: type === 'movie' ? {
                id: strictBaseId,
                ids: {},
                title: ''
            } : undefined,
            show: type === 'series' ? {
                id: strictBaseId,
                ids: {},
                title: ''
            } : undefined,
            listed_at: new Date().toISOString()
        };

        setWatchlist([...watchlist, optimisticItem]);

        const success = await TraktService.addToWatchlist(strictBaseId, serviceType);
        if (success) {
            debouncedSync();
            return true;
        } else {
            // Revert on failure
            setWatchlist(watchlist); // Reset to previous state handled by closure
            return false;
        }
    }, [isAuthenticated, debouncedSync, setWatchlist, toStrictKey, watchlist]);

    const removeFromWatchlist = useCallback(async (id: string, type: 'movie' | 'series') => {
        const serviceType = type === 'series' ? 'show' : 'movie';
        if (!isAuthenticated) return false;

        const strictBaseId = toStrictKey(id, type);
        if (!strictBaseId) {
            console.warn('[TraktContext] Invalid id for removeFromWatchlist', { id, type });
            return false;
        }

        // Optimistic Remove
        setWatchlist(watchlist.filter(i => getItemKey(i) !== strictBaseId));

        const success = await TraktService.removeFromWatchlist(strictBaseId, serviceType);
        if (success) {
            debouncedSync();
            return true;
        } else {
            // Revert on failure (complex to restore exact state without deep copy, but sync will fix it)
            debouncedSync();
            return false;
        }
    }, [getItemKey, isAuthenticated, debouncedSync, setWatchlist, toStrictKey, watchlist]);

    const addToCollection = useCallback(async (id: string, type: 'movie' | 'series') => {
        const serviceType = type === 'series' ? 'show' : 'movie';
        if (!isAuthenticated) return false;

        const strictBaseId = toStrictKey(id, type);
        if (!strictBaseId) {
            console.warn('[TraktContext] Invalid id for addToCollection', { id, type });
            return false;
        }

        // Optimistic Add
        const optimisticItem: any = {
            id: strictBaseId,
            type: serviceType,
            movie: type === 'movie' ? {
                id: strictBaseId,
                ids: {},
                title: ''
            } : undefined,
            show: type === 'series' ? {
                id: strictBaseId,
                ids: {},
                title: ''
            } : undefined,
            collected_at: new Date().toISOString()
        };

        setCollection([...collection, optimisticItem]);

        const success = await TraktService.addToCollection(strictBaseId, serviceType);
        if (success) {
            debouncedSync();
            return true;
        } else {
            setCollection(collection);
            return false;
        }
    }, [isAuthenticated, debouncedSync, collection, setCollection, toStrictKey]);

    const removeFromCollection = useCallback(async (id: string, type: 'movie' | 'series') => {
        const serviceType = type === 'series' ? 'show' : 'movie';
        if (!isAuthenticated) return false;

        const strictBaseId = toStrictKey(id, type);
        if (!strictBaseId) {
            console.warn('[TraktContext] Invalid id for removeFromCollection', { id, type });
            return false;
        }

        // Optimistic Remove
        setCollection(collection.filter(i => getItemKey(i) !== strictBaseId));

        const success = await TraktService.removeFromCollection(strictBaseId, serviceType);
        if (success) {
            debouncedSync();
            return true;
        } else {
            debouncedSync();
            return false;
        }
    }, [collection, debouncedSync, getItemKey, isAuthenticated, setCollection, toStrictKey]);

    const rateContent = useCallback(async (id: string, type: 'movie' | 'series' | 'episode', rating: number) => {
        if (!isAuthenticated) return false;

        const serviceType = type === 'series' ? 'show' : type;
        const traktRating = rating * 2; // 5 -> 10 scale

        const strictId = type === 'episode'
            ? toStrictMediaId(id, 'series')
            : toStrictKey(id, type);

        if (!strictId) {
            console.warn('[TraktContext] Invalid id for rateContent', { id, type });
            return false;
        }

        // Optimistic Update
        const optimisticItem: TraktRatingItem = {
            rating: traktRating,
            rated_at: new Date().toISOString(),
            type: serviceType,
            // Minimal optimistic object
            movie: type === 'movie' ? { id: strictId, ids: {}, title: '' } as any : undefined,
            show: type === 'series' ? { id: strictId, ids: {}, title: '' } as any : undefined,
        };

        const newContent = ratedContent.filter(r => getItemKey((type === 'movie' ? r.movie : r.show) || r) !== strictId);
        
        setRatedContent([...newContent, optimisticItem]);

        const success = await TraktService.addRating(strictId, serviceType, rating);
        if (success) {
            debouncedSync();
            return true;
        } else {
            return false;
        }
    }, [debouncedSync, getItemKey, isAuthenticated, ratedContent, setRatedContent, toStrictKey]);

    const removeContentRating = useCallback(async (id: string, type: 'movie' | 'series' | 'episode') => {
        if (!isAuthenticated) return false;

        const serviceType = type === 'series' ? 'show' : type;

        const strictId = type === 'episode'
            ? toStrictMediaId(id, 'series')
            : toStrictKey(id, type);

        if (!strictId) {
            console.warn('[TraktContext] Invalid id for removeContentRating', { id, type });
            return false;
        }

        const newContent = ratedContent.filter(r => getItemKey((type === 'movie' ? r.movie : r.show) || r) !== strictId);
        setRatedContent(newContent);

        const success = await TraktService.removeRating(strictId, serviceType);
        if (success) {
            debouncedSync();
            return true;
        } else {
            return false;
        }
    }, [debouncedSync, getItemKey, isAuthenticated, ratedContent, setRatedContent, toStrictKey]);

    const scrobble = useCallback(async (action: 'start' | 'pause' | 'stop', id: string, type: 'movie' | 'series', progress: number, season?: number, episode?: number) => {
        if (!isAuthenticated) return null;
        return TraktService.getInstance().scrobble(action, id, type, progress, season, episode);
    }, [isAuthenticated]);

    const markMovieAsWatched = useCallback(async (id: string) => {
        if (!isAuthenticated) return false;

        const strictBaseId = toStrictKey(id, 'movie');
        if (!strictBaseId) {
            console.warn('[TraktContext] Invalid id for markMovieAsWatched', { id });
            return false;
        }

        // Optimistic Add
        const optimisticItem: any = {
            id: strictBaseId,
            type: 'movie',
            movie: {
                id: strictBaseId,
                ids: {},
                title: ''
            },
            watched_at: new Date().toISOString()
        };

        const previousHistory = watchedHistory;
        setWatchedHistory([...previousHistory, optimisticItem]);

        const success = await TraktService.addToHistory(strictBaseId, 'movie');
        if (success) {
            debouncedSync();
            return true;
        }

        setWatchedHistory(previousHistory);
        return false;
    }, [isAuthenticated, debouncedSync, setWatchedHistory, toStrictKey, watchedHistory]);

    const removeMovieFromHistory = useCallback(async (id: string) => {
        if (!isAuthenticated) return false;

        const strictBaseId = toStrictKey(id, 'movie');
        if (!strictBaseId) {
            console.warn('[TraktContext] Invalid id for removeMovieFromHistory', { id });
            return false;
        }

        const success = await TraktService.removeFromHistory(strictBaseId, 'movie');
        if (success) {
            debouncedSync();
            return true;
        } else {
            return false;
        }
    }, [isAuthenticated, debouncedSync, toStrictKey]);

    const markEpisodeAsWatched = useCallback(async (showId: string, season: number, episode: number) => {
        if (!isAuthenticated) return false;

        const strictShowId = toStrictKey(showId, 'series');
        if (!strictShowId) {
            console.warn('[TraktContext] Invalid show id for markEpisodeAsWatched', { showId, season, episode });
            return false;
        }

        const success = await TraktService.addEpisodeToHistory(strictShowId, season, episode);
        if (success) {
            debouncedSync();
            return true;
        }
        return false;
    }, [debouncedSync, isAuthenticated, toStrictKey]);

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
        scrobble,
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
        scrobble,
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
