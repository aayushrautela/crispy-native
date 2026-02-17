import { MetaPreview } from '../types/stremio';
import { isStrictMediaId, parseAppEpisodeSuffix, toStrictMediaId } from '../ids/mediaIds';

/**
 * A lightweight, in-memory LRU-like cache for enriched metadata.
 * This prevents double-fetching and double-rendering for items
 * that have already been seen in the current session.
 */
class EnrichmentCacheService {
    private cache = new Map<string, MetaPreview>();
    private pendingRequests = new Map<string, Promise<any>>();
    private readonly MAX_SIZE = 500; // Keep memory footprint managed

    private toBaseKey(value: string): string {
        return parseAppEpisodeSuffix(value).baseId;
    }

    /**
     * Generate a stable key for the item.
     * We favor TMDB ID, then IMDB ID, then Trakt ID.
     */
    public getKey(item: any): string | null {
        if (!item) return null;

        // Prefer strict typed ids for collision-free caching.
        if (item.id && typeof item.id === 'string' && isStrictMediaId(item.id)) {
            return this.toBaseKey(item.id);
        }

        // If we have a legacy id + type, coerce to a strict typed key.
        if (item.id && (item.type || item.mediaType)) {
            const strict = toStrictMediaId(item.id, String(item.type || item.mediaType));
            if (strict) return this.toBaseKey(strict);
        }

        const isEpisode = item.season !== undefined && item.episodeNumber !== undefined;
        const ids = (isEpisode ? item.showIds : undefined) || item.ids || item.movie?.ids || item.show?.ids;
        if (!ids) return item.id ? this.toBaseKey(String(item.id)) : null;

        const type = item.type || item.mediaType || item.movie?.type || item.show?.type;
        if (ids.tmdb) {
            const strict = toStrictMediaId(`tmdb:${ids.tmdb}`, String(type || 'movie'));
            if (strict) return this.toBaseKey(strict);
        }
        if (ids.imdb) {
            const strict = toStrictMediaId(`imdb:${ids.imdb}`, String(type || 'movie'));
            if (strict) return this.toBaseKey(strict);
        }
        if (ids.trakt) {
            const strict = toStrictMediaId(`trakt:${ids.trakt}`, String(type || 'movie'));
            if (strict) return this.toBaseKey(strict);
        }

        return null;
    }

    public get(key: string): MetaPreview | undefined {
        return this.cache.get(key);
    }

    public set(key: string, data: MetaPreview) {
        if (this.cache.size >= this.MAX_SIZE) {
            // Simple eviction: delete the first (oldest) key
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }
        this.cache.set(key, data);
    }

    public has(key: string): boolean {
        return this.cache.has(key);
    }

    /**
     * Request deduplication helper.
     * If a fetch is already in progress for this key, return that promise.
     */
    public getOrFetch(key: string, fetcher: () => Promise<any>): Promise<any> {
        if (this.has(key)) {
            return Promise.resolve(this.get(key));
        }

        if (this.pendingRequests.has(key)) {
            return this.pendingRequests.get(key)!;
        }

        const promise = fetcher().finally(() => {
            this.pendingRequests.delete(key);
        });

        this.pendingRequests.set(key, promise);

        return promise;
    }
}

export const EnrichmentCache = new EnrichmentCacheService();
