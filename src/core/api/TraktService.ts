import { useUserStore } from '../stores/userStore';
import { TMDBService } from './TMDBService';
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
            // 1. Fetch Playback
            const playbackRes = await fetch(`${TRAKT_API_BASE}/sync/playback?extended=images&limit=50`, { headers: this.headers });
            const playbackItems: TraktPlaybackItem[] = await playbackRes.json();

            // 2. Fetch Watched Shows (for "Up Next")
            const watchedRes = await fetch(`${TRAKT_API_BASE}/sync/watched/shows`, { headers: this.headers });
            const watchedShows: any[] = await watchedRes.json();

            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const resultItems: TraktPlaybackItem[] = [];

            // STEP 1: Process playback progress items (Parallelized)
            const sortedPlayback = [...playbackItems]
                .sort((a: any, b: any) => new Date(b.paused_at).getTime() - new Date(a.paused_at).getTime())
                .slice(0, 30);

            const playbackResults = await Promise.all(sortedPlayback.map(async (item) => {
                if (item.progress < 2) return null;
                const pausedAt = new Date(item.paused_at).getTime();
                if (pausedAt < thirtyDaysAgo) return null;

                const type = item.type;
                const media = type === 'movie' ? item.movie : item.show;
                if (!media) return null;

                const ids = media.ids;
                const id = ids.imdb || (ids.tmdb ? `tmdb:${ids.tmdb}` : undefined);
                if (!id) return null;

                let poster = media.images?.poster?.[0];
                let background = media.images?.fanart?.[0];
                let logo = media.images?.logo?.[0];

                if (poster && !poster.startsWith('http')) poster = `https://${poster}`;
                if (background && !background.startsWith('http')) background = `https://${background}`;
                if (logo && !logo.startsWith('http')) logo = `https://${logo}`;

                let genres: string[] | undefined;
                let rating: string | undefined;
                let episodeAirDate: string | undefined;
                let episodeTitle: string | undefined = item.episode?.title;
                let description: string | undefined;
                let meta: any = {};

                try {
                    meta = await TMDBService.getEnrichedMeta(id, type === 'movie' ? 'movie' : 'series');
                    poster = meta.poster || poster;
                    background = meta.backdrop || background;
                    logo = meta.logo || logo;
                    genres = meta.genres;
                    rating = meta.rating;
                    description = meta.description;

                    if (type === 'episode' && item.episode && meta.tmdbId) {
                        const seasonData = await TMDBService.getSeasonEpisodes(meta.tmdbId, item.episode.season);
                        const episode = seasonData.find(e => e.episode === item.episode!.number);
                        if (episode) {
                            episodeAirDate = episode.released;
                            episodeTitle = episode.name;
                            if (episode.thumbnail) background = episode.thumbnail;
                        }
                    }
                } catch (e) { }

                const resultTmdbId = meta?.tmdbId;

                if (type === 'movie') {
                    if (item.progress >= 85) return null;
                    return {
                        ...item,
                        meta: {
                            id: id,
                            tmdbId: resultTmdbId,
                            name: media.title,
                            poster: poster,
                            background: background,
                            logo: logo,
                            genres: genres,
                            rating: rating,
                            description: description
                        }
                    };
                } else if (type === 'episode' && item.show && item.episode) {
                    const showImdb = item.show.ids.imdb;
                    if (item.progress >= 85 && showImdb) {
                        const nextEp = await this.findNextEpisodeFromTMDB(showImdb, item.episode.season, item.episode.number);
                        if (nextEp) {
                            return {
                                ...item,
                                progress: 0,
                                episode: {
                                    ...item.episode,
                                    season: nextEp.season,
                                    number: nextEp.episode,
                                    title: nextEp.title,
                                    ids: item.episode.ids
                                },
                                meta: {
                                    id: id,
                                    tmdbId: resultTmdbId,
                                    name: media.title,
                                    poster: poster,
                                    background: background,
                                    logo: logo,
                                    genres: genres,
                                    rating: rating,
                                    description: description,
                                    episodeTitle: nextEp.title,
                                    airDate: nextEp.airDate
                                }
                            };
                        }
                        return null;
                    }
                    return {
                        ...item,
                        meta: {
                            id: id,
                            tmdbId: resultTmdbId,
                            name: media.title,
                            poster: poster,
                            background: background,
                            logo: logo,
                            genres: genres,
                            rating: rating,
                            description: description,
                            episodeTitle: episodeTitle,
                            airDate: episodeAirDate
                        }
                    };
                }
                return null;
            }));

            resultItems.push(...playbackResults.filter((r): r is TraktPlaybackItem => r !== null));

            // STEP 2: Process watched shows (Up Next) (Parallelized)
            const sortedWatched = [...watchedShows]
                .sort((a: any, b: any) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime())
                .slice(0, 20);

            const watchedResults = await Promise.all(sortedWatched.map(async (watchedShow) => {
                try {
                    if (!watchedShow.show?.ids?.imdb && !watchedShow.show?.ids?.tmdb) return null;
                    const lastWatchedAt = new Date(watchedShow.last_watched_at).getTime();
                    if (lastWatchedAt < thirtyDaysAgo) return null;

                    const showImdb = watchedShow.show.ids.imdb;
                    const showIds = watchedShow.show.ids;
                    const id = showIds.imdb || (showIds.tmdb ? `tmdb:${showIds.tmdb}` : undefined);
                    if (!id) return null;

                    let lastWatchedSeason = 0;
                    let lastWatchedEpisode = 0;
                    let latestTimestamp = 0;

                    if (watchedShow.seasons) {
                        for (const season of watchedShow.seasons) {
                            if (season.number === 0) continue;
                            for (const episode of season.episodes) {
                                const epTimestamp = new Date(episode.last_watched_at).getTime();
                                if (epTimestamp > latestTimestamp) {
                                    latestTimestamp = epTimestamp;
                                    lastWatchedSeason = season.number;
                                    lastWatchedEpisode = episode.number;
                                }
                            }
                        }
                    }

                    if (lastWatchedSeason === 0 && lastWatchedEpisode === 0) return null;

                    const nextEp = await this.findNextEpisodeFromTMDB(showImdb, lastWatchedSeason, lastWatchedEpisode);
                    if (!nextEp) return null;

                    let poster = watchedShow.show.images?.poster?.[0];
                    let background = watchedShow.show.images?.fanart?.[0];
                    let logo = watchedShow.show.images?.logo?.[0];

                    if (poster && !poster.startsWith('http')) poster = `https://${poster}`;
                    if (background && !background.startsWith('http')) background = `https://${background}`;
                    if (logo && !logo.startsWith('http')) logo = `https://${logo}`;

                    let genres: string[] | undefined;
                    let rating: string | undefined;
                    let description: string | undefined;
                    let meta: any = {};

                    try {
                        meta = await TMDBService.getEnrichedMeta(showImdb, 'series');
                        poster = meta.poster || poster;
                        background = meta.backdrop || background;
                        logo = meta.logo || logo;
                        genres = meta.genres;
                        rating = meta.rating;
                        description = meta.description;

                        if (meta.tmdbId) {
                            const episodes = await TMDBService.getSeasonEpisodes(meta.tmdbId, nextEp.season);
                            const found = episodes.find(e => e.episode === nextEp.episode);
                            if (found?.thumbnail) background = found.thumbnail;
                        }
                    } catch (e) { }

                    const resultTmdbId = meta?.tmdbId;

                    return {
                        id: Math.floor(Math.random() * 1000000), // temp id
                        progress: 0,
                        paused_at: watchedShow.last_watched_at,
                        type: 'episode' as const,
                        show: watchedShow.show,
                        episode: {
                            season: nextEp.season,
                            number: nextEp.episode,
                            title: nextEp.title,
                            ids: {} as any
                        },
                        meta: {
                            id: id,
                            tmdbId: resultTmdbId,
                            name: watchedShow.show.title,
                            poster: poster,
                            background: background,
                            logo: logo,
                            genres: genres,
                            rating: rating,
                            description: description,
                            episodeTitle: nextEp.title,
                            airDate: nextEp.airDate
                        }
                    };
                } catch (e) { return null; }
            }));

            resultItems.push(...watchedResults.filter((r): r is TraktPlaybackItem => r !== null));

            // Deduplicate
            const deduped = new Map<string, TraktPlaybackItem>();
            for (const item of resultItems) {
                const key = item.type === 'movie'
                    ? `movie:${item.movie?.ids.trakt}`
                    : `show:${item.show?.ids.trakt}`;

                const existing = deduped.get(key);
                const itemTime = new Date(item.paused_at).getTime();
                const existingTime = existing ? new Date(existing.paused_at).getTime() : 0;

                if (!existing || itemTime > existingTime) {
                    deduped.set(key, item);
                }
            }

            return Array.from(deduped.values())
                .sort((a, b) => new Date(b.paused_at).getTime() - new Date(a.paused_at).getTime());

        } catch (e) {
            console.error('Trakt getContinueWatching error', e);
            return [];
        }
    }

    // Helper: findNextEpisodeFromTMDB
    private static async findNextEpisodeFromTMDB(
        showImdb: string,
        currentSeason: number,
        currentEpisode: number
    ): Promise<{ season: number; episode: number; title: string; airDate?: string } | null> {
        try {
            const meta = await TMDBService.getEnrichedMeta(showImdb, 'series');
            if (!meta.tmdbId || !meta.seasons) return null;

            // Try current season
            try {
                const episodes = await TMDBService.getSeasonEpisodes(meta.tmdbId, currentSeason);
                for (const ep of episodes) {
                    if (ep.episode > currentEpisode) {
                        if (ep.released) {
                            const releaseDate = new Date(ep.released);
                            if (releaseDate <= new Date()) {
                                return {
                                    season: currentSeason,
                                    episode: ep.episode,
                                    title: ep.name || `Episode ${ep.episode}`,
                                    airDate: ep.released
                                };
                            }
                        }
                    }
                }
            } catch (e) { }

            // Try next seasons
            const sortedSeasons = meta.seasons
                .filter(s => s.seasonNumber > 0)
                .sort((a, b) => a.seasonNumber - b.seasonNumber);

            for (const season of sortedSeasons) {
                if (season.seasonNumber <= currentSeason) continue;

                try {
                    const episodes = await TMDBService.getSeasonEpisodes(meta.tmdbId, season.seasonNumber);
                    if (episodes[0]) {
                        const ep = episodes[0];
                        if (ep.released) {
                            const releaseDate = new Date(ep.released);
                            if (releaseDate <= new Date()) {
                                return {
                                    season: season.seasonNumber,
                                    episode: ep.episode,
                                    title: ep.name || `Episode ${ep.episode}`,
                                    airDate: ep.released
                                };
                            }
                        }
                    }
                } catch (e) { }
            }
            return null;
        } catch (e) {
            return null;
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

