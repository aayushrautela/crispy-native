import { useUserStore } from '@/src/core/stores/userStore';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { AddonService, MetaPreview } from '../services/AddonService';

const PAGE_SIZE = 20;

interface PaginatedCatalogResult {
    items: MetaPreview[];
    isLoading: boolean;
    isFetchingMore: boolean;
    hasMore: boolean;
    fetchMore: () => void;
    refetch: () => void;
}

export const usePaginatedCatalog = (
    type: string,
    id: string,
    extra?: Record<string, any>,
    addonUrl?: string,
    enabled = true
): PaginatedCatalogResult => {
    const { manifests } = useUserStore();

    // Determine target URLs
    const targetUrls = useMemo(() => {
        if (!manifests || typeof manifests !== 'object') return [];
        if (addonUrl) return [addonUrl];

        return Object.keys(manifests).filter(url =>
            manifests[url]?.catalogs?.some(c => c.type === type && c.id === id)
        );
    }, [manifests, type, id, addonUrl]);

    const {
        data,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        refetch
    } = useInfiniteQuery({
        queryKey: ['catalog', 'paginated', type, id, extra, targetUrls],
        queryFn: async ({ pageParam = 0 }) => {
            const currentExtra = { ...extra, skip: pageParam };

            if (targetUrls.length === 0) {
                return { metas: [], nextSkip: undefined };
            }

            const results = await Promise.allSettled(
                targetUrls.map(url => AddonService.getCatalog(url, type, id, currentExtra))
            );

            const metas = results.flatMap((r, idx) => {
                if (r.status === 'fulfilled') return r.value.metas || [];
                console.error(`[usePaginatedCatalog] Failed to fetch (skip=${pageParam}) from ${targetUrls[idx]}:`, r.reason);
                return [];
            });

            // If we got fewer items than requested, we likely reached the end
            // However, with multiple addons, it's safer to rely on returned count
            const hasMore = metas.length >= Math.max(PAGE_SIZE, 1);

            return {
                metas,
                nextSkip: hasMore ? pageParam + metas.length : undefined
            };
        },
        getNextPageParam: (lastPage) => lastPage.nextSkip,
        initialPageParam: 0,
        enabled: enabled && !!type && !!id && targetUrls.length > 0,
        staleTime: 1000 * 60 * 30, // 30 minutes
        gcTime: 1000 * 60 * 60, // 1 hour (formerly cacheTime)
    });

    const items = useMemo(() => {
        if (!data?.pages) return [];

        // Flatten and dedupe across all pages
        const allMetas = data.pages.flatMap(page => page.metas);
        const seen = new Set<string>();
        return allMetas.filter(m => {
            if (!m?.id || seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
        });
    }, [data?.pages]);

    return {
        items,
        isLoading,
        isFetchingMore: isFetchingNextPage,
        hasMore: !!hasNextPage,
        fetchMore: fetchNextPage,
        refetch,
    };
};
