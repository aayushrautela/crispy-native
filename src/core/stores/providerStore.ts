import { useUserStore } from '@/src/core/stores/userStore';
import { create } from 'zustand';
import { AddonService, CatalogResponse, MetaPreview } from '../services/AddonService';

interface ProviderState {
    catalogs: MetaPreview[];
    selectedMeta: any | null;
    isLoading: boolean;
    error: string | null;
    fetchHomeCatalogs: (type: string, id: string) => Promise<void>;
    searchAll: (type: string, query: string) => Promise<void>;
    fetchMeta: (type: string, id: string) => Promise<void>;
    getStreams: (type: string, id: string) => Promise<any[]>;
}

export const useProviderStore = create<ProviderState>((set, get) => ({
    catalogs: [],
    selectedMeta: null,
    isLoading: false,
    error: null,

    fetchHomeCatalogs: async (type, id) => {
        set({ isLoading: true, error: null });
        const { addons, manifests } = useUserStore.getState();

        try {
            // Aggregate from all enabled addons that have this catalog
            const promises = addons.map(addon => {
                const manifest = manifests[addon.url];
                if (manifest?.catalogs?.some(c => c.type === type && c.id === id)) {
                    return AddonService.getCatalog(addon.url, type, id);
                }
                return null;
            }).filter(p => p !== null) as Promise<CatalogResponse>[];

            const results = await Promise.allSettled(promises);
            const allMetas: MetaPreview[] = [];

            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value.metas) {
                    allMetas.push(...result.value.metas);
                }
            });

            // De-dupe by ID
            const seen = new Set<string>();
            const dedupedMetas = allMetas.filter(m => {
                if (seen.has(m.id)) return false;
                seen.add(m.id);
                return true;
            });

            set({ catalogs: dedupedMetas, isLoading: false });
        } catch (e) {
            set({ error: (e as Error).message, isLoading: false });
        }
    },

    searchAll: async (type, query) => {
        set({ isLoading: true, error: null });
        const { addons, manifests } = useUserStore.getState();

        try {
            const promises = addons.map(addon => {
                const manifest = manifests[addon.url];
                const hasSearch = manifest?.catalogs?.some(c => c.type === type);
                if (hasSearch) {
                    return AddonService.search(addon.url, type, query);
                }
                return null;
            }).filter(p => p !== null) as Promise<CatalogResponse>[];

            const results = await Promise.allSettled(promises);
            const allMetas: MetaPreview[] = [];

            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value.metas) {
                    allMetas.push(...result.value.metas);
                }
            });

            const seen = new Set<string>();
            const dedupedMetas = allMetas.filter(m => {
                if (seen.has(m.id)) return false;
                seen.add(m.id);
                return true;
            });

            set({ catalogs: dedupedMetas, isLoading: false });
        } catch (e) {
            set({ error: (e as Error).message, isLoading: false });
        }
    },

    fetchMeta: async (type, id) => {
        set({ isLoading: true, error: null, selectedMeta: null });
        const { addons } = useUserStore.getState();

        try {
            // Usually we only need one meta response, prioritizing the "best" addon (e.g. Cinemeta)
            // For now, try sequentially or take first success
            const promises = addons.map(addon => {
                return AddonService.getMeta(addon.url, type, id);
            });

            const results = await Promise.allSettled(promises);
            let meta: any = null;

            for (const result of results) {
                if (result.status === 'fulfilled' && result.value.meta) {
                    meta = result.value.meta;
                    break;
                }
            }

            if (!meta) {
                throw new Error('Meta not found');
            }

            set({ selectedMeta: meta, isLoading: false });
        } catch (e) {
            set({ error: (e as Error).message, isLoading: false });
        }
    },

    getStreams: async (type, id) => {
        const { addons, manifests } = useUserStore.getState();

        const normalizedType = type === 'show' ? 'series' : type;

        const promises = addons.map(addon => {
            const manifest = manifests[addon.url];
            if (!manifest) return null;

            const hasStreamResource = manifest?.resources?.some(r =>
                (typeof r === 'string' ? r === 'stream' : r.name === 'stream')
            );

            const supportsType =
                manifest.types?.includes(normalizedType) ||
                manifest.resources?.some(r =>
                    typeof r !== 'string' && r.name === 'stream' && r.types?.includes(normalizedType)
                );

            if (!hasStreamResource || !supportsType) return null;

            const addonName = manifest.name || addon.url;
            return AddonService.getStreams(addon.url, normalizedType, id).then((res) => ({
                streams: (res.streams || []).map(s => ({
                    ...s,
                    addonName,
                    addonUrl: addon.url,
                    addonId: manifest.id,
                }))
            }));
        }).filter(p => p !== null) as Promise<{ streams: any[] }>[];

        const results = await Promise.allSettled(promises);
        const allStreams: any[] = [];

        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.streams) {
                allStreams.push(...result.value.streams);
            }
        });

        // De-dupe for stable UX (many addons return identical magnet URLs)
        const seen = new Set<string>();
        const deduped = allStreams.filter((s: any) => {
            const key =
                (typeof s?.url === 'string' && s.url) ||
                (s?.infoHash ? `infoHash:${s.infoHash}:${s.fileIdx ?? ''}` : '') ||
                `${s?.addonId ?? s?.addonName ?? ''}:${s?.name ?? s?.title ?? ''}`;
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Prefer higher-seeded results first when available
        deduped.sort((a: any, b: any) => {
            const sa = typeof a?.seeders === 'number' ? a.seeders : -1;
            const sb = typeof b?.seeders === 'number' ? b.seeders : -1;
            return sb - sa;
        });

        return deduped;
    }
}));
