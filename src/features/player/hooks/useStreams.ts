import { getStreams } from '@/src/core/addons/addonClient';
import { useUserStore } from '@/src/core/stores/userStore';
import { formatIdForIdPrefixes } from '@crispy-streaming/media-core';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';

type StremioType = 'movie' | 'series';
type StreamResource = string | { name?: string; types?: string[]; idPrefixes?: string[] };

function pickStreamResource(resources: StreamResource[] | undefined, type: StremioType): StreamResource | null {
    if (!resources || resources.length === 0) return null;

    let hasStreamString = false;

    for (const r of resources) {
        if (typeof r === 'string') {
            if (r === 'stream') hasStreamString = true;
            continue;
        }

        if (r?.name !== 'stream') continue;
        if (Array.isArray(r.types) && r.types.length > 0 && !r.types.includes(type)) continue;
        return r;
    }

    return hasStreamString ? 'stream' : null;
}

export const useStreams = (type: string, id: string, enabled: boolean = true) => {
    const addons = useUserStore((state) => state.addons);
    const manifests = useUserStore((state) => state.manifests);
    const [streams, setStreams] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const stremioType = useMemo<StremioType>(() => (type === 'movie' ? 'movie' : 'series'), [type]);

    const enabledAddons = useMemo(() => addons.filter((a) => a.enabled !== false), [addons]);

    const streamAddons = useMemo(() => {
        const out: { url: string; idPrefixes?: string[] }[] = [];

        for (const addon of enabledAddons) {
            const m = manifests[addon.url];
            const streamResource = pickStreamResource(m?.resources as StreamResource[] | undefined, stremioType);
            if (!streamResource) continue;

            if (typeof streamResource === 'string') {
                out.push({ url: addon.url });
                continue;
            }

            const idPrefixes = Array.isArray(streamResource.idPrefixes) ? streamResource.idPrefixes : undefined;
            out.push({ url: addon.url, idPrefixes });
        }

        return out;
    }, [enabledAddons, manifests, stremioType]);

    const { refetch } = useQuery({
        queryKey: ['streams', stremioType, id, enabledAddons.length, Object.keys(manifests).length, streamAddons],
        queryFn: async () => {
            // Reset streams for new fetch
            setStreams([]);
            setIsLoading(true);

            if (enabledAddons.length === 0) {
                console.warn('[useStreams] No enabled addons');
                setIsLoading(false);
                return [];
            }

            if (streamAddons.length === 0) {
                const missingManifestCount = enabledAddons.filter((addon) => !manifests[addon.url]).length;

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
            const fetchPromises = streamAddons.map(async ({ url, idPrefixes }) => {
                try {
                    const formattedId =
                        formatIdForIdPrefixes(id, stremioType, idPrefixes) ||
                        formatIdForIdPrefixes(id, stremioType) ||
                        id;

                    const result = await getStreams(url, stremioType, formattedId, manifests[url]);
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
