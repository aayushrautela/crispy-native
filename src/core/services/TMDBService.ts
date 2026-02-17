import { TMDB } from 'tmdb-ts';
import { useUserStore } from '@/src/core/stores/userStore';
import { StorageService } from '../storage';
import { toImdbIdForExternalLookup, toStrictBaseMediaId } from '../ids/mediaIds';
import {
    normalizeTmdbDetails,
    normalizeMediaType,
    type MediaType,
    type TMDBDetail,
    type TMDBImagesResponse,
} from '@crispy-streaming/media-core';

const ENV_ACCESS_TOKEN = process.env.EXPO_PUBLIC_TMDB_ACCESS_TOKEN;
const IMAGE_BASE = 'https://image.tmdb.org/t/p';
const APPEND_MOVIE = ['credits', 'release_dates', 'recommendations', 'similar', 'external_ids', 'videos', 'reviews', 'keywords'];
const APPEND_TV = ['credits', 'content_ratings', 'recommendations', 'similar', 'external_ids', 'videos', 'reviews', 'keywords'];
const INCLUDE_IMAGE_LANGUAGE = ['en', 'null', 'fr', 'de', 'es', 'it', 'ja', 'ko', 'zh'];

let tmdbClient: TMDB | null = null;
let tmdbClientToken = '';
const loggedTmdbNotFound = new Set<string>();

interface TmdbErrorLike {
    status_code?: number;
    status_message?: string;
    message?: string;
    status?: number;
    response?: {
        status?: number;
    };
}

function normalizeToken(value: string | null | undefined): string {
    if (!value) return '';
    return value.replace(/^Bearer\s+/i, '').trim();
}

function getTmdbAccessToken(): string {
    const fromSettings = normalizeToken(useUserStore.getState().settings.tmdbAccessToken);
    if (fromSettings) return fromSettings;
    return normalizeToken(ENV_ACCESS_TOKEN);
}

function getTmdbClient(): TMDB | null {
    const token = getTmdbAccessToken();
    if (!token) return null;
    if (!tmdbClient || tmdbClientToken !== token) {
        tmdbClient = new TMDB(token);
        tmdbClientToken = token;
    }
    return tmdbClient;
}

function parseTmdbIdFromAnyId(id: string): number | null {
    const parts = id.split(':');
    if (parts[0] !== 'tmdb') return null;
    const raw = parts[parts.length - 1];
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
}

async function resolveTmdbIdFromToken(strictBaseId: string, mediaType: MediaType, tmdb: TMDB): Promise<{ tmdbId: number | null; imdbId?: string }> {
    const fromTmdbStrict = parseTmdbIdFromAnyId(strictBaseId);
    if (fromTmdbStrict) return { tmdbId: fromTmdbStrict };

    const imdbId =
        toImdbIdForExternalLookup(strictBaseId, mediaType) ||
        (strictBaseId.startsWith('tt') ? strictBaseId : null);
    if (!imdbId) return { tmdbId: null };

    const found = await tmdb.find.byExternalId(imdbId, { external_source: 'imdb_id' });
    const result = mediaType === 'movie' ? found.movie_results?.[0] : found.tv_results?.[0];
    return { tmdbId: result?.id || null, imdbId };
}

function getErrorMessage(error: unknown): string {
    const maybe = error as TmdbErrorLike;
    if (maybe?.status_message) {
        return maybe.status_code ? `${maybe.status_code}: ${maybe.status_message}` : maybe.status_message;
    }
    if (maybe?.message) return maybe.message;
    return String(error);
}

function getErrorStatus(error: unknown): number | null {
    const maybe = error as TmdbErrorLike;
    const status = maybe?.status_code ?? maybe?.status ?? maybe?.response?.status;
    return typeof status === 'number' ? status : null;
}

function isTmdbNotFoundError(error: unknown): boolean {
    const status = getErrorStatus(error);
    if (status === 34 || status === 404) return true;

    const message = getErrorMessage(error).toLowerCase();
    return message.includes('resource you requested could not be found') || message.includes('not found');
}

