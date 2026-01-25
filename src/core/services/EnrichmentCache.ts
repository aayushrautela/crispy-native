import { MetaPreview } from './AddonService';

/**
 * A lightweight, in-memory LRU-like cache for enriched metadata.
 * This prevents double-fetching and double-rendering for items
 * that have already been seen in the current session.
 */
class EnrichmentCacheService {
    private cache = new Map<string, MetaPreview>();
    private pendingRequests = new Map<string, Promise<any>>();
    private readonly MAX_SIZE = 500; // Keep memory footprint managed

    /**
     * Generate a stable key for the item.
     * We favor TMDB ID, then IMDB ID, then Trakt ID.
     */
    public getKey(item: any): string | null {
        if (!item) return null;

        // If it's already a full MetaPreview with a unique ID, use that
        if (item.id && typeof item.id === 'string' && item.id.includes(':')) {
            return item.id;
        }

        const ids = item.ids || item.movie?.ids || item.show?.ids;
        if (!ids) return item.id ? String(item.id) : null;

        if (ids.tmdb) return `tmdb:${ids.tmdb}`;
        if (ids.imdb) return `imdb:${ids.imdb}`;
        if (ids.trakt) return `trakt:${ids.trakt}`;

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
