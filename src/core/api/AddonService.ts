import axios from 'axios';
import { AddonManifest } from '../stores/addonStore';

export interface MetaPreview {
    id: string;
    type: string;
    name: string;
    poster?: string;
    posterShape?: 'poster' | 'landscape' | 'square';
    description?: string;
}

export interface CatalogResponse {
    metas: MetaPreview[];
}

export interface ResourceResponse<T> {
    [key: string]: T;
}

const STREAMING_SERVER_URL = 'http://127.0.0.1:11470';

export class AddonService {
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
        const query = extra ? '?' + new URLSearchParams(extra as any).toString() : '';
        const url = `${baseUrl.replace(/\/manifest\.json$/, '')}/catalog/${type}/${id}.json${query}`;

        const res = await axios.get<CatalogResponse>(url);
        return res.data;
    }

    static async getMeta(baseUrl: string, type: string, id: string): Promise<any> {
        const url = `${baseUrl.replace(/\/manifest\.json$/, '')}/meta/${type}/${id}.json`;
        const res = await axios.get<any>(url);
        return res.data;
    }

    static async search(baseUrl: string, type: string, query: string): Promise<CatalogResponse> {
        const url = `${baseUrl.replace(/\/manifest\.json$/, '')}/catalog/${type}/search=${encodeURIComponent(query)}.json`;
        const res = await axios.get<CatalogResponse>(url);
        return res.data;
    }

    static async getStreams(baseUrl: string, type: string, id: string): Promise<{ streams: any[] }> {
        const url = `${baseUrl.replace(/\/manifest\.json$/, '')}/stream/${type}/${encodeURIComponent(id)}.json`;
        try {
            const res = await axios.get<{ streams: any[] }>(url);
            if (res.data && Array.isArray(res.data.streams)) {
                return res.data;
            }
            return { streams: [] };
        } catch (e) {
            return { streams: [] };
        }
    }

    static async getSubtitles(baseUrl: string, type: string, id: string): Promise<{ subtitles: any[] }> {
        const url = `${baseUrl.replace(/\/manifest\.json$/, '')}/subtitles/${type}/${encodeURIComponent(id)}.json`;
        try {
            const res = await axios.get<{ subtitles: any[] }>(url);
            return res.data;
        } catch (e) {
            return { subtitles: [] };
        }
    }
}
