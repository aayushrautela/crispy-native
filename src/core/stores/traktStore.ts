import { create } from 'zustand';
import { StorageService } from '../storage';
import { isStrictMediaId, makeEpisodeId, parseAppEpisodeSuffix, toStrictBaseMediaId, toStrictMediaId } from '../ids/mediaIds';

export interface TraktStoreState {
    // raw data
    watchlist: any[];
    collection: any[];
    continueWatching: any[];
    ratedContent: any[];
    watchedShowsRaw: any[];
    watchedHistory: any[]; // Expose raw movie history for optimistic updates
    recommendations: any[];

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
    setRecommendations: (items: any[]) => void;
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

        // Prefer canonical strict id when present.
        if (typeof media.id === 'string' && isStrictMediaId(media.id)) {
            ids.add(media.id);
            return;
        }
        if (typeof item.id === 'string' && isStrictMediaId(item.id)) {
            ids.add(item.id);
            return;
        }

        const mediaType = media.type || item.type;
        const appType = mediaType === 'show' || mediaType === 'series' ? 'series' : 'movie';

        const candidate =
            metaIds.imdb
                ? `imdb:${metaIds.imdb}`
                : metaIds.tmdb
                    ? `tmdb:${metaIds.tmdb}`
                    : metaIds.trakt
                        ? `trakt:${metaIds.trakt}`
                        : media.id;

        if (candidate) {
            const strict = toStrictMediaId(candidate, appType);
            if (strict) ids.add(toStrictBaseMediaId(strict, appType) || strict);
        }
    });
    return ids;
};

const buildEpisodeIds = (shows: any[]): Set<string> => {
    const ids = new Set<string>();
    shows.forEach(show => {
        const showMeta = show.show || {};
        const candidateShowId =
            showMeta.id ||
            (showMeta.ids?.imdb ? `imdb:${showMeta.ids.imdb}` : null) ||
            (showMeta.ids?.tmdb ? `tmdb:${showMeta.ids.tmdb}` : null) ||
            (showMeta.ids?.trakt ? `trakt:${showMeta.ids.trakt}` : null);

        const showId = candidateShowId ? toStrictBaseMediaId(candidateShowId, 'series') : null;
        if (showId && show.seasons) {
            show.seasons.forEach((season: any) => {
                season.episodes?.forEach((ep: any) => {
                    ids.add(makeEpisodeId(showId, season.number, ep.number));
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
    watchedHistory: [],
    recommendations: [],
    isLoading: false,

    setWatchlist: (items) => {
        set({ watchlist: items, watchlistIds: buildIds(items) });
        StorageService.setProfile('trakt-watchlist', items);
    },
    setCollection: (items) => {
        set({ collection: items, collectionIds: buildIds(items) });
        StorageService.setProfile('trakt-collection', items);
    },
    setContinueWatching: (items) => {
        set({ continueWatching: items });
        StorageService.setProfile('trakt-continue-watching', items);
    },
    setRatedContent: (items) => {
        set({ ratedContent: items });
        StorageService.setProfile('trakt-rated-content', items);
    },
    setWatchedShowsRaw: (items) => {
        set({ watchedShowsRaw: items, watchedEpisodeIds: buildEpisodeIds(items) });
        StorageService.setProfile('trakt-watched-shows-raw', items);
    },
    setWatchedHistory: (items) => {
        set({ watchedHistory: items, watchedIds: buildIds(items) });
        StorageService.setProfile('trakt-watched-history', items);
    },
    setRecommendations: (items) => {
        set({ recommendations: items });
        StorageService.setProfile('trakt-recommendations', items);
    },
    setIsLoading: (isLoading) => set({ isLoading }),

    isInWatchlist: (id) => {
        if (!id) return false;
        const parsed = parseAppEpisodeSuffix(id);
        const key = isStrictMediaId(parsed.baseId)
            ? parsed.baseId
            : toStrictBaseMediaId(id, 'movie') || toStrictBaseMediaId(id, 'series');
        return key ? get().watchlistIds.has(key) : false;
    },
    isInCollection: (id) => {
        if (!id) return false;
        const parsed = parseAppEpisodeSuffix(id);
        const key = isStrictMediaId(parsed.baseId)
            ? parsed.baseId
            : toStrictBaseMediaId(id, 'movie') || toStrictBaseMediaId(id, 'series');
        return key ? get().collectionIds.has(key) : false;
    },
    isWatched: (id) => {
        if (!id) return false;
        const parsed = parseAppEpisodeSuffix(id);
        const key = isStrictMediaId(parsed.baseId)
            ? parsed.baseId
            : toStrictBaseMediaId(id, 'movie') || toStrictBaseMediaId(id, 'series');
        return key ? get().watchedIds.has(key) : false;
    },
    isEpisodeWatched: (showId, season, episode) => {
        const parsed = parseAppEpisodeSuffix(showId);
        const key = isStrictMediaId(parsed.baseId) ? parsed.baseId : toStrictBaseMediaId(showId, 'series');
        if (!key) return false;
        return get().watchedEpisodeIds.has(makeEpisodeId(key, season, episode));
    },

    hydrate: () => {
        const watchlist = StorageService.getProfile<any[]>('trakt-watchlist') || [];
        const collection = StorageService.getProfile<any[]>('trakt-collection') || [];
        const continueWatching = StorageService.getProfile<any[]>('trakt-continue-watching') || [];
        const ratedContent = StorageService.getProfile<any[]>('trakt-rated-content') || [];
        const watchedShowsRaw = StorageService.getProfile<any[]>('trakt-watched-shows-raw') || [];
        const watchedHistory = StorageService.getProfile<any[]>('trakt-watched-history') || [];
        const recommendations = StorageService.getProfile<any[]>('trakt-recommendations') || [];

        set({
            watchlist,
            collection,
            continueWatching,
            ratedContent,
            watchedShowsRaw,
            recommendations,
            watchlistIds: buildIds(watchlist),
            collectionIds: buildIds(collection),
            watchedHistory,
            watchedIds: buildIds(watchedHistory),
            watchedEpisodeIds: buildEpisodeIds(watchedShowsRaw),
        });
    }
}));
