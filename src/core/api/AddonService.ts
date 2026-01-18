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
    private static proxyAvailable: boolean | null = null;

    private static async checkProxy(): Promise<boolean> {
        if (this.proxyAvailable !== null) return this.proxyAvailable;
        try {
            const res = await axios.get(`${STREAMING_SERVER_URL}/stats.json`, { timeout: 1000 });
            this.proxyAvailable = res.status === 200;
        } catch {
            this.proxyAvailable = false;
        }
        return this.proxyAvailable;
    }

    private static getProxyUrl(url: string): string {
        const parsed = new URL(url);
        return `${STREAMING_SERVER_URL}/proxy/d=${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
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
        const query = extra ? '?' + new URLSearchParams(extra as any).toString() : '';
        const url = `${baseUrl.replace(/\/manifest\.json$/, '')}/catalog/${type}/${id}.json${query}`;

        try {
            const res = await axios.get<CatalogResponse>(url);
            return res.data;
        } catch (e) {
            if (await this.checkProxy()) {
                const proxyRes = await axios.get<CatalogResponse>(this.getProxyUrl(url));
                return proxyRes.data;
            }
            throw e;
        }
    }

    static async getMeta(baseUrl: string, type: string, id: string): Promise<any> {
        const url = `${baseUrl.replace(/\/manifest\.json$/, '')}/meta/${type}/${id}.json`;
        try {
            const res = await axios.get<any>(url);
            return res.data;
        } catch (e) {
            if (await this.checkProxy()) {
                const proxyRes = await axios.get<any>(this.getProxyUrl(url));
                return proxyRes.data;
            }
            throw e;
        }
    }

    static async search(baseUrl: string, type: string, query: string): Promise<CatalogResponse> {
        const url = `${baseUrl.replace(/\/manifest\.json$/, '')}/catalog/${type}/search=${encodeURIComponent(query)}.json`;
        try {
            const res = await axios.get<CatalogResponse>(url);
            return res.data;
        } catch (e) {
            if (await this.checkProxy()) {
                const proxyRes = await axios.get<CatalogResponse>(this.getProxyUrl(url));
                return proxyRes.data;
            }
            throw e;
        }
    }
}
