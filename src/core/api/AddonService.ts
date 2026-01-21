import axios from 'axios';
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
    airDate?: string;
    logo?: string;
    genres?: string[];
}

export interface CatalogResponse {
    metas: MetaPreview[];
}

export interface ResourceResponse<T> {
    [key: string]: T;
}

const STREAMING_SERVER_URL = 'http://127.0.0.1:11470';

export class AddonService {
    private static getRootUrl(baseUrl: string): string {
        // Strip manifest.json and any trailing slashes to prevent double slashes
        return baseUrl.replace(/\/manifest\.json$/, '').replace(/\/+$/, '');
    }

    static async fetchManifest(url: string): Promise<AddonManifest> {
        const response = await axios.get<AddonManifest>(url);
        return response.data;
    }

    static async getCatalog(
        baseUrl: string,
        type: string,
        id: string,
        extra?: Record<string, string | number | boolean | undefined | null>
    ): Promise<CatalogResponse> {
        let path = `/catalog/${type}/${id}`;

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

        const url = `${AddonService.getRootUrl(baseUrl)}${path}.json`;
        console.log(`[AddonService] Fetching catalog: ${url}`);

        try {
            const res = await axios.get<CatalogResponse>(url);
            console.log(`[AddonService] Success ${url}, items: ${res.data?.metas?.length}`);
            return res.data;
        } catch (e) {
            console.error(`[AddonService] Failed ${url}`, e);
            throw e;
        }
    }

    static async getMeta(baseUrl: string, type: string, id: string): Promise<any> {
        const url = `${AddonService.getRootUrl(baseUrl)}/meta/${type}/${id}.json`;
        const res = await axios.get<any>(url);
        return res.data;
    }

    static async search(baseUrl: string, type: string, query: string): Promise<CatalogResponse> {
        const url = `${AddonService.getRootUrl(baseUrl)}/catalog/${type}/search=${encodeURIComponent(query)}.json`;
        const res = await axios.get<CatalogResponse>(url);
        return res.data;
    }

    static async getStreams(baseUrl: string, type: string, id: string): Promise<{ streams: any[] }> {
        const url = `${AddonService.getRootUrl(baseUrl)}/stream/${type}/${encodeURIComponent(id)}.json`;
        console.log(`[AddonService] getStreams URL: ${url}`);
        try {
            const res = await axios.get<{ streams: any[] }>(url);
            console.log(`[AddonService] getStreams ${url} status: ${res.status}, count: ${res.data?.streams?.length || 0}`);
            if (res.data && Array.isArray(res.data.streams)) {
                return res.data;
            }
            return { streams: [] };
        } catch (e: any) {
            console.error(`[AddonService] getStreams failed for ${url}:`, e.message);
            return { streams: [] };
        }
    }

    static async getSubtitles(baseUrl: string, type: string, id: string): Promise<{ subtitles: any[] }> {
        const url = `${AddonService.getRootUrl(baseUrl)}/subtitles/${type}/${encodeURIComponent(id)}.json`;
        try {
            const res = await axios.get<{ subtitles: any[] }>(url);
            return res.data;
        } catch (e) {
            return { subtitles: [] };
        }
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
                        baseUrl: AddonService.getRootUrl(url),
                        addonName: m.name,
                        catalogName: c.name,
                    });
                }
            }
        }

        const results = await Promise.allSettled(
            candidates.map((c) =>
                axios.get<CatalogResponse>(`${c.baseUrl}/catalog/${type}/search=${encodeURIComponent(query)}.json`)
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
