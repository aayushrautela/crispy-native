import { useQuery } from '@tanstack/react-query';
import { AddonService, CatalogResponse } from '../api/AddonService';
import { useAddonStore } from '../stores/addonStore';

export const useCatalog = (type: string, id: string, extra?: Record<string, any>) => {
    const { manifests } = useAddonStore();

    // Find addons that support this catalog
    const addonUrls = Object.keys(manifests).filter(url =>
        manifests[url].catalogs?.some(c => c.type === type && c.id === id)
    );

    return useQuery({
        queryKey: ['catalog', type, id, extra, addonUrls],
        queryFn: async () => {
            const results = await Promise.allSettled(
                addonUrls.map(url => AddonService.getCatalog(url, type, id, extra))
            );

            const metas = results
                .filter((r): r is PromiseFulfilledResult<CatalogResponse> => r.status === 'fulfilled')
                .flatMap(r => r.value.metas);

            // Simple ID deduplication
            const seen = new Set();
            return {
                metas: metas.filter(m => {
                    if (seen.has(m.id)) return false;
                    seen.add(m.id);
                    return true;
                })
            };
        },
        enabled: addonUrls.length > 0,
    });
};

export const useMeta = (type: string, id: string) => {
    const { manifests } = useAddonStore();
    const addonUrls = Object.keys(manifests);

    return useQuery({
        queryKey: ['meta', type, id],
        queryFn: async () => {
            // For meta, we usually try addons in order or if they support the type
            for (const url of addonUrls) {
                try {
                    const res = await AddonService.getMeta(url, type, id);
                    if (res?.meta) return res.meta;
                } catch {
                    // Meta fetch failed for this addon, try next
                    continue;
                }
            }
            throw new Error('Meta not found');
        },
        enabled: addonUrls.length > 0,
    });
};
