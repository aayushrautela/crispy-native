import axios from 'axios';
import { formatIdForIdPrefixes } from '@crispy-streaming/media-core';
import { AddonManifest } from '../types/addon-types';

export interface MetaPreview {
    id: string;
    type: string;
    name: string;
    poster?: string;
    posterShape?: 'poster' | 'landscape' | 'square';
    description?: string;
    backdrop?: string;
    releaseInfo?: string;
    // Trakt / Continue Watching fields
    progressPercent?: number;
    episodeTitle?: string;
    showTitle?: string;
    season?: number;
    episodeNumber?: number;
    airDate?: string;
    logo?: string;
    genres?: string[];
    rating?: string;
    imdbRating?: string;
    numericRating?: number; // Pre-parsed 0-10 rating for performant filtering
    ids?: {
        trakt?: number;
        imdb?: string;
        tmdb?: number;
        slug?: string;
    };
}

export interface CatalogResponse {
    metas: MetaPreview[];
}

export interface ResourceResponse<T> {
    [key: string]: T;
}

export class AddonService {
    static normalizeAddonUrl(url: string): string {
        const normalized = url.trim();

        if (normalized.startsWith('stremio://')) {
            return normalized.replace('stremio://', 'https://');
        }

        if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
            return normalized;
        }

        return `https://${normalized}`;
    }

    static parseRating(input: string | undefined): number | undefined {
        if (!input) return undefined;
        // Handles formats: "7.5", "75%", "7.5/10", "15/20"
        const clean = input.replace(/%/g, '');
        const parts = clean.split('/');

        if (parts.length === 2) {
            const val = parseFloat(parts[0]);
            const max = parseFloat(parts[1]);
            if (isNaN(val) || isNaN(max) || max === 0) return undefined;
            return (val / max) * 10;
        }

        const val = parseFloat(clean);
        if (isNaN(val)) return undefined;

        // If it looks like a percentage (e.g. 75), convert to 0-10 scale
        if (val > 10 && !input.includes('/')) return val / 10;
        return val;
    }

    static manifestToBaseUrl(manifestUrl: string): string {
        const normalized = this.normalizeAddonUrl(manifestUrl);
        try {
            const u = new URL(normalized);
            // Drop trailing /manifest.json if present (case-insensitive)
            u.pathname = u.pathname.replace(/\/manifest\.json$/i, '');
            // Clear search and hash to get a clean base URL
            u.search = '';
            u.hash = '';
            return u.toString().replace(/\/$/, '');
        } catch (e) {
            // Fallback if URL parsing fails
            return normalized.replace(/\/manifest\.json$/i, '').replace(/\/+$/, '');
        }
    }

    private static getRootUrl(baseUrl: string): string {
        return this.manifestToBaseUrl(baseUrl);
    }

    static async fetchManifest(url: string): Promise<AddonManifest> {
        const normalizedUrl = this.normalizeAddonUrl(url);
        const response = await axios.get<AddonManifest>(normalizedUrl);
        return response.data;
    }

    static async getCatalog(
        baseUrl: string,
        type: string,
        id: string,
        extra?: Record<string, string | number | boolean | undefined | null>
    ): Promise<CatalogResponse> {
        let path = `/catalog/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;

        if (extra) {
            // Updated to handle standard Stremio extra formatting
            // Usually path keys like: /genre=Action/skip=20.json
            const extraPath = Object.entries(extra)
                .filter(([_, v]) => v !== undefined && v !== null)
                .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
                .join('/');

            if (extraPath) {
                path += `/${extraPath}`;
            }
        }

        const url = `${this.getRootUrl(baseUrl)}${path}.json`;

        try {
            const res = await axios.get<CatalogResponse>(url);

            // Pre-parse ratings for performance
            if (res.data?.metas) {
                res.data.metas = res.data.metas.map(m => ({
                    ...m,
                    numericRating: this.parseRating(m.imdbRating || m.rating)
                }));
            }

            return res.data;
        } catch (e) {
            console.error(`[AddonService] Failed ${url}`, e);
            throw e;
        }
    }

    static async getMeta(baseUrl: string, type: string, id: string): Promise<any> {
        const url = `${this.getRootUrl(baseUrl)}/meta/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
        const res = await axios.get<any>(url);
        return res.data;
    }

    static async search(baseUrl: string, type: string, query: string): Promise<CatalogResponse> {
        const url = `${this.getRootUrl(baseUrl)}/catalog/${encodeURIComponent(type)}/search=${encodeURIComponent(query)}.json`;
        const res = await axios.get<CatalogResponse>(url);

        if (res.data?.metas) {
            res.data.metas = res.data.metas.map(m => ({
                ...m,
                numericRating: this.parseRating(m.imdbRating || m.rating)
            }));
        }

        return res.data;
    }

    static async getStreams(baseUrl: string, type: string, id: string): Promise<{ streams: any[] }> {
        const url = `${this.getRootUrl(baseUrl)}/stream/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
        try {
            const res = await axios.get<{ streams: any[] }>(url);
            return res.data;
        } catch (e: any) {
            console.error(`[AddonService] getStreams failed for ${url}:`, e.message);
            return { streams: [] };
        }
    }

    static async getSubtitles(baseUrl: string, type: string, id: string): Promise<{ subtitles: any[] }> {
        const url = `${this.getRootUrl(baseUrl)}/subtitles/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
        try {
            const res = await axios.get<{ subtitles: any[] }>(url);
            return res.data;
        } catch (e) {
            return { subtitles: [] };
        }
    }

    /**
     * Fetches subtitles from multiple addons in parallel.
     * deduplicates by URL.
     */
    static async fetchAllSubtitles(addonUrls: string[], type: string, id: string): Promise<any[]> {
        const mediaType = type === 'movie' ? 'movie' : 'series';

        // 1. Fetch all manifests to see which ones support subtitles
        const manifestResults = await Promise.allSettled(
            addonUrls.map(url => this.fetchManifest(url).then(m => ({ manifest: m, baseUrl: url })))
        );

        const subtitleAddons = manifestResults
            .filter((r): r is PromiseFulfilledResult<{ manifest: AddonManifest; baseUrl: string }> => r.status === 'fulfilled')
            .map(r => (r as PromiseFulfilledResult<{ manifest: AddonManifest; baseUrl: string }>).value)
            .filter(({ manifest }) => {
                const hasSubResource = manifest.resources?.some(r => {
                    if (typeof r === 'string') return r === 'subtitles';
                    return r.name === 'subtitles';
                });

                const supportsType = manifest.types?.includes(type) || manifest.resources?.some(r =>
                    typeof r !== 'string' && r.name === 'subtitles' && r.types?.includes(type)
                );

                return hasSubResource && supportsType;
            });

        // 2. Fetch subtitles from all qualifying addons in parallel
        const subtitleResults = await Promise.allSettled(
            subtitleAddons.map(async ({ manifest, baseUrl }) => {
                try {
                    const subtitleResource = manifest.resources?.find(r =>
                        typeof r !== 'string' && r.name === 'subtitles' && (!r.types || r.types.includes(type))
                    );

                    const idPrefixes =
                        subtitleResource && typeof subtitleResource !== 'string' && Array.isArray(subtitleResource.idPrefixes)
                            ? subtitleResource.idPrefixes
                            : undefined;

                    const formattedId =
                        formatIdForIdPrefixes(id, mediaType, idPrefixes) ||
                        formatIdForIdPrefixes(id, mediaType) ||
                        id;

                    const data = await this.getSubtitles(baseUrl, type, formattedId);
                    return (data.subtitles || []).map(sub => ({
                        ...sub,
                        addonId: manifest.id,
                        addonName: manifest.name,
                        isExternal: true
                    }));
                } catch (e: any) {
                    console.error(`[AddonService] Failed to fetch from "${manifest.name}":`, e.message);
                    return [];
                }
            })
        );

        const allSubtitles = subtitleResults
            .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
            .flatMap(r => r.value);

        // 3. De-duplicate by URL
        const seen = new Set<string>();
        const deduped = allSubtitles.filter(s => {
            if (!s.url || seen.has(s.url)) return false;
            seen.add(s.url);
            return true;
        });

        return deduped;
    }

    static async searchGrouped(manifests: Record<string, AddonManifest>, type: string, query: string): Promise<Array<{ addonName: string; catalogName?: string; metas: MetaPreview[] }>> {
        const addonUrls = Object.keys(manifests);
        const candidates: Array<{ baseUrl: string; addonName: string; catalogName?: string }> = [];

        for (const url of addonUrls) {
            const m = manifests[url];
            for (const c of m.catalogs ?? []) {
                const isSearchable =
                    (c.extraSupported ?? []).includes('search') ||
                    (c.extra ?? []).some((e: any) => (typeof e === 'string' ? e === 'search' : e.name === 'search'));

                if (c.type === type && isSearchable) {
                    candidates.push({
                        baseUrl: this.getRootUrl(url),
                        addonName: m.name,
                        catalogName: c.name,
                    });
                }
            }
        }

        const results = await Promise.allSettled(
            candidates.map((c) =>
                axios.get<CatalogResponse>(`${c.baseUrl}/catalog/${encodeURIComponent(type)}/search=${encodeURIComponent(query)}.json`)
                    .then(res => res.data)
                    .catch(() => ({ metas: [] }))
            )
        );

        const grouped: Array<{ addonName: string; catalogName?: string; metas: MetaPreview[] }> = [];
        for (let i = 0; i < results.length; i++) {
            const r = results[i]!;
            const c = candidates[i]!;
            if (r.status === 'fulfilled' && r.value?.metas && r.value.metas.length > 0) {
                grouped.push({
                    addonName: c.addonName,
                    catalogName: c.catalogName,
                    metas: r.value.metas
                });
            }
        }

        return grouped;
    }
}
