import { useUserStore } from '@/src/core/stores/userStore';
import { useCallback, useEffect, useRef, useState } from 'react';
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
    addonUrl?: string
): PaginatedCatalogResult => {
    const { manifests } = useUserStore();
    const [items, setItems] = useState<MetaPreview[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const skipRef = useRef(0);
    const seenIdsRef = useRef(new Set<string>());
    const isMountedRef = useRef(true);

    // Find target addon URLs
    const getTargetUrls = useCallback(() => {
        if (!manifests || typeof manifests !== 'object') return [];
        if (addonUrl) return [addonUrl];

        return Object.keys(manifests).filter(url =>
            manifests[url]?.catalogs?.some(c => c.type === type && c.id === id)
        );
    }, [manifests, type, id, addonUrl]);

    const fetchPage = useCallback(async (skip: number, isInitial: boolean) => {
        const targetUrls = getTargetUrls();
        if (targetUrls.length === 0) return { metas: [], hasMore: false };

        const currentExtra = { ...extra, skip };

        const results = await Promise.allSettled(
            targetUrls.map(url => AddonService.getCatalog(url, type, id, currentExtra))
        );

        const metas = results.flatMap((r, idx) => {
            if (r.status === 'fulfilled') return r.value.metas || [];
            console.error(`[usePaginatedCatalog] Failed to fetch (skip=${skip}) from ${targetUrls[idx]}:`, r.reason);
            return [];
        });

        // Deduplicate
        const uniqueMetas = metas.filter(m => {
            if (!m?.id || seenIdsRef.current.has(m.id)) return false;
            seenIdsRef.current.add(m.id);
            return true;
        });

        return {
            metas: uniqueMetas,
            rawCount: metas.length,
            hasMore: metas.length >= PAGE_SIZE
        };
    }, [getTargetUrls, type, id, extra]);

    const loadInitial = useCallback(async () => {
        if (!type || !id) return;

        setIsLoading(true);
        seenIdsRef.current.clear();
        skipRef.current = 0;

        try {
            const result = await fetchPage(0, true);
            if (isMountedRef.current) {
                setItems(result.metas);
                setHasMore(result.hasMore);
                skipRef.current = result.rawCount;
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [type, id, fetchPage]);

    const fetchMore = useCallback(async () => {
        if (!hasMore || isFetchingMore || isLoading) return;

        setIsFetchingMore(true);

        try {
            const result = await fetchPage(skipRef.current, false);
            if (isMountedRef.current) {
                setItems(prev => [...prev, ...result.metas]);
                setHasMore(result.hasMore);
                skipRef.current += result.rawCount;
            }
        } finally {
            if (isMountedRef.current) {
                setIsFetchingMore(false);
            }
        }
    }, [hasMore, isFetchingMore, isLoading, fetchPage]);

    useEffect(() => {
        isMountedRef.current = true;
        const targetUrls = getTargetUrls();
        if (type && id && targetUrls.length > 0) {
            loadInitial();
        } else {
            setIsLoading(false);
        }
        return () => {
            isMountedRef.current = false;
        };
    }, [type, id, loadInitial, getTargetUrls]);

    return {
        items,
        isLoading,
        isFetchingMore,
        hasMore,
        fetchMore,
        refetch: loadInitial,
    };
};
