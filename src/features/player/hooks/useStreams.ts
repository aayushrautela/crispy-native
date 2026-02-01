import { AddonService } from '@/src/core/services/AddonService';
import { useUserStore } from '@/src/core/stores/userStore';
import { useQuery } from '@tanstack/react-query';

export const useStreams = (type: string, id: string, enabled: boolean = true) => {
    const { manifests } = useUserStore();

    return useQuery({
        queryKey: ['streams', type, id],
        queryFn: async () => {
            console.log(`[useStreams] Fetching streams for type: ${type}, id: ${id}`);
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
                return [];
            }

            const results = await Promise.allSettled(
                streamAddons.map(url => {
                    return AddonService.getStreams(url, type, id);
                })
            );

            const fetchedStreams = results
                .filter((r): r is PromiseFulfilledResult<{ streams: any[] }> => r.status === 'fulfilled')
                .flatMap(r => r.value.streams || [])
                .filter(Boolean);

            console.log(`[useStreams] Found ${fetchedStreams.length} streams`);
            return fetchedStreams;
        },
        enabled: enabled && !!id,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};
