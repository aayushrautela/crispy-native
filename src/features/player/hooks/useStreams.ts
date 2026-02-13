import { AddonService } from '@/src/core/services/AddonService';
import { useUserStore } from '@/src/core/stores/userStore';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';

export const useStreams = (type: string, id: string, enabled: boolean = true) => {
    const addons = useUserStore((state) => state.addons);
    const manifests = useUserStore((state) => state.manifests);
    const [streams, setStreams] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const streamAddonUrls = useMemo(() => {
        return addons
            .map((addon) => {
                const m = manifests[addon.url];
                const supportsStreams = m?.resources?.some((r) =>
                    typeof r === 'string' ? r === 'stream' : r?.name === 'stream'
                );
                return supportsStreams ? addon.url : null;
            })
            .filter((url): url is string => Boolean(url));
    }, [addons, manifests]);

    const { refetch } = useQuery({
        queryKey: ['streams', type, id, addons.length, Object.keys(manifests).length, streamAddonUrls],
        queryFn: async () => {
            // Reset streams for new fetch
            setStreams([]);
            setIsLoading(true);

            if (addons.length === 0) {
                console.warn('[useStreams] No addons installed');
                setIsLoading(false);
                return [];
            }

            if (streamAddonUrls.length === 0) {
                const missingManifestCount = addons.filter((addon) => !manifests[addon.url]).length;

                if (missingManifestCount > 0) {
                    // Keep loading state so UI does not incorrectly show an empty result while manifests are still syncing
                    console.warn(`[useStreams] Waiting for ${missingManifestCount} addon manifests`);
                    return [];
                }

                console.warn('[useStreams] No addons support "stream" resource');
                setIsLoading(false);
                return [];
            }

            // Fetch from each addon individually and update state as they complete
            const fetchPromises = streamAddonUrls.map(async (url) => {
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
            return [];
        },
        enabled: enabled && !!id,
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false,
        refetchOnReconnect: 'always',
    });

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
