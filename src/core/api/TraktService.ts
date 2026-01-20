import { useUserStore } from '../stores/userStore';
import { TMDBService } from './TMDBService';
import {
    TraktCollectionItem,
    TraktDeviceCodeResponse,
    TraktPlaybackItem,
    TraktRatingItem,
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

            // STEP 1: Process playback progress items
            const sortedPlayback = [...playbackItems]
                .sort((a: any, b: any) => new Date(b.paused_at).getTime() - new Date(a.paused_at).getTime())
                .slice(0, 30);

            for (const item of sortedPlayback) {
                if (item.progress < 2) continue;
                const pausedAt = new Date(item.paused_at).getTime();
                if (pausedAt < thirtyDaysAgo) continue;

                const type = item.type;
                const media = type === 'movie' ? item.movie : item.show;
                if (!media) continue;

                const ids = media.ids;
                const id = ids.imdb || (ids.tmdb ? `tmdb:${ids.tmdb}` : undefined);
                if (!id) continue;

                let poster = media.images?.poster?.[0];
                let background = media.images?.fanart?.[0];
                let logo = media.images?.logo?.[0];

                // Safe prefixing for Trakt images
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
                    if (item.progress >= 85) continue;
                    resultItems.push({
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
                    });
                } else if (type === 'episode' && item.show && item.episode) {
                    const showImdb = item.show.ids.imdb;
                    if (item.progress >= 85 && showImdb) {
                        const nextEp = await this.findNextEpisodeFromTMDB(showImdb, item.episode.season, item.episode.number);
                        if (nextEp) {
                            resultItems.push({
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
                            });
                        }
                        continue;
                    }
                    resultItems.push({
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
                    });
                }
            }

            // STEP 2: Process watched shows (Up Next)
            const sortedWatched = [...watchedShows]
                .sort((a: any, b: any) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime())
                .slice(0, 20);

            for (const watchedShow of sortedWatched) {
                try {
                    if (!watchedShow.show?.ids?.imdb && !watchedShow.show?.ids?.tmdb) continue;
                    const lastWatchedAt = new Date(watchedShow.last_watched_at).getTime();
                    if (lastWatchedAt < thirtyDaysAgo) continue;

                    const showImdb = watchedShow.show.ids.imdb;
                    const showIds = watchedShow.show.ids;
                    const id = showIds.imdb || (showIds.tmdb ? `tmdb:${showIds.tmdb}` : undefined);
                    if (!id) continue;

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

                    if (lastWatchedSeason === 0 && lastWatchedEpisode === 0) continue;

                    const nextEp = await this.findNextEpisodeFromTMDB(showImdb, lastWatchedSeason, lastWatchedEpisode);
                    if (!nextEp) continue;

                    let poster = watchedShow.show.images?.poster?.[0];
                    let background = watchedShow.show.images?.fanart?.[0];
                    let logo = watchedShow.show.images?.logo?.[0];

                    // Safe prefixing for Trakt images
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

                        // Get next episode specific thumbnail if possible
                        if (meta.tmdbId) {
                            const episodes = await TMDBService.getSeasonEpisodes(meta.tmdbId, nextEp.season);
                            const found = episodes.find(e => e.episode === nextEp.episode);
                            if (found?.thumbnail) background = found.thumbnail;
                        }
                    } catch (e) { }

                    const resultTmdbId = meta?.tmdbId;

                    resultItems.push({
                        id: Math.floor(Math.random() * 1000000), // temp id
                        progress: 0,
                        paused_at: watchedShow.last_watched_at,
                        type: 'episode',
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
                    });
                } catch (e) { }
            }

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

