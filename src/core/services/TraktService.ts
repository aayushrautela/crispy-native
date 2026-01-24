import { useUserStore } from '../stores/userStore';
import {
    TraktCollectionItem,
    TraktDeviceCodeResponse,
    TraktPlaybackItem,
    TraktRatingItem,
    TraktSyncResponse,
    TraktTokenResponse,
    TraktWatchedMovie,
    TraktWatchedShow,
    TraktWatchlistItem
} from './trakt-types';

const TRAKT_API_BASE = 'https://api.trakt.tv';
const TRAKT_CLIENT_ID = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID || 'd69e855c94e09d57a66164f9b889370773d226a267d344ad161b979f454792eb'; // Fallback or Env

export class TraktService {

    private static get auth() {
        return useUserStore.getState().traktAuth;
    }

    private static get headers() {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'trakt-api-version': '2',
            'trakt-api-key': TRAKT_CLIENT_ID,
        };
        const token = this.auth?.accessToken;
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    // --- Auth ---

    static async oauthDeviceCode(): Promise<TraktDeviceCodeResponse> {
        const res = await fetch(`${TRAKT_API_BASE}/oauth/device/code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: TRAKT_CLIENT_ID }),
        });
        if (!res.ok) throw new Error('Failed to get device code');
        return await res.json();
    }

    static async oauthToken(deviceCode: string): Promise<TraktTokenResponse> {
        const res = await fetch(`${TRAKT_API_BASE}/oauth/device/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: deviceCode,
                client_id: TRAKT_CLIENT_ID,
                client_secret: process.env.EXPO_PUBLIC_TRAKT_CLIENT_SECRET, // Make sure this is set or handled securely?
                // Note: Trakt Device flow usually requires secret? 
                // WebUI worker/trakt.ts uses `this.clientSecret` which comes from config. 
                // Native app cannot safely store secret. 
                // Trakt for specialized apps might allow secret-less or we must use a proxy.
                // Assuming standard public client for now, but checking WebUI...
                // WebUI has `clientSecret` optional in types but uses it in `oauthToken`.
            }),
        });

        // Handle pending/slow_down
        if (res.status === 400 || res.status === 429) {
            // Let the UI handle polling logic/errors
            throw new Error((await res.json())?.message || 'Pending');
        }

        if (!res.ok) throw new Error('Failed to get token');

        const data = await res.json();
        // Update Store
        useUserStore.getState().updateTraktAuth({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + (data.expires_in * 1000),
        });

        return data;
    }

    // --- Logic ---

    // Ported from WebUI: processContinueWatching
    static async getContinueWatching(): Promise<TraktPlaybackItem[]> {
        if (!this.auth.accessToken) return [];

        try {
            const playbackRes = await fetch(`${TRAKT_API_BASE}/sync/playback?extended=images&limit=50`, { headers: this.headers });
            const playbackItems: TraktPlaybackItem[] = await playbackRes.json();

            const watchedRes = await fetch(`${TRAKT_API_BASE}/sync/watched/shows`, { headers: this.headers });
            const watchedShows: any[] = await watchedRes.json();

            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const resultItems: TraktPlaybackItem[] = [];

            // Process playback items
            playbackItems.forEach(item => {
                if (item.progress < 2) return;
                const pausedAt = new Date(item.paused_at).getTime();
                if (pausedAt < thirtyDaysAgo) return;

                const type = item.type;
                const media = type === 'movie' ? item.movie : item.show;
                if (!media) return;

                resultItems.push(this.hydrateLibraryItem(item, item.paused_at));
            });

            // Process watched shows (Up Next placeholder)
            // Note: In the new architecture, "Up Next" logic should be shifted to a dedicated hook/service
            // that combines Trakt history with TMDB schedule data.
            // For now, we return raw playback items only or simplified watched status.

            return resultItems.sort((a, b) => new Date(b.paused_at).getTime() - new Date(a.paused_at).getTime());
        } catch (e) {
            console.error('Trakt getContinueWatching error', e);
            return [];
        }
    }


    // --- Library Fetchers ---

    static async getWatchlist(): Promise<TraktPlaybackItem[]> {
        if (!this.auth.accessToken) return [];
        try {
            const res = await fetch(`${TRAKT_API_BASE}/sync/watchlist?extended=images,full`, { headers: this.headers });
            const items: TraktWatchlistItem[] = await res.json();
            return items.map(item => this.hydrateLibraryItem(item, item.listed_at));
        } catch (e) {
            console.error('Trakt getWatchlist error', e);
            return [];
        }
    }

    static async getWatchedShows(): Promise<TraktWatchedShow[]> {
        if (!this.auth.accessToken) return [];
        try {
            const res = await fetch(`${TRAKT_API_BASE}/sync/watched/shows?extended=images,full`, { headers: this.headers });
            return await res.json();
        } catch (e) {
            console.error('Trakt getWatchedShows error', e);
            return [];
        }
    }

    static async getWatched(): Promise<TraktPlaybackItem[]> {
        if (!this.auth.accessToken) return [];
        try {
            const movieRes = await fetch(`${TRAKT_API_BASE}/sync/watched/movies?extended=images,full`, { headers: this.headers });
            const movies: TraktWatchedMovie[] = await movieRes.json();

            const showRes = await fetch(`${TRAKT_API_BASE}/sync/watched/shows?extended=images,full`, { headers: this.headers });
            const shows: TraktWatchedShow[] = await showRes.json();

            const items = [
                ...movies.map(m => ({ movie: m.movie, type: 'movie' as const, paused_at: m.last_watched_at })),
                ...shows.map(s => ({ show: s.show, type: 'episode' as const, paused_at: s.last_watched_at }))
            ];

            return items.map(item => this.hydrateLibraryItem(item, item.paused_at));
        } catch (e) {
            console.error('Trakt getWatched error', e);
            return [];
        }
    }

    static async getCollection(): Promise<TraktPlaybackItem[]> {
        if (!this.auth.accessToken) return [];
        try {
            const res = await fetch(`${TRAKT_API_BASE}/sync/collection/movies?extended=images,full`, { headers: this.headers });
            const movies: TraktCollectionItem[] = await res.json();

            const showRes = await fetch(`${TRAKT_API_BASE}/sync/collection/shows?extended=images,full`, { headers: this.headers });
            const shows: TraktCollectionItem[] = await showRes.json();

            const items = [
                ...movies.map(m => ({ movie: m.movie, type: 'movie' as const, paused_at: m.collected_at })),
                ...shows.map(s => ({ show: s.show, type: 'episode' as const, paused_at: s.last_collected_at || s.collected_at }))
            ];

            return items.map(item => this.hydrateLibraryItem(item, item.paused_at));
        } catch (e) {
            console.error('Trakt getCollection error', e);
            return [];
        }
    }

    static async getRated(): Promise<TraktPlaybackItem[]> {
        if (!this.auth.accessToken) return [];
        try {
            const res = await fetch(`${TRAKT_API_BASE}/sync/ratings?extended=images,full`, { headers: this.headers });
            const items: TraktRatingItem[] = await res.json();
            return items.map(item => this.hydrateLibraryItem(item, item.rated_at));
        } catch (e) {
            console.error('Trakt getRated error', e);
            return [];
        }
    }

    static async getComments(
        type: 'movie' | 'show' | 'season' | 'episode',
        id: string,
        params?: { season?: number; episode?: number; page?: number; limit?: number }
    ): Promise<TraktContentComment[]> {
        const { season, episode, page = 1, limit = 10 } = params || {};
        let endpoint = '';

        const cleanId = id.startsWith('tmdb:') ? id.split(':')[1] : id;

        switch (type) {
            case 'movie':
                endpoint = `${TRAKT_API_BASE}/movies/${cleanId}/comments?page=${page}&limit=${limit}&extended=full`;
                break;
            case 'show':
                endpoint = `${TRAKT_API_BASE}/shows/${cleanId}/comments?page=${page}&limit=${limit}&extended=full`;
                break;
            case 'season':
                endpoint = `${TRAKT_API_BASE}/shows/${cleanId}/seasons/${season}/comments?page=${page}&limit=${limit}&extended=full`;
                break;
            case 'episode':
                endpoint = `${TRAKT_API_BASE}/shows/${cleanId}/seasons/${season}/episodes/${episode}/comments?page=${page}&limit=${limit}&extended=full`;
                break;
        }

        try {
            const res = await fetch(endpoint, { headers: this.headers });
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            console.error('[TraktService] getComments error', e);
            return [];
        }
    }

    // --- Write Operations ---

    // --- Write Operations (High Level) ---

    // Generic helper to normalize IDs
    private static getIdPayload(id: string | number) {
        const idStr = String(id);
        if (idStr.startsWith('tt')) return { ids: { imdb: idStr } };
        const tmdbId = parseInt(idStr, 10);
        if (!isNaN(tmdbId)) return { ids: { tmdb: tmdbId } };
        return { ids: { tmdb: tmdbId } };
    }

    static async addToWatchlist(id: string | number, type: 'movie' | 'show'): Promise<boolean> {
        const payload = type === 'movie'
            ? { movies: [this.getIdPayload(id)] }
            : { shows: [this.getIdPayload(id)] };
        try {
            await this.postSync('watchlist', payload);
            return true;
        } catch (e) {
            console.error('addToWatchlist failed', e);
            return false;
        }
    }

    static async removeFromWatchlist(id: string | number, type: 'movie' | 'show'): Promise<boolean> {
        const payload = type === 'movie'
            ? { movies: [this.getIdPayload(id)] }
            : { shows: [this.getIdPayload(id)] };
        try {
            await this.postSync('watchlist/remove', payload);
            return true;
        } catch (e) {
            console.error('removeFromWatchlist failed', e);
            return false;
        }
    }

    static async addToCollection(id: string | number, type: 'movie' | 'show'): Promise<boolean> {
        const payload = type === 'movie'
            ? { movies: [this.getIdPayload(id)] }
            : { shows: [this.getIdPayload(id)] };
        try {
            await this.postSync('collection', payload);
            return true;
        } catch (e) {
            console.error('addToCollection failed', e);
            return false;
        }
    }

    static async removeFromCollection(id: string | number, type: 'movie' | 'show'): Promise<boolean> {
        const payload = type === 'movie'
            ? { movies: [this.getIdPayload(id)] }
            : { shows: [this.getIdPayload(id)] };
        try {
            await this.postSync('collection/remove', payload);
            return true;
        } catch (e) {
            console.error('removeFromCollection failed', e);
            return false;
        }
    }

    static async addToHistory(id: string | number, type: 'movie' | 'show'): Promise<boolean> {
        // For shows, this marks the whole show as watched? Or should be season/episode specific?
        // Nuvio has separate methods. For now let's support Movie and Show level.
        const payload = type === 'movie'
            ? { movies: [{ ...this.getIdPayload(id), watched_at: new Date().toISOString() }] }
            : { shows: [{ ...this.getIdPayload(id), watched_at: new Date().toISOString() }] };

        try {
            await this.postSync('history', payload);
            return true;
        } catch (e) {
            console.error('addToHistory failed', e);
            return false;
        }
    }

    static async removeFromHistory(id: string | number, type: 'movie' | 'show'): Promise<boolean> {
        const payload = type === 'movie'
            ? { movies: [this.getIdPayload(id)] }
            : { shows: [this.getIdPayload(id)] };
        try {
            await this.postSync('history/remove', payload);
            return true;
        } catch (e) {
            console.error('removeFromHistory failed', e);
            return false;
        }
    }

    static async addRating(id: string | number, type: 'movie' | 'show' | 'episode', rating: number): Promise<boolean> {
        const ratingVal = Math.min(10, Math.max(1, rating)); // Ensure 1-10
        const item = { ...this.getIdPayload(id), rating: ratingVal, rated_at: new Date().toISOString() };

        let payload: any = {};
        if (type === 'movie') payload.movies = [item];
        if (type === 'show') payload.shows = [item];
        if (type === 'episode') payload.episodes = [item];

        try {
            await this.postSync('ratings', payload);
            return true;
        } catch (e) {
            console.error('addRating failed', e);
            return false;
        }
    }

    static async removeRating(id: string | number, type: 'movie' | 'show' | 'episode'): Promise<boolean> {
        const item = this.getIdPayload(id);
        let payload: any = {};
        if (type === 'movie') payload.movies = [item];
        if (type === 'show') payload.shows = [item];
        if (type === 'episode') payload.episodes = [item];

        try {
            await this.postSync('ratings/remove', payload);
            return true;
        } catch (e) {
            console.error('removeRating failed', e);
            return false;
        }
    }

    private static async postSync(endpoint: string, body: any): Promise<TraktSyncResponse> {
        if (!this.auth.accessToken) throw new Error('Not authenticated');

        const res = await fetch(`${TRAKT_API_BASE}/sync/${endpoint}`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            throw new Error(`Trakt sync failed: ${res.statusText}`);
        }

        return await res.json();
    }

    private static hydrateLibraryItem(item: any, timestamp: string): TraktPlaybackItem {
        const type = item.type === 'show' ? 'episode' : item.type;
        const media = item.movie || item.show;
        const ids = media?.ids;
        const id = ids?.imdb || (ids?.tmdb ? `tmdb:${ids.tmdb}` : String(ids?.trakt || ''));

        let poster = media?.images?.poster?.[0];
        if (poster && !poster.startsWith('http')) poster = `https://${poster}`;

        return {
            id: ids?.trakt || Math.random(),
            progress: 0,
            paused_at: timestamp,
            type: type,
            movie: item.movie,
            show: item.show,
            meta: {
                id: id,
                name: media?.title || 'Unknown',
                poster: poster,
                year: media?.year?.toString(),
                genres: media?.genres,
                rating: media?.rating?.toFixed(1),
            }
        };
    }
}

