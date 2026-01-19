import { useQuery } from '@tanstack/react-query';
import { AddonService } from '../api/AddonService';
import { useAddonStore } from '../stores/addonStore';

export const useCatalog = (type: string, id: string, extra?: Record<string, any>, addonUrl?: string) => {
    const { manifests } = useAddonStore();

    // Determine which addon(s) to fetch from
    const targetUrls = useMemo(() => {
        if (addonUrl) return [addonUrl];

        // Fallback: find all addons that support this catalog
        return Object.keys(manifests).filter(url =>
            manifests[url].catalogs?.some(c => c.type === type && c.id === id)
        );
    }, [manifests, type, id, addonUrl]);

    return useQuery({
        queryKey: ['catalog', type, id, extra, targetUrls],
        queryFn: async () => {
            const results = await Promise.allSettled(
                targetUrls.map(url => AddonService.getCatalog(url, type, id, extra))
            );

            // Filter successful results and log failures
            const successfulResults = results.map((r, idx) => {
                if (r.status === 'fulfilled') return r.value.metas || [];
                console.error(`[useCatalog] Failed to fetch catalog from ${targetUrls[idx]}:`, r.reason);
                return [];
            });

            const metas = successfulResults.flat();

            // ID deduplication while preserving order
            const seen = new Set<string>();
            const uniqueMetas = metas.filter(m => {
                if (!m?.id || seen.has(m.id)) return false;
                seen.add(m.id);
                return true;
            });

            return { metas: uniqueMetas };
        },
        enabled: targetUrls.length > 0,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
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

import { useMemo } from 'react';
