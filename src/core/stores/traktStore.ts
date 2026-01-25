import { create } from 'zustand';
import { StorageService } from '../storage';

export interface TraktStoreState {
    // raw data
    watchlist: any[];
    collection: any[];
    continueWatching: any[];
    ratedContent: any[];
    watchedShowsRaw: any[];

    // Optimized Lookups (not persisted directly, hydrated from raw)
    watchlistIds: Set<string>;
    collectionIds: Set<string>;
    watchedIds: Set<string>;
    watchedEpisodeIds: Set<string>;

    isLoading: boolean;

    // Actions
    setWatchlist: (items: any[]) => void;
    setCollection: (items: any[]) => void;
    setContinueWatching: (items: any[]) => void;
    setRatedContent: (items: any[]) => void;
    setWatchedShowsRaw: (items: any[]) => void;
    setWatchedHistory: (items: any[]) => void;
    setIsLoading: (loading: boolean) => void;

    // Selectors
    isInWatchlist: (id?: string) => boolean;
    isInCollection: (id?: string) => boolean;
    isWatched: (id?: string) => boolean;
    isEpisodeWatched: (showId: string, season: number, episode: number) => boolean;

    // Hydration
    hydrate: () => void;
}

const buildIds = (items: any[]): Set<string> => {
    const ids = new Set<string>();
    items.forEach(item => {
        const media = item.movie || item.show || item.episode || item;
        const metaIds = media.ids || item.ids || {};
        if (metaIds.imdb) ids.add(`imdb:${metaIds.imdb}`);
        if (metaIds.tmdb) ids.add(`tmdb:${metaIds.tmdb}`);
        if (metaIds.trakt) ids.add(`trakt:${metaIds.trakt}`);
    });
    return ids;
};

const buildEpisodeIds = (shows: any[]): Set<string> => {
    const ids = new Set<string>();
    shows.forEach(show => {
        const showMeta = show.show || {};
        const showId = showMeta.ids?.imdb;
        if (showId && show.seasons) {
            show.seasons.forEach((season: any) => {
                season.episodes?.forEach((ep: any) => {
                    ids.add(`${showId}:${season.number}:${ep.number}`);
                });
            });
        }
    });
    return ids;
};

export const useTraktStore = create<TraktStoreState>((set, get) => ({
    watchlist: [],
    collection: [],
    continueWatching: [],
    ratedContent: [],
    watchedShowsRaw: [],
    watchlistIds: new Set(),
    collectionIds: new Set(),
    watchedIds: new Set(),
    watchedEpisodeIds: new Set(),
    isLoading: false,

    setWatchlist: (items) => {
        set({ watchlist: items, watchlistIds: buildIds(items) });
        StorageService.setUser('trakt-watchlist', items);
    },
    setCollection: (items) => {
        set({ collection: items, collectionIds: buildIds(items) });
        StorageService.setUser('trakt-collection', items);
    },
    setContinueWatching: (items) => {
        set({ continueWatching: items });
        StorageService.setUser('trakt-continue-watching', items);
    },
    setRatedContent: (items) => {
        set({ ratedContent: items });
        StorageService.setUser('trakt-rated-content', items);
    },
    setWatchedShowsRaw: (items) => {
        set({ watchedShowsRaw: items, watchedEpisodeIds: buildEpisodeIds(items) });
        StorageService.setUser('trakt-watched-shows-raw', items);
    },
    setWatchedHistory: (items) => {
        set({ watchedIds: buildIds(items) });
        StorageService.setUser('trakt-watched-history', items);
    },
    setIsLoading: (isLoading) => set({ isLoading }),

    isInWatchlist: (id) => id ? get().watchlistIds.has(id) : false,
    isInCollection: (id) => id ? get().collectionIds.has(id) : false,
    isWatched: (id) => id ? get().watchedIds.has(id) : false,
    isEpisodeWatched: (showId, season, episode) => get().watchedEpisodeIds.has(`${showId}:${season}:${episode}`),

    hydrate: () => {
        const watchlist = StorageService.getUser<any[]>('trakt-watchlist') || [];
        const collection = StorageService.getUser<any[]>('trakt-collection') || [];
        const continueWatching = StorageService.getUser<any[]>('trakt-continue-watching') || [];
        const ratedContent = StorageService.getUser<any[]>('trakt-rated-content') || [];
        const watchedShowsRaw = StorageService.getUser<any[]>('trakt-watched-shows-raw') || [];
        const watchedHistory = StorageService.getUser<any[]>('trakt-watched-history') || [];

        set({
            watchlist,
            collection,
            continueWatching,
            ratedContent,
            watchedShowsRaw,
            watchlistIds: buildIds(watchlist),
            collectionIds: buildIds(collection),
            watchedIds: buildIds(watchedHistory),
            watchedEpisodeIds: buildEpisodeIds(watchedShowsRaw),
        });
    }
}));
