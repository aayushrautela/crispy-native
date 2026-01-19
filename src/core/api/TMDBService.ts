import axios from 'axios';

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
    id: string;
    tmdbId: number;
    title: string;
    logo?: string;
    backdrop?: string;
    poster?: string;
    year: string;
    rating: string;
    genres: string[];
    description: string;
    type: 'movie' | 'series';
    director?: string;
    cast?: TMDBCast[];
    similar?: any[];
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
        keywords: string[];
        tagline: string;
        tone: string;
    };
}

const metaCache: Record<string, Partial<TMDBMeta>> = {};

export class TMDBService {
    static async getEnrichedMeta(stremioId: string, type: 'movie' | 'series' | string): Promise<Partial<TMDBMeta>> {
        const cacheKey = `${stremioId}_${type}`;
        if (metaCache[cacheKey]) return metaCache[cacheKey];

        try {
            const findPath = type === 'movie' ? 'movie' : 'tv';
            let tmdbId: string | number;

            if (stremioId.startsWith('tmdb:')) {
                tmdbId = stremioId.split(':')[1];
            } else {
                // 1. Find TMDB ID from External ID (IMDB)
                const findUrl = `${BASE_URL}/find/${stremioId}?api_key=${API_KEY}&external_source=imdb_id`;
                const findRes = await axios.get(findUrl);
                const result = type === 'movie' ? findRes.data.movie_results[0] : findRes.data.tv_results[0];
                if (!result) return {};
                tmdbId = result.id;
            }

            // 2. Get Full Details & Images & Credits & Similar & Reviews & Keywords
            const detailUrl = `${BASE_URL}/${findPath}/${tmdbId}?api_key=${API_KEY}&append_to_response=images,content_ratings,release_dates,credits,recommendations,reviews,keywords`;
            const detailRes = await axios.get(detailUrl);
            const data = detailRes.data;

            // Find Logo (Clear Logo)
            const logo = data.images?.logos?.find((l: any) => l.iso_639_1 === 'en' || !l.iso_639_1)?.file_path;

            // Find Director
            const director = data.credits?.crew?.find((c: any) => c.job === 'Director')?.name;

            // Map Cast
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
                        backdrop: colRes.data.backdrop_path ? `${IMAGE_BASE}/original${colRes.data.backdrop_path}` : null,
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

            // Mock AI Insights based on keywords/tagline
            const keywords = (data.keywords?.keywords || data.results || []).map((k: any) => k.name).slice(0, 5);
            const aiInsights = {
                keywords,
                tagline: data.tagline || "No tagline available.",
                tone: data.vote_average > 8 ? "Critically Acclaimed Masterpiece" : (data.vote_average > 6 ? "Solid Entertainment" : "Polarizing"),
            };

            const enriched: Partial<TMDBMeta> = {
                tmdbId,
                title: data.title || data.name,
                logo: logo ? `${IMAGE_BASE}/original${logo}` : undefined,
                backdrop: data.backdrop_path ? `${IMAGE_BASE}/original${data.backdrop_path}` : undefined,
                poster: data.poster_path ? `${IMAGE_BASE}/w500${data.poster_path}` : undefined,
                year: (data.release_date || data.first_air_date || '').split('-')[0],
                rating: data.vote_average?.toFixed(1) || '0.0',
                genres: data.genres?.map((g: any) => g.name) || [],
                description: data.overview || '',
                director,
                cast,
                reviews,
                collection,
                aiInsights,
                seasons: data.seasons?.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    seasonNumber: s.season_number,
                    episodeCount: s.episode_count,
                    airDate: s.air_date,
                    poster: s.poster_path ? `${IMAGE_BASE}/w500${s.poster_path}` : null,
                })) || [],
                similar: data.recommendations?.results?.slice(0, 10).map((r: any) => ({
                    id: r.id, // Warning: These are TMDB IDs
                    name: r.title || r.name,
                    poster: r.poster_path ? `${IMAGE_BASE}/w500${r.poster_path}` : null,
                    year: (r.release_date || r.first_air_date || '').split('-')[0],
                    type: r.media_type || (type === 'movie' ? 'movie' : 'series'),
                    tmdbId: r.id,
                })) || [],
            };

            metaCache[cacheKey] = enriched;
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
}
