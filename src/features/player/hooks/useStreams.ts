import { AddonService } from '@/src/core/services/AddonService';
import { useUserStore } from '@/src/core/stores/userStore';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';

export const useStreams = (type: string, id: string, enabled: boolean = true) => {
    const manifests = useUserStore((state) => state.manifests);
    const [streams, setStreams] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const { refetch } = useQuery({
        queryKey: ['streams', type, id],
        queryFn: async () => {
            // Reset streams for new fetch
            setStreams([]);
            setIsLoading(true);

            const addonUrls = Object.keys(manifests);

            const streamAddons = addonUrls.filter(url => {
                const m = manifests[url];
                const supportsStreams = m?.resources?.some(r =>
                    typeof r === 'string' ? r === 'stream' : r?.name === 'stream'
                );
                return supportsStreams;
            });

            if (streamAddons.length === 0) {
                console.warn('[useStreams] No addons support "stream" resource');
                setIsLoading(false);
                return [];
            }

            // Create new abort controller for this request
            abortControllerRef.current = new AbortController();

            // Fetch from each addon individually and update state as they complete
            const fetchPromises = streamAddons.map(async (url) => {
                try {
                    const result = await AddonService.getStreams(url, type, id);
                    if (result?.streams && result.streams.length > 0) {
                        // Add new streams incrementally
                        setStreams(prev => {
                            const newStreams = result.streams.filter(Boolean);
                            const existingUrls = new Set(prev.map(s => s.url || s.id || s.infoHash));
                            const uniqueNewStreams = newStreams.filter(s => {
                                const key = s.url || s.id || s.infoHash;
                                return !existingUrls.has(key);
                            });
                            return [...prev, ...uniqueNewStreams];
                        });
                    }
                    return result;
                } catch (error) {
                    console.warn(`[useStreams] Failed to fetch from ${url}:`, error);
                    return null;
                }
            });

            // Wait for all to complete
            await Promise.allSettled(fetchPromises);
            
            setIsLoading(false);
            return streams;
        },
        enabled: enabled && !!id,
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
    });

    // Cleanup abort controller on unmount
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    // Reset streams when id/type changes
    useEffect(() => {
        if (!enabled || !id) {
            setStreams([]);
            setIsLoading(false);
        }
    }, [id, type, enabled]);

    return {
        data: streams,
        isLoading,
        refetch,
    };
};
