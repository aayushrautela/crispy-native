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
    if (incoming.length === 0) return prev;

    // Append-only ordering: never re-order already rendered items.
    // This avoids the "list jumps" effect when a slower addon returns later.
    const out = [...prev];
    const indexByKey = new Map<string, number>();

    for (let i = 0; i < out.length; i++) indexByKey.set(out[i]._streamKey, i);

    for (const next of incoming) {
        const idx = indexByKey.get(next._streamKey);
        if (idx === undefined) {
            indexByKey.set(next._streamKey, out.length);
            out.push(next);
            continue;
        }

        const existing = out[idx];
        // Merge any extra fields without changing list position.
        out[idx] = {
            ...existing,
            ...next,
            _streamKey: existing._streamKey,
            _sourceAddonUrl: existing._sourceAddonUrl,
        };
    }

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

function logStreamsDebug(message: string, payload?: unknown) {
    if (!__DEV__) return;
    if (payload === undefined) {
        console.log(`[useStreams] ${message}`);
        return;
    }
    console.log(`[useStreams] ${message}`, payload);
}

function normalizeRequestIds(id: string, idCandidates?: readonly string[]): string[] {
    const values: string[] = [];
    const seen = new Set<string>();

    const push = (value: string | null | undefined) => {
        if (typeof value !== 'string') return;
        const trimmed = value.trim();
        if (!trimmed || seen.has(trimmed)) return;
        seen.add(trimmed);
        values.push(trimmed);
    };

    push(id);

    if (Array.isArray(idCandidates)) {
        for (const candidate of idCandidates) push(candidate);
    }

    return values;
}

function formatFirstCompatibleId(
    requestIds: readonly string[],
    type: StremioType,
    idPrefixes?: readonly string[]
): string | null {
    for (const requestId of requestIds) {
        const formatted = formatIdForIdPrefixes(requestId, type, idPrefixes);
        if (formatted) return formatted;
    }

    return null;
}

function resolveAddonRequestId(addon: StreamAddon, type: StremioType, requestIds: readonly string[]): string | null {
    if (requestIds.length === 0) return null;

    if (Array.isArray(addon.idPrefixes) && addon.idPrefixes.length > 0) {
        return formatFirstCompatibleId(requestIds, type, addon.idPrefixes);
    }

    return formatFirstCompatibleId(requestIds, type) || requestIds[0] || null;
}

export function streamsQueryKey(params: {
    type: StremioType;
    id: string;
    addonFingerprints: string[];
    requestIds: readonly string[];
}): QueryKey {
    return ['streams', params.type, params.id, params.addonFingerprints, params.requestIds];
}

function createStreamsQueryFn(args: {
    queryClient: QueryClient;
    queryKey: QueryKey;
    type: StremioType;
    requestIds: string[];
    streamAddons: StreamAddon[];
    manifests: Record<string, AddonManifest>;
}) {
    const { queryClient, queryKey, type, requestIds, streamAddons, manifests } = args;

    return async ({ signal }: QueryFunctionContext<QueryKey>): Promise<StreamListItem[]> => {
        const perAddonTimeoutMs = 30_000;

        const fetches = streamAddons.map(async (addon) => {
            if (signal.aborted) return;

            const formattedId = resolveAddonRequestId(addon, type, requestIds);
            if (!formattedId) {
                logStreamsDebug('Skipping addon: no compatible id', {
                    addonUrl: addon.url,
                    addonName: addon.name,
                    type,
                    idPrefixes: addon.idPrefixes,
                    requestIds,
                });
                return;
            }

            const label = `${addon.url} (${type}:${formattedId})`;

            logStreamsDebug('Requesting streams', {
                addonUrl: addon.url,
                addonName: addon.name,
                type,
                selectedId: formattedId,
                idPrefixes: addon.idPrefixes,
                requestIds,
            });

            try {
                const result = await withTimeout(
                    getStreams(addon.url, type, formattedId, manifests[addon.url]),
                    perAddonTimeoutMs,
                    label
                );

                if (signal.aborted) return;

                const rawStreams = Array.isArray(result?.streams) ? result.streams.filter(Boolean) : [];

                logStreamsDebug('Received streams', {
                    addonUrl: addon.url,
                    addonName: addon.name,
                    type,
                    selectedId: formattedId,
                    count: rawStreams.length,
                });

                const items: StreamListItem[] = rawStreams.map((s: Stream, streamIndex: number) => {
                    const baseKey = computeBaseStreamKey(s, streamIndex);
                    const streamKey = `${addon.url}::${baseKey}`;
                    const addonName = typeof s.addonName === 'string' && s.addonName.length > 0 ? s.addonName : addon.name;

                    return {
                        ...s,
                        addonName,
                        _streamKey: streamKey,
                        _sourceAddonUrl: addon.url,
                        _sourceAddonName: addon.name,
                    };
                });

                queryClient.setQueryData<StreamListItem[]>(queryKey, (prev) => {
                    const safePrev = Array.isArray(prev) ? prev : [];
                    return mergeStreams(safePrev, items);
                });
            } catch (error) {
                logStreamsDebug('Addon stream request failed', {
                    addonUrl: addon.url,
                    addonName: addon.name,
                    type,
                    selectedId: formattedId,
                    error: error instanceof Error ? error.message : String(error),
                });
                throw error;
            }
        });

        await Promise.allSettled(fetches);

        const final = queryClient.getQueryData<StreamListItem[]>(queryKey);
        return Array.isArray(final) ? final : [];
    };
}

export async function prefetchStreams(queryClient: QueryClient, params: { type: string; id: string; idCandidates?: string[] }) {
    const id = params.id;
    if (!id) return;

    const stremioType: StremioType = params.type === 'movie' ? 'movie' : 'series';
    const state = useUserStore.getState();
    const enabledAddons = state.addons.filter((a) => a.enabled !== false);
    const { streamAddons, addonFingerprints } = computeStreamAddons(enabledAddons, state.manifests, stremioType);
    if (streamAddons.length === 0) return;
    const requestIds = normalizeRequestIds(id, params.idCandidates);

    const queryKey = streamsQueryKey({ type: stremioType, id, addonFingerprints, requestIds });
    await queryClient.prefetchQuery({
        queryKey,
        queryFn: createStreamsQueryFn({
            queryClient,
            queryKey,
            type: stremioType,
            requestIds,
            streamAddons,
            manifests: state.manifests,
        }),
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        retry: 1,
    });
}

export function useStreams(type: string, id: string, enabled: boolean = true, idCandidates?: string[]) {
    const queryClient = useQueryClient();
    const addons = useUserStore((state) => state.addons);
    const manifests = useUserStore((state) => state.manifests);

    const stremioType = useMemo<StremioType>(() => (type === 'movie' ? 'movie' : 'series'), [type]);
    const enabledAddons = useMemo(() => addons.filter((a) => a.enabled !== false), [addons]);

    const { streamAddons, addonFingerprints, missingManifestCount } = useMemo(
        () => computeStreamAddons(enabledAddons, manifests, stremioType),
        [enabledAddons, manifests, stremioType]
    );

    const requestIds = useMemo(() => normalizeRequestIds(id, idCandidates), [id, idCandidates]);

    const queryKey = useMemo(
        () => streamsQueryKey({ type: stremioType, id, addonFingerprints, requestIds }),
        [addonFingerprints, id, requestIds, stremioType]
    );

    const query = useQuery<StreamListItem[]>({
        queryKey,
        queryFn: createStreamsQueryFn({
            queryClient,
            queryKey,
            type: stremioType,
            requestIds,
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
        enabledAddonCount: enabledAddons.length,
        missingManifestCount,
    };
}
