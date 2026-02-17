import { getStreams } from '@/src/core/addons/addonClient';
import { useUserStore } from '@/src/core/stores/userStore';
import type { AddonManifest } from '@/src/core/types/addon-types';
import type { Stream, StreamListItem } from '@/src/features/player/types/streams';
import { computeStreamAddons, type StremioType, type StreamAddon } from '@/src/features/player/streams/streamAddons';
import { formatIdForIdPrefixes } from '@crispy-streaming/media-core';
import {
    useQuery,
    useQueryClient,
    type QueryClient,
    type QueryFunctionContext,
    type QueryKey,
} from '@tanstack/react-query';
import { useMemo } from 'react';

function hashStringFNV1a(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        // hash *= 16777619 (with overflow)
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    // unsigned 32-bit -> base36
    return (hash >>> 0).toString(36);
}

function computeBaseStreamKey(stream: Stream, streamIndex: number): string {
    if (typeof stream.url === 'string' && stream.url.length > 0) return `url:${stream.url}`;

    if (typeof stream.infoHash === 'string' && stream.infoHash.length > 0) {
        const fileIdx = typeof stream.fileIdx === 'number' ? String(stream.fileIdx) : '';
        return `torrent:${stream.infoHash}:${fileIdx}`;
    }

    const maybeId = (stream as { id?: unknown }).id;
    if (typeof maybeId === 'string' && maybeId.length > 0) return `id:${maybeId}`;
    if (typeof maybeId === 'number') return `id:${String(maybeId)}`;

    const basis = [stream.name, stream.title, stream.description].filter(Boolean).join('|');
    return `fallback:${hashStringFNV1a(basis)}:${streamIndex}`;
}

function mergeStreams(prev: StreamListItem[], incoming: StreamListItem[]): StreamListItem[] {
    const map = new Map<string, StreamListItem>();

    for (const item of prev) map.set(item._streamKey, item);

    for (const next of incoming) {
        const existing = map.get(next._streamKey);
        if (!existing) {
            map.set(next._streamKey, next);
            continue;
        }

        // Prefer stable ordering (lower addon rank). If same, prefer earlier stream rank.
        if (next._addonRank < existing._addonRank) {
            map.set(next._streamKey, next);
            continue;
        }
        if (next._addonRank === existing._addonRank && next._streamRank < existing._streamRank) {
            map.set(next._streamKey, next);
        }
    }

    const out = Array.from(map.values());
    out.sort((a, b) => {
        if (a._addonRank !== b._addonRank) return a._addonRank - b._addonRank;
        if (a._streamRank !== b._streamRank) return a._streamRank - b._streamRank;
        return a._streamKey.localeCompare(b._streamKey);
    });
    return out;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`[useStreams] Timeout (${ms}ms): ${label}`));
        }, ms);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timer) clearTimeout(timer);
    });
}

// computeStreamAddons moved to src/features/player/streams/streamAddons.ts

export function streamsQueryKey(params: { type: StremioType; id: string; addonFingerprints: string[] }): QueryKey {
    return ['streams', params.type, params.id, params.addonFingerprints];
}

function createStreamsQueryFn(args: {
    queryClient: QueryClient;
    queryKey: QueryKey;
    type: StremioType;
    id: string;
    streamAddons: StreamAddon[];
    manifests: Record<string, AddonManifest>;
}) {
    const { queryClient, queryKey, type, id, streamAddons, manifests } = args;

    return async ({ signal }: QueryFunctionContext<QueryKey>): Promise<StreamListItem[]> => {
        const perAddonTimeoutMs = 12_000;

        const fetches = streamAddons.map(async (addon, addonRank) => {
            if (signal.aborted) return;

            const formattedId =
                formatIdForIdPrefixes(id, type, addon.idPrefixes) ||
                formatIdForIdPrefixes(id, type) ||
                id;

            const label = `${addon.url} (${type}:${formattedId})`;

            const result = await withTimeout(
                getStreams(addon.url, type, formattedId, manifests[addon.url]),
                perAddonTimeoutMs,
                label
            );

            if (signal.aborted) return;

            const rawStreams = Array.isArray(result?.streams) ? result.streams.filter(Boolean) : [];

            const items: StreamListItem[] = rawStreams.map((s: Stream, streamIndex: number) => {
                const baseKey = computeBaseStreamKey(s, streamIndex);
                const addonName = typeof s.addonName === 'string' && s.addonName.length > 0 ? s.addonName : addon.name;

                return {
                    ...s,
                    addonName,
                    _streamKey: baseKey,
                    _sourceAddonUrl: addon.url,
                    _sourceAddonName: addon.name,
                    _addonRank: addonRank,
                    _streamRank: streamIndex,
                };
            });

            queryClient.setQueryData<StreamListItem[]>(queryKey, (prev) => {
                const safePrev = Array.isArray(prev) ? prev : [];
                return mergeStreams(safePrev, items);
            });
        });

        await Promise.allSettled(fetches);

        const final = queryClient.getQueryData<StreamListItem[]>(queryKey);
        return Array.isArray(final) ? final : [];
    };
}

export async function prefetchStreams(queryClient: QueryClient, params: { type: string; id: string }) {
    const id = params.id;
    if (!id) return;

    const stremioType: StremioType = params.type === 'movie' ? 'movie' : 'series';
    const state = useUserStore.getState();
    const enabledAddons = state.addons.filter((a) => a.enabled !== false);
    const { streamAddons, addonFingerprints } = computeStreamAddons(enabledAddons, state.manifests, stremioType);
    if (streamAddons.length === 0) return;

    const queryKey = streamsQueryKey({ type: stremioType, id, addonFingerprints });
    await queryClient.prefetchQuery({
        queryKey,
        queryFn: createStreamsQueryFn({
            queryClient,
            queryKey,
            type: stremioType,
            id,
            streamAddons,
            manifests: state.manifests,
        }),
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        retry: 1,
    });
}

export function useStreams(type: string, id: string, enabled: boolean = true) {
    const queryClient = useQueryClient();
    const addons = useUserStore((state) => state.addons);
    const manifests = useUserStore((state) => state.manifests);

    const stremioType = useMemo<StremioType>(() => (type === 'movie' ? 'movie' : 'series'), [type]);
    const enabledAddons = useMemo(() => addons.filter((a) => a.enabled !== false), [addons]);

    const { streamAddons, addonFingerprints } = useMemo(
        () => computeStreamAddons(enabledAddons, manifests, stremioType),
        [enabledAddons, manifests, stremioType]
    );

    const queryKey = useMemo(
        () => streamsQueryKey({ type: stremioType, id, addonFingerprints }),
        [addonFingerprints, id, stremioType]
    );

    const query = useQuery<StreamListItem[]>({
        queryKey,
        queryFn: createStreamsQueryFn({
            queryClient,
            queryKey,
            type: stremioType,
            id,
            streamAddons,
            manifests,
        }),
        enabled: enabled && !!id && streamAddons.length > 0,
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
    });

    return {
        ...query,
        data: query.data ?? [],
        streamAddons,
    };
}