function logTmdbNotFoundOnce(scope: string, key: string, error: unknown): void {
    const dedupeKey = `${scope}:${key}`;
    if (loggedTmdbNotFound.has(dedupeKey)) return;
    if (loggedTmdbNotFound.size > 500) loggedTmdbNotFound.clear();

    loggedTmdbNotFound.add(dedupeKey);
    console.warn(`[TMDBService] ${scope} not found (${key}):`, getErrorMessage(error));
}

export interface TMDBCast {
    id: number;
    name: string;
    character: string;
    profile: string | null;
}

export interface TMDBReview {
    id: string;
    author: string;
    content: string;
    rating: number | null;
    avatar: string | null;
    created_at: string;
}

export interface TMDBCollection {
    id: number;
    name: string;
    backdrop: string | null;
    parts: any[];
}

export interface TMDBMeta {
    id: string; // The original ID used for the fetch
    tmdbId: number;
    imdbId?: string;
    title: string;
    logo?: string;
    backdrop?: string;
    backdrops?: string[];
    poster?: string;
    posters?: string[];
    year?: string;
    rating?: string;
    maturityRating?: string;
    genres?: string[];
    runtime?: string;
    runtimeMinutes?: number;
    tagline?: string;
    status?: string;
    releaseDate?: string;
    firstAirDate?: string;
    lastAirDate?: string;
    numberOfSeasons?: number;
    numberOfEpisodes?: number;
    episodeRunTime?: number[];
    budget?: number;
    revenue?: number;
    originCountry?: string[];
    originalLanguage?: string;
    createdBy?: string[];
    description?: string;
    type?: 'movie' | 'series'; // Made optional as it's not always present in Partial<TMDBMeta>
    director?: string;
    cast?: TMDBCast[];
    similar?: Partial<TMDBMeta>[];
    reviews?: TMDBReview[];
    collection?: TMDBCollection;
    videos?: any[]; // Episodes for series
    seasons?: {
        id: number;
        name: string;
        seasonNumber: number;
        episodeCount: number;
        airDate: string;
        poster: string | null;
    }[];
    aiInsights?: {
        tagline: string;
        tone: string;
        studio?: string;
        homepage?: string;
    };
    networks?: { id: number; name: string; logo: string | null }[];
    productionCompanies?: { id: number; name: string; logo: string | null }[];
}

export interface TMDBPerson {
    id: number;
    name: string;
    biography: string;
    birthday: string | null;
    place_of_birth: string | null;
    profile: string | null;
    known_for_department: string;
    also_known_as: string[];
    external_ids: {
        imdb_id: string | null;
        instagram_id: string | null;
        twitter_id: string | null;
    };
    credits: {
        cast: any[];
        crew: any[];
    };
}

const metaCache: Record<string, Partial<TMDBMeta>> = {};

