import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { AddonService, MetaPreview } from '../services/AddonService';
import { useAddonStore } from '../stores/addonStore';

export interface Meta extends MetaPreview {
    background?: string;
    logo?: string;
    description?: string;
    releaseInfo?: string;
    rating?: string;
    genres?: string[];
    released?: string;
    runtime?: string;
}

export const useHeroItems = (enabled: boolean = true) => {
    const { manifests } = useAddonStore();

    // 1. Identify "hero" catalogs across all installed addons
    const heroCatalogs = useMemo(() => {
        return Object.entries(manifests).flatMap(([url, manifest]) =>
            (manifest.catalogs || [])
                .filter(cat =>
                    cat.id === 'top' ||
                    cat.id.includes('hero') ||
                    cat.id === 'trending' ||
                    (cat.type === 'movie' && cat.id === 'popular')
                )
                .map(catalog => ({
                    ...catalog,
                    addonUrl: url
                }))
        );
    }, [manifests]);

    const heroSignature = useMemo(() =>
        heroCatalogs.map(c => `${c.addonUrl}:${c.id}`).sort().join('|'),
        [heroCatalogs]);

    return useQuery({
        queryKey: ['hero_items', heroSignature],
        queryFn: async () => {
            if (heroCatalogs.length === 0) return [];

            // 2. Fetch basic items from hero catalogs
            const catalogResults = await Promise.allSettled(
                heroCatalogs.slice(0, 5).map(cat =>
                    AddonService.getCatalog(cat.addonUrl, cat.type, cat.id)
                )
            );

            const allItems: (MetaPreview & { addonUrl: string })[] = [];
            catalogResults.forEach((res, idx) => {
                if (res.status === 'fulfilled' && res.value.metas) {
                    allItems.push(...res.value.metas.map(m => ({
                        ...m,
                        addonUrl: heroCatalogs[idx].addonUrl
                    })));
                }
            });

            if (allItems.length === 0) return [];

            // 3. Randomly shuffle and pick 10 candidates
            const candidates = allItems
                .sort(() => 0.5 - Math.random())
                .slice(0, 15);

            // 4. Resolve full metadata for candidates to get backdrop/logo
            const fullMetas = await Promise.allSettled(
                candidates.map(item =>
                    AddonService.getMeta(item.addonUrl, item.type, item.id)
                )
            );

            const validMetas: Meta[] = [];
            fullMetas.forEach(res => {
                if (res.status === 'fulfilled' && res.value.meta) {
                    const meta = res.value.meta;
                    // Only include items that have both a background and a logo/name
                    if (meta.background && (meta.logo || meta.name)) {
                        validMetas.push(meta);
                    }
                }
            });

            // Return top 10 valid ones
            return validMetas.slice(0, 10);
        },
        enabled: enabled && heroCatalogs.length > 0,
        staleTime: 1000 * 60 * 60, // 1 hour - hero items don't change that often
    });
};
