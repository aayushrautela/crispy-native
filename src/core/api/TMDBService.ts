import axios from 'axios';
import { StorageService } from '../storage';

const API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

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
    poster?: string;
    year?: string;
    rating?: string;
    maturityRating?: string;
    genres?: string[];
    runtime?: string;
    runtimeMinutes?: number;
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

        const cacheKey = `${idStr}_${type}`;
        if (metaCache[cacheKey]) return metaCache[cacheKey];

        // 0. Check Persistent Cache
        const persistentKey = `tmdb_cache_${cacheKey}` as any;
        const cached = StorageService.getGlobal<Partial<TMDBMeta>>(persistentKey);
        if (cached) {
            metaCache[cacheKey] = cached;
            return cached;
        }

        try {
            const findPath = type === 'movie' ? 'movie' : 'tv';
            let foundTmdbId: string | number = 0;

            if (idStr.startsWith('tmdb:')) {
                foundTmdbId = idStr.split(':')[1];
            } else if (idStr.startsWith('tt')) {
                // 1. Find TMDB ID from External ID (IMDB)
                const findUrl = `${BASE_URL}/find/${idStr}?api_key=${API_KEY}&external_source=imdb_id`;
                const findRes = await axios.get(findUrl);
                const result = type === 'movie' ? findRes.data.movie_results[0] : findRes.data.tv_results[0];
                if (!result) return {};
                foundTmdbId = result.id;
            } else {
                // Fallback: If it's a plain number, assume it's a TMDB ID (like Web UI)
                const n = Number(idStr);
                if (!isNaN(n)) {
                    foundTmdbId = n;
                } else {
                    console.warn('[TMDBService] Unsupported ID format:', idStr);
                    return {};
                }
            }

            // 2. Get Full Details & Credits & content_ratings/release_dates & Similar & External IDs & Reviews & Keywords
            const appendToResponse = findPath === 'movie' ? 'credits,release_dates,recommendations,similar,external_ids,videos,reviews,keywords' : 'credits,content_ratings,recommendations,similar,external_ids,videos,reviews,keywords';
            const detailUrl = `${BASE_URL}/${findPath}/${foundTmdbId}?api_key=${API_KEY}&language=en&append_to_response=${appendToResponse}`;
            const detailRes = await axios.get(detailUrl);
            const data = detailRes.data;

            // Fallback metadata if overview is missing (WebUI parity)
            if (!data.overview) {
                const fallbackRes = await axios.get(`${BASE_URL}/${findPath}/${foundTmdbId}?api_key=${API_KEY}&language=en`);
                const fallbackData = fallbackRes.data;
                if (fallbackData.overview) data.overview = fallbackData.overview;
                if (!data.title && !data.name && (fallbackData.title || fallbackData.name)) {
                    data.title = fallbackData.title;
                    data.name = fallbackData.name;
                }
            }

            // 3. Fetch Images separately (Nuvio-style priority)
            let logo: string | undefined;
            let backdropFallback: string | undefined;
            try {
                const imagesUrl = `${BASE_URL}/${findPath}/${foundTmdbId}/images?api_key=${API_KEY}&include_image_language=en,null`;
                const imagesRes = await axios.get(imagesUrl);
                const logos = imagesRes.data.logos || [];

                if (logos.length > 0) {
                    // Selection Priority: English SVG > English PNG > Any English > Any SVG > Any PNG > First Available
                    const enSvg = logos.find((l: any) => l.iso_639_1 === 'en' && l.file_path.endsWith('.svg'));
                    const enPng = logos.find((l: any) => l.iso_639_1 === 'en' && l.file_path.endsWith('.png'));
                    const enAny = logos.find((l: any) => l.iso_639_1 === 'en');
                    const anySvg = logos.find((l: any) => l.file_path.endsWith('.svg'));
                    const anyPng = logos.find((l: any) => l.file_path.endsWith('.png'));

                    logo = (enSvg || enPng || enAny || anySvg || anyPng || logos[0]).file_path;
                }

                const backdrops = imagesRes.data.backdrops || [];
                if (backdrops.length > 0) {
                    backdropFallback = backdrops[0].file_path;
                }
            } catch (e) { }

            // Fallback for Logo: Use Network/Studio logo if main logo is missing (Nuvio-style major brands fallback)
            if (!logo) {
                const majorBrands = ['netflix', 'amazon', 'warner bros', 'apple tv', 'paramount', 'hbo', 'hulu', 'disney', 'marvel', 'star wars', 'dc comics'];
                if (findPath === 'tv') {
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

            // Robust Certification Logic (Nuvio-style priority: US > GB > Any)
            let maturityRating: string | undefined;
            if (findPath === 'movie') {
                const releaseDates = data.release_dates?.results || [];
                const usRelease = releaseDates.find((r: any) => r.iso_3166_1 === 'US');
                const gbRelease = releaseDates.find((r: any) => r.iso_3166_1 === 'GB');
                const prioritized = [usRelease, gbRelease, ...releaseDates.filter((r: any) => r.iso_3166_1 !== 'US' && r.iso_3166_1 !== 'GB')];

                for (const rel of prioritized) {
                    const cert = rel?.release_dates?.find((d: any) => d.certification)?.certification;
                    if (cert) {
                        maturityRating = cert;
                        break;
                    }
                }
            } else {
                const contentRatings = data.content_ratings?.results || [];
                const usRating = contentRatings.find((r: any) => r.iso_3166_1 === 'US');
                const gbRating = contentRatings.find((r: any) => r.iso_3166_1 === 'GB');
                const prioritized = [usRating, gbRating, ...contentRatings.filter((r: any) => r.iso_3166_1 !== 'US' && r.iso_3166_1 !== 'GB')];

                for (const rat of prioritized) {
                    if (rat?.rating) {
                        maturityRating = rat.rating;
                        break;
                    }
                }
            }

            // Find Director
            const director = data.credits?.crew?.find((c: any) => c.job === 'Director')?.name;

            // Map Cast (with original sizing/path logic if preferred, keeping existing for now as it's fine)
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
                    const colRes = await axios.get(`${BASE_URL}/collection/${data.belongs_to_collection.id}?api_key=${API_KEY}`);
                    collection = {
                        id: colRes.data.id,
                        name: colRes.data.name,
                        backdrop: colRes.data.backdrop_path ? `${IMAGE_BASE}/w780${colRes.data.backdrop_path}` : null,
                        parts: colRes.data.parts.filter((p: any) => p.poster_path).map((p: any) => ({
                            id: p.id, // Note: This is TMDB ID, might need resolution if clicking
                            name: p.title,
                            poster: `${IMAGE_BASE}/w500${p.poster_path}`,
                            year: (p.release_date || '').split('-')[0],
                            type: 'movie',
                            tmdbId: p.id,
                        }))
                    };
                } catch (e) { console.warn('Failed to fetch collection', e); }
            }

            // AI Insights
            const keywords = (data.keywords?.keywords || data.keywords?.results || []).map((k: any) => k.name).slice(0, 5);
            const aiInsights = {
                keywords,
                tagline: data.tagline || "",
                tone: data.vote_average > 8 ? "Critically Acclaimed Masterpiece" : (data.vote_average > 6 ? "Solid Entertainment" : "Polarizing"),
                studio: data.production_companies?.[0]?.name || data.networks?.[0]?.name,
                homepage: data.homepage
            };

            const enriched: Partial<TMDBMeta> = {
                id: idStr,
                tmdbId: Number(foundTmdbId),
                imdbId: data.external_ids?.imdb_id || (data.imdb_id),
                type: findPath === 'tv' ? 'series' : 'movie',
            };
            console.log(`[TMDBService] Resolved meta for ${idStr}: tmdbId=${enriched.tmdbId}, imdbId=${enriched.imdbId}, type=${enriched.type}`);

            Object.assign(enriched, {
                title: data.title || data.name,
                logo: logo ? `${IMAGE_BASE}/w500${logo}` : undefined,
                backdrop: (data.backdrop_path || backdropFallback) ? `${IMAGE_BASE}/w780${data.backdrop_path || backdropFallback}` : undefined,
                poster: data.poster_path ? `${IMAGE_BASE}/w500${data.poster_path}` : undefined,
                year: (data.release_date || data.first_air_date || '').split('-')[0],
                runtimeMinutes: data.runtime || (data.episode_run_time && data.episode_run_time[0]) || 0,
                runtime: (() => {
                    const minutes = data.runtime || (data.episode_run_time && data.episode_run_time[0]) || 0;
                    if (!minutes) return undefined;
                    const hrs = Math.floor(minutes / 60);
                    const mins = minutes % 60;
                    if (hrs > 0) return `${hrs} hr ${mins} min`;
                    return `${mins} min`;
                })(),
                rating: data.vote_average?.toFixed(1) || '0.0',
                maturityRating,
                genres: data.genres?.map((g: any) => g.name) || [],
                description: data.overview || '',
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
                similar: data.recommendations?.results?.slice(0, 10).map((r: any) => ({
                    id: r.id.toString(),
                    name: r.title || r.name,
                    poster: r.poster_path ? `${IMAGE_BASE}/w500${r.poster_path}` : null,
                    year: (r.release_date || r.first_air_date || '').split('-')[0],
                    type: r.media_type || (findPath === 'movie' ? 'movie' : 'series'),
                    tmdbId: r.id,
                })) || [],
            });

            metaCache[cacheKey] = enriched;
            StorageService.setGlobal(persistentKey, enriched);
            return enriched;
        } catch (e) {
            console.error('[TMDBService] Failed to enrich:', stremioId, e);
            return {};
        }
    }

    static async getSeasonEpisodes(tmdbId: number, seasonNumber: number): Promise<any[]> {
        try {
            const url = `${BASE_URL}/tv/${tmdbId}/season/${seasonNumber}?api_key=${API_KEY}`;
            const res = await axios.get(url);
            return res.data.episodes.map((e: any) => ({
                episode: e.episode_number,
                name: e.name,
                overview: e.overview,
                thumbnail: e.still_path ? `${IMAGE_BASE}/w500${e.still_path}` : null,
                released: e.air_date,
                runtime: e.runtime ? `${e.runtime}m` : null,
            }));
        } catch (e) {
            return [];
        }
    }

    static async search(type: 'movie' | 'series', query: string, page = 1): Promise<any[]> {
        try {
            const tmdbType = type === 'series' ? 'tv' : 'movie';
            const url = `${BASE_URL}/search/${tmdbType}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=${page}&include_adult=false`;
            const res = await axios.get(url);

            return res.data.results
                .filter((r: any) => r.poster_path)
                .map((r: any) => ({
                    id: `tmdb:${r.id}`,
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
            console.error('[TMDBService] Search failed:', e);
            return [];
        }
    }

    static async getPersonDetails(personId: number): Promise<TMDBPerson | null> {
        try {
            const url = `${BASE_URL}/person/${personId}?api_key=${API_KEY}&append_to_response=combined_credits,external_ids`;
            const res = await axios.get(url);
            const data = res.data;

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
                                id: c.id.toString(),
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
            console.error('[TMDBService] Failed to fetch person details:', personId, e);
            return null;
        }
    }
}