export class TMDBService {
    static async getEnrichedMeta(stremioId: string | number, type: 'movie' | 'series' | string): Promise<Partial<TMDBMeta>> {
        if (!stremioId) return {};
        const idStr = String(stremioId);

        const mediaType = normalizeMediaType(type);
        if (!mediaType) {
            console.warn('[TMDBService] Unsupported media type:', type);
            return {};
        }

        const strictBaseId = toStrictBaseMediaId(idStr, mediaType);
        if (!strictBaseId) {
            console.warn('[TMDBService] Unable to coerce strict id:', idStr);
            return {};
        }

        const cacheKey = `${strictBaseId}_${mediaType}`;
        if (metaCache[cacheKey]) return metaCache[cacheKey];

        // 0. Check Persistent Cache
        const persistentKey = `tmdb_cache_${cacheKey}` as any;
        const cached = StorageService.getGlobal<Partial<TMDBMeta>>(persistentKey);
        if (cached) {
            metaCache[cacheKey] = cached;
            return cached;
        }

        try {
            const tmdb = getTmdbClient();
            if (!tmdb) {
                console.warn('[TMDBService] Missing TMDB access token (set in Metadata settings or EXPO_PUBLIC_TMDB_ACCESS_TOKEN)');
                return {};
            }

            const isMovie = mediaType === 'movie';
            const resolved = await resolveTmdbIdFromToken(strictBaseId, mediaType, tmdb);
            const foundTmdbId = resolved.tmdbId;

            if (!foundTmdbId) {
                console.warn('[TMDBService] Unable to resolve TMDB id:', idStr);
                return {};
            }

            // 2. Get full details with append_to_response
            const data: any =
                isMovie
                    ? await tmdb.movies.details(foundTmdbId, APPEND_MOVIE as any, 'en-US')
                    : await tmdb.tvShows.details(foundTmdbId, APPEND_TV as any, 'en-US');

            // Fallback metadata if overview is missing (WebUI parity)
            if (!data.overview) {
                const fallbackData: any =
                    isMovie
                        ? await tmdb.movies.details(foundTmdbId, undefined, 'en-US')
                        : await tmdb.tvShows.details(foundTmdbId, undefined, 'en-US');
                if (fallbackData.overview) data.overview = fallbackData.overview;
                if (!data.title && !data.name && (fallbackData.title || fallbackData.name)) {
                    data.title = fallbackData.title;
                    data.name = fallbackData.name;
                }
            }

            // 3. Fetch Images separately (Nuvio-style priority)
            let logo: string | undefined;
            let backdropFallback: string | undefined;
            let allBackdrops: string[] = [];
            let allPosters: string[] = [];
            let imagesData: TMDBImagesResponse | undefined;
            try {
                imagesData = (
                    mediaType === 'movie'
                        ? await tmdb.movies.images(foundTmdbId, { include_image_language: INCLUDE_IMAGE_LANGUAGE })
                        : await tmdb.tvShows.images(foundTmdbId, { include_image_language: INCLUDE_IMAGE_LANGUAGE })
                ) as TMDBImagesResponse;
                const logos = imagesData.logos || [];

                if (logos.length > 0) {
                    // Selection Priority: English SVG > English PNG > Any English > Any SVG > Any PNG > First Available
                    const enSvg = logos.find((l: any) => l.iso_639_1 === 'en' && l.file_path.endsWith('.svg'));
                    const enPng = logos.find((l: any) => l.iso_639_1 === 'en' && l.file_path.endsWith('.png'));
                    const enAny = logos.find((l: any) => l.iso_639_1 === 'en');
                    const anySvg = logos.find((l: any) => l.file_path.endsWith('.svg'));
                    const anyPng = logos.find((l: any) => l.file_path.endsWith('.png'));

                    logo = (enSvg || enPng || enAny || anySvg || anyPng || logos[0]).file_path;
                }

                const backdrops = imagesData.backdrops || [];
                if (backdrops.length > 0) {
                    backdropFallback = backdrops[0].file_path;
                    allBackdrops = backdrops.map((b: any) => `${IMAGE_BASE}/w780${b.file_path}`);
                }

                const posters = imagesData.posters || [];
                if (posters.length > 0) {
                    allPosters = posters.map((p: any) => `${IMAGE_BASE}/w500${p.file_path}`);
                }
            } catch (e) {
                console.warn('[TMDBService] Failed to fetch images:', getErrorMessage(e));
            }

            // Fallback for Logo: Use Network/Studio logo if main logo is missing (Nuvio-style major brands fallback)
            if (!logo) {
                const majorBrands = ['netflix', 'amazon', 'warner bros', 'apple tv', 'paramount', 'hbo', 'hulu', 'disney', 'marvel', 'star wars', 'dc comics'];
                if (!isMovie) {
                    const brandNetwork = data.networks?.find((n: any) =>
                        majorBrands.some(brand => n.name.toLowerCase().includes(brand))
                    ) || data.networks?.[0];
                    if (brandNetwork?.logo_path) logo = brandNetwork.logo_path;
                } else {
                    const brandStudio = data.production_companies?.find((c: any) =>
                        c.logo_path && majorBrands.some(brand => c.name.toLowerCase().includes(brand))
                    ) || data.production_companies?.find((c: any) => c.logo_path);
                    if (brandStudio?.logo_path) logo = brandStudio.logo_path;
                }
            }

            const core = normalizeTmdbDetails(data as TMDBDetail, mediaType, imagesData);

            const maturityRating = core.certification;
            const director = core.director || data.credits?.crew?.find((c: any) => c.job === 'Director')?.name;

            const cast: TMDBCast[] = data.credits?.cast?.slice(0, 10).map((c: any) => ({
                id: c.id,
                name: c.name,
                character: c.character,
                profile: c.profile_path ? `${IMAGE_BASE}/w185${c.profile_path}` : null,
            })) || [];

            // Map Reviews
            const reviews: TMDBReview[] = data.reviews?.results?.slice(0, 5).map((r: any) => ({
                id: r.id,
                author: r.author,
                content: r.content,
                rating: r.author_details?.rating,
                avatar: r.author_details?.avatar_path ? (r.author_details.avatar_path.startsWith('/http') ? r.author_details.avatar_path.substring(1) : `${IMAGE_BASE}/w45${r.author_details.avatar_path}`) : null,
                created_at: r.created_at,
            })) || [];

            // Fetch Collection (if movie belongs to one)
            let collection: TMDBCollection | undefined;
            if (data.belongs_to_collection) {
                try {
                    const colRes: any = await tmdb.collections.details(data.belongs_to_collection.id, { language: 'en-US' });
                    collection = {
                        id: colRes.id,
                        name: colRes.name,
                        backdrop: colRes.backdrop_path ? `${IMAGE_BASE}/w780${colRes.backdrop_path}` : null,
                        parts: (colRes.parts || []).filter((p: any) => p.poster_path).map((p: any) => ({
                            id: `tmdb:movie:${p.id}`,
                            name: p.title,
                            poster: `${IMAGE_BASE}/w500${p.poster_path}`,
                            year: (p.release_date || '').split('-')[0],
                            type: 'movie',
                            tmdbId: p.id,
                        })),
                    };
                } catch (e) {
                    console.warn('[TMDBService] Failed to fetch collection:', getErrorMessage(e));
                }
            }

            // AI Insights
            const aiInsights = {
                tagline: data.tagline || '',
                tone: data.vote_average > 8 ? 'Critically Acclaimed Masterpiece' : (data.vote_average > 6 ? 'Solid Entertainment' : 'Polarizing'),
                studio: data.production_companies?.[0]?.name || data.networks?.[0]?.name,
                homepage: data.homepage,
            };

            const enriched: Partial<TMDBMeta> = {
                id: strictBaseId,
                tmdbId: core.ids.tmdb || Number(foundTmdbId),
                imdbId: core.ids.imdb || resolved.imdbId || data.external_ids?.imdb_id || (data.imdb_id),
                type: mediaType === 'series' ? 'series' : 'movie',
            };

            Object.assign(enriched, {
                title: core.title || data.title || data.name,
                logo: core.images.logo || (logo ? `${IMAGE_BASE}/w500${logo}` : undefined),
                backdrop: core.images.backdrop || ((data.backdrop_path || backdropFallback) ? `${IMAGE_BASE}/w780${data.backdrop_path || backdropFallback}` : undefined),
                backdrops: core.images.backdrops?.length ? core.images.backdrops : allBackdrops,
                poster: core.images.poster || (data.poster_path ? `${IMAGE_BASE}/w500${data.poster_path}` : undefined),
                posters: core.images.posters?.length ? core.images.posters : allPosters,
                year: core.year ? String(core.year) : (data.release_date || data.first_air_date || '').split('-')[0],
                runtimeMinutes: typeof core.runtimeMinutes === 'number' ? core.runtimeMinutes : (data.runtime || (data.episode_run_time && data.episode_run_time[0]) || 0),
                runtime: (() => {
                    const minutes = typeof core.runtimeMinutes === 'number' ? core.runtimeMinutes : (data.runtime || (data.episode_run_time && data.episode_run_time[0]) || 0);
                    if (!minutes) return undefined;
                    const hrs = Math.floor(minutes / 60);
                    const mins = minutes % 60;
                    if (hrs > 0) return `${hrs} hr ${mins} min`;
                    return `${mins} min`;
                })(),
                rating: (typeof core.rating === 'number' ? core.rating.toFixed(1) : undefined) || data.vote_average?.toFixed(1) || '0.0',
                maturityRating,
                genres: core.genres?.length ? core.genres : (data.genres?.map((g: any) => g.name) || []),
                tagline: data.tagline || undefined,
                status: data.status || undefined,
                releaseDate: data.release_date || undefined,
                firstAirDate: data.first_air_date || undefined,
                lastAirDate: data.last_air_date || undefined,
                numberOfSeasons: data.number_of_seasons || undefined,
                numberOfEpisodes: data.number_of_episodes || undefined,
                episodeRunTime: Array.isArray(data.episode_run_time) ? data.episode_run_time : [],
                budget: typeof data.budget === 'number' ? data.budget : undefined,
                revenue: typeof data.revenue === 'number' ? data.revenue : undefined,
                originCountry: Array.isArray(data.origin_country) ? data.origin_country : undefined,
                originalLanguage: data.original_language || undefined,
                createdBy: Array.isArray(data.created_by) ? data.created_by.map((creator: any) => creator?.name).filter(Boolean) : [],
                description: core.description || data.overview || '',
                director,
                cast,
                reviews,
                collection,
                aiInsights,
                networks: data.networks?.map((n: any) => ({
                    id: n.id,
                    name: n.name,
                    logo: n.logo_path ? `${IMAGE_BASE}/w92${n.logo_path}` : null
                })),
                productionCompanies: data.production_companies?.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    logo: c.logo_path ? `${IMAGE_BASE}/w92${c.logo_path}` : null
                })),
                seasons: data.seasons?.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    seasonNumber: s.season_number,
                    episodeCount: s.episode_count,
                    airDate: s.air_date,
                    poster: s.poster_path ? `${IMAGE_BASE}/w500${s.poster_path}` : null,
                })) || [],
                similar: (data.recommendations?.results || data.similar?.results || []).slice(0, 10).map((r: any) => {
                    const itemType = r.media_type === 'tv'
                        ? 'series'
                        : (r.media_type === 'movie' ? 'movie' : (isMovie ? 'movie' : 'series'));
                    const strictId = itemType === 'series' ? `tmdb:show:${r.id}` : `tmdb:movie:${r.id}`;
                    return {
                        id: strictId,
                        name: r.title || r.name,
                        poster: r.poster_path ? `${IMAGE_BASE}/w500${r.poster_path}` : null,
                        year: (r.release_date || r.first_air_date || '').split('-')[0],
                        type: itemType,
                        tmdbId: r.id,
                    };
                }) || [],
                videos: data.videos?.results || [],
            });

            metaCache[cacheKey] = enriched;
            StorageService.setGlobal(persistentKey, enriched);
            return enriched;
        } catch (e) {
            if (isTmdbNotFoundError(e)) {
                logTmdbNotFoundOnce('enrichment', String(stremioId), e);
                return {};
            }
            console.error('[TMDBService] Failed to enrich:', stremioId, getErrorMessage(e));
            return {};
        }
    }

    static async getSeasonEpisodes(tmdbId: number, seasonNumber: number): Promise<any[]> {
        try {
            const tmdb = getTmdbClient();
            if (!tmdb) return [];
            const season: any = await tmdb.tvShows.season(tmdbId, seasonNumber);
            return (season.episodes || []).map((e: any) => ({
                episode: e.episode_number,
                name: e.name,
                overview: e.overview,
                thumbnail: e.still_path ? `${IMAGE_BASE}/w500${e.still_path}` : null,
                released: e.air_date,
                runtime: e.runtime ? `${e.runtime}m` : null,
            }));
        } catch (e) {
            console.warn('[TMDBService] Failed to fetch season episodes:', getErrorMessage(e));
            return [];
        }
    }

    static async getEpisodeDetails(tmdbId: number, seasonNumber: number, episodeNumber: number): Promise<any | null> {
        try {
            const tmdb = getTmdbClient();
            if (!tmdb) return null;
            const e: any = await tmdb.tvEpisode.details({
                tvShowID: tmdbId,
                seasonNumber,
                episodeNumber,
            });
            return {
                episode: e.episode_number,
                name: e.name,
                overview: e.overview,
                thumbnail: e.still_path ? `${IMAGE_BASE}/w500${e.still_path}` : null,
                released: e.air_date,
                runtime: e.runtime ? `${e.runtime}m` : null,
            };
        } catch (e) {
            if (isTmdbNotFoundError(e)) {
                logTmdbNotFoundOnce('episode details', `${tmdbId}:S${seasonNumber}E${episodeNumber}`, e);
                return null;
            }
            console.error('[TMDBService] Failed to fetch episode details:', getErrorMessage(e));
            return null;
        }
    }

    static async search(type: 'movie' | 'series', query: string, page = 1): Promise<any[]> {
        try {
            const tmdb = getTmdbClient();
            if (!tmdb || !query.trim()) return [];
            const result = type === 'series'
                ? await tmdb.search.tvShows({ query, page, include_adult: false, language: 'en-US' })
                : await tmdb.search.movies({ query, page, include_adult: false, language: 'en-US' });

            return (result.results || [])
                .filter((r: any) => r.poster_path)
                .map((r: any) => ({
                    id: type === 'series' ? `tmdb:show:${r.id}` : `tmdb:movie:${r.id}`,
                    tmdbId: r.id,
                    name: r.title || r.name,
                    poster: `${IMAGE_BASE}/w500${r.poster_path}`,
                    year: (r.release_date || r.first_air_date || '').split('-')[0],
                    type: type,
                    rating: r.vote_average?.toFixed(1) || '0.0',
                    description: r.overview,
                    popularity: r.popularity
                }));
        } catch (e) {
            console.error('[TMDBService] Search failed:', getErrorMessage(e));
            return [];
        }
    }

    static async getPersonDetails(personId: number): Promise<TMDBPerson | null> {
        try {
            const tmdb = getTmdbClient();
            if (!tmdb) return null;
            const data: any = await tmdb.people.details(personId, ['combined_credits', 'external_ids'] as any, 'en-US');

            return {
                id: data.id,
                name: data.name,
                biography: data.biography,
                birthday: data.birthday,
                place_of_birth: data.place_of_birth,
                profile: data.profile_path ? `${IMAGE_BASE}/h632${data.profile_path}` : null,
                known_for_department: data.known_for_department,
                also_known_as: data.also_known_as || [],
                external_ids: {
                    imdb_id: data.external_ids?.imdb_id || null,
                    instagram_id: data.external_ids?.instagram_id || null,
                    twitter_id: data.external_ids?.twitter_id || null,
                },
                credits: {
                    cast: (() => {
                        const unique = new Map();
                        const cast = data.combined_credits?.cast || [];
                        cast.forEach((c: any) => {
                            if (!unique.has(c.id)) {
                                unique.set(c.id, c);
                            }
                        });
                        return Array.from(unique.values())
                             .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
                             .map((c: any) => ({
                                 id: c.media_type === 'tv' ? `tmdb:show:${c.id}` : `tmdb:movie:${c.id}`,
                                 tmdbId: c.id,
                                 name: c.title || c.name,
                                 poster: c.poster_path ? `${IMAGE_BASE}/w500${c.poster_path}` : null,
                                 year: (c.release_date || c.first_air_date || '').split('-')[0],
                                 type: c.media_type === 'tv' ? 'series' : 'movie',
                                 rating: c.vote_average?.toFixed(1) || '0.0',
                             }));
                     })(),
                    crew: data.combined_credits?.crew || [],
                }
            };
        } catch (e) {
            console.error('[TMDBService] Failed to fetch person details:', personId, getErrorMessage(e));
            return null;
        }
    }
}
