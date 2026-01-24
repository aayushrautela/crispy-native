import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { AddonService } from '../services/AddonService';
import { useAddonStore } from '../stores/addonStore';
import { AddonManifest } from '../types/addon-types';

export const useCatalog = (type: string, id: string, extra?: Record<string, any>, addonUrl?: string) => {
    const { manifests } = useAddonStore();

    // Determine which addon(s) to fetch from
    const targetUrls = useMemo(() => {
        console.log('[useCatalog] manifests:', manifests);
        if (!manifests || typeof manifests !== 'object') return [];
        const safeManifests = manifests as Record<string, AddonManifest>;

        if (addonUrl) return [addonUrl];

        const filtered = Object.keys(safeManifests).filter(url =>
            safeManifests[url]?.catalogs?.some(c => c.type === type && c.id === id)
        );
        // console.log('[useCatalog] targetUrls:', filtered, 'type:', type, 'id:', id);
        return filtered;
    }, [manifests, type, id, addonUrl]);

    return useQuery({
        queryKey: ['catalog', type, id, extra, targetUrls],
        queryFn: async () => {
            const results = await Promise.allSettled(
                targetUrls.map(url => AddonService.getCatalog(url, type, id, extra))
            );

            // Filter successful results and log failures
            const metas = results.flatMap((r, idx) => {
                if (r.status === 'fulfilled') return r.value.metas || [];
                console.error(`[useCatalog] Failed to fetch catalog from ${targetUrls[idx]}:`, r.reason);
                return [];
            });

            // ID deduplication while preserving order
            const seen = new Set<string>();
            const uniqueMetas = metas.filter(m => {
                if (!m?.id || seen.has(m.id)) return false;
                seen.add(m.id);
                return true;
            });

            return { metas: uniqueMetas };
        },
        enabled: !!type && !!id && ((targetUrls?.length || 0) > 0),
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
