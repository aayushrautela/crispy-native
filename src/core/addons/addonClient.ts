import {
    detectFromURL,
    fromDescriptor,
    mapURL,
    type AddonRequestExtra,
} from '@crispy-streaming/crispy-addon-client';
import { formatIdForIdPrefixes } from '@crispy-streaming/media-core';
import type { AddonManifest } from '../types/addon-types';
import type { CatalogResponse } from '../types/stremio';

type StremioType = 'movie' | 'series';
type ExtraValue = string | number | boolean | undefined | null;

const manifestCache = new Map<string, AddonManifest>();
const clientCache = new Map<string, ReturnType<typeof fromDescriptor>>();

interface SearchCandidate {
    url: string;
    addonName: string;
    catalogId: string;
    catalogName?: string;
    manifest: AddonManifest;
}

type ManifestCatalog = NonNullable<AddonManifest['catalogs']>[number];

export interface PreparedAddonInstall {
    enteredUrl: string;
    normalizedInputUrl: string;
    transportUrl: string;
    manifest: AddonManifest;
    iconUrl?: string;
    backgroundUrl?: string;
    warnings: string[];
}

function normalizeContentType(type: string): StremioType {
    return type === 'movie' ? 'movie' : 'series';
}

function buildClientCacheKey(url: string, manifest: AddonManifest): string {
    const version = manifest.version || '';
    return `${url}::${manifest.id}::${version}`;
}

function setManifestCache(url: string, manifest: AddonManifest) {
    manifestCache.set(url, manifest);
}

function setClientCache(url: string, manifest: AddonManifest, promise: ReturnType<typeof fromDescriptor>) {
    const key = buildClientCacheKey(url, manifest);
    clientCache.set(key, promise);
}

function toAddonManifest(manifest: unknown): AddonManifest {
    return manifest as AddonManifest;
}

function toRequestExtra(extra?: Record<string, ExtraValue>): AddonRequestExtra | undefined {
    if (!extra) return undefined;

    const filtered: Record<string, ExtraValue> = {};
    for (const [key, value] of Object.entries(extra)) {
        if (value === undefined || value === null) continue;
        filtered[key] = value;
    }

    if (Object.keys(filtered).length === 0) return undefined;
    return filtered;
}

function isSearchCatalog(catalog: ManifestCatalog): boolean {
    const extraSupported = Array.isArray(catalog?.extraSupported) ? catalog.extraSupported : [];
    if (extraSupported.includes('search')) return true;

    const extra = Array.isArray(catalog?.extra) ? catalog.extra : [];
    return extra.some((entry: string | { name: string; isRequired?: boolean; options?: string[] }) => {
        if (typeof entry === 'string') return entry === 'search';
        return entry?.name === 'search';
    });
}

function parseRating(input: string | undefined): number | undefined {
    if (!input) return undefined;

    const clean = input.replace(/%/g, '');
    const parts = clean.split('/');

    if (parts.length === 2) {
        const value = Number.parseFloat(parts[0]);
        const max = Number.parseFloat(parts[1]);
        if (!Number.isFinite(value) || !Number.isFinite(max) || max === 0) return undefined;
        return (value / max) * 10;
    }

    const value = Number.parseFloat(clean);
    if (!Number.isFinite(value)) return undefined;
    if (value > 10 && !input.includes('/')) return value / 10;
    return value;
}

function withParsedRatings(response: CatalogResponse): CatalogResponse {
    if (!Array.isArray(response?.metas)) return { metas: [] };

    const metas = response.metas.map((meta) => ({
        ...meta,
        numericRating: parseRating(meta.imdbRating || meta.rating),
    }));

    return { ...response, metas };
}

function getManifestBaseUrl(transportUrl: string): string {
    try {
        const parsed = new URL(transportUrl);
        parsed.pathname = parsed.pathname.replace(/\/manifest\.json$/i, '');
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString().replace(/\/$/, '');
    } catch {
        return transportUrl.replace(/\/manifest\.json$/i, '').replace(/\/+$/, '');
    }
}

function getSearchCandidates(manifests: Record<string, AddonManifest>, type: string): SearchCandidate[] {
    const candidates: SearchCandidate[] = [];

    for (const [url, manifest] of Object.entries(manifests)) {
        for (const catalog of manifest.catalogs ?? []) {
            if (catalog.type !== type || !isSearchCatalog(catalog)) continue;
            candidates.push({
                url,
                addonName: manifest.name || manifest.id,
                catalogId: catalog.id,
                catalogName: catalog.name,
                manifest,
            });
        }
    }

    return candidates;
}

function buildInstallWarnings(transportUrl: string, manifest: AddonManifest): string[] {
    const warnings: string[] = [];

    if (!transportUrl.startsWith('https://')) {
        warnings.push('Addon does not use HTTPS. This can reduce reliability and security.');
    }

    if (!manifest.icon) {
        warnings.push('Addon does not provide an icon. A fallback image will be used.');
    }

    if (!manifest.resources || manifest.resources.length === 0) {
        warnings.push('Addon manifest has no resources. Content may not load correctly.');
    }

    if (!manifest.catalogs || manifest.catalogs.length === 0) {
        warnings.push('Addon has no catalogs. It may only be usable for streams or subtitles.');
    }

    return warnings;
}

async function getClient(url: string, manifest?: AddonManifest) {
    const normalizedUrl = normalizeAddonUrl(url);
    const knownManifest = manifest || manifestCache.get(normalizedUrl);

    if (knownManifest) {
        setManifestCache(normalizedUrl, knownManifest);
        const key = buildClientCacheKey(normalizedUrl, knownManifest);
        const cached = clientCache.get(key);
        if (cached) return cached;

        const clientPromise = fromDescriptor({
            transportUrl: normalizedUrl,
            manifest: knownManifest,
        });
        setClientCache(normalizedUrl, knownManifest, clientPromise);
        return clientPromise;
    }

    const detected = await detectFromURL(normalizedUrl);
    if (!detected.addon) {
        throw new Error('URL did not resolve to a supported addon manifest');
    }

    const detectedManifest = toAddonManifest(detected.addon.manifest);
    const detectedUrl = normalizeAddonUrl(detected.addon.transportUrl || normalizedUrl);
    setManifestCache(detectedUrl, detectedManifest);

    const cachedPromise = Promise.resolve(detected.addon);
    setClientCache(detectedUrl, detectedManifest, cachedPromise as ReturnType<typeof fromDescriptor>);
    return detected.addon;
}

export function normalizeAddonUrl(url: string): string {
    const trimmed = url.trim();

    if (!trimmed) return trimmed;

    const protocolNormalized = trimmed.startsWith('stremio://')
        ? trimmed.replace('stremio://', 'https://')
        : trimmed;

    const withProtocol = protocolNormalized.startsWith('http://') || protocolNormalized.startsWith('https://')
        ? protocolNormalized
        : `https://${protocolNormalized}`;

    return mapURL(withProtocol);
}

export function resolveAddonAssetUrl(transportUrl: string, rawUrl?: string): string | undefined {
    if (!rawUrl) return undefined;

    if (rawUrl.startsWith('data:')) return rawUrl;

    try {
        return new URL(rawUrl).toString();
    } catch {
        try {
            return new URL(rawUrl, `${getManifestBaseUrl(transportUrl)}/`).toString();
        } catch {
            return undefined;
        }
    }
}

export async function prepareAddonInstall(url: string): Promise<PreparedAddonInstall> {
    const normalizedInputUrl = normalizeAddonUrl(url);
    const detected = await detectFromURL(normalizedInputUrl);

    if (detected.collection) {
        throw new Error('Addon collections are not supported in this installer yet.');
    }

    if (!detected.addon) {
        throw new Error('Could not detect a valid addon at this URL.');
    }

    const manifest = toAddonManifest(detected.addon.manifest);
    const transportUrl = normalizeAddonUrl(detected.addon.transportUrl || normalizedInputUrl);
    setManifestCache(transportUrl, manifest);

    const clientPromise = Promise.resolve(detected.addon) as ReturnType<typeof fromDescriptor>;
    setClientCache(transportUrl, manifest, clientPromise);

    return {
        enteredUrl: url,
        normalizedInputUrl,
        transportUrl,
        manifest,
        iconUrl: resolveAddonAssetUrl(transportUrl, manifest.icon),
        backgroundUrl: resolveAddonAssetUrl(transportUrl, manifest.background),
        warnings: buildInstallWarnings(transportUrl, manifest),
    };
}

export async function fetchManifest(url: string): Promise<AddonManifest> {
    const client = await getClient(url);
    const manifest = toAddonManifest(client.manifest);
    setManifestCache(normalizeAddonUrl(client.transportUrl), manifest);
    return manifest;
}

export async function getCatalog(
    url: string,
    type: string,
    id: string,
    extra?: Record<string, ExtraValue>,
    manifest?: AddonManifest
): Promise<CatalogResponse> {
    const client = await getClient(url, manifest);
    const requestExtra = toRequestExtra(extra);
    const data = requestExtra
        ? await client.get<CatalogResponse>('catalog', type, id, requestExtra)
        : await client.get<CatalogResponse>('catalog', type, id);

    return withParsedRatings(data || { metas: [] });
}

export async function getMeta(url: string, type: string, id: string, manifest?: AddonManifest): Promise<any> {
    const client = await getClient(url, manifest);
    return client.get('meta', type, id);
}

export async function getStreams(
    url: string,
    type: string,
    id: string,
    manifest?: AddonManifest
): Promise<{ streams: any[] }> {
    try {
        const client = await getClient(url, manifest);
        const data = await client.get<{ streams?: any[] }>('stream', normalizeContentType(type), id);
        return { streams: data?.streams || [] };
    } catch (error: any) {
        console.error('[AddonClient] getStreams failed:', url, error?.message || error);
        return { streams: [] };
    }
}

export async function getSubtitles(
    url: string,
    type: string,
    id: string,
    manifest?: AddonManifest
): Promise<{ subtitles: any[] }> {
    try {
        const client = await getClient(url, manifest);
        const data = await client.get<{ subtitles?: any[] }>('subtitles', normalizeContentType(type), id);
        return { subtitles: data?.subtitles || [] };
    } catch {
        return { subtitles: [] };
    }
}

export async function searchGrouped(
    manifests: Record<string, AddonManifest>,
    type: string,
    query: string
): Promise<{ addonName: string; catalogName?: string; metas: CatalogResponse['metas'] }[]> {
    const candidates = getSearchCandidates(manifests, type);

    const results = await Promise.allSettled(
        candidates.map((candidate) =>
            getCatalog(candidate.url, type, candidate.catalogId, { search: query }, candidate.manifest)
        )
    );

    const grouped: { addonName: string; catalogName?: string; metas: CatalogResponse['metas'] }[] = [];

    for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        const candidate = candidates[index];
        if (!candidate || result.status !== 'fulfilled' || !result.value.metas?.length) continue;

        grouped.push({
            addonName: candidate.addonName,
            catalogName: candidate.catalogName,
            metas: result.value.metas,
        });
    }

    return grouped;
}

export async function search(
    url: string,
    type: string,
    query: string,
    manifest?: AddonManifest
): Promise<CatalogResponse> {
    const safeManifest = manifest || manifestCache.get(normalizeAddonUrl(url));
    if (!safeManifest?.catalogs?.length) return { metas: [] };

    const searchCatalogIds = safeManifest.catalogs
        .filter((catalog) => catalog.type === type && isSearchCatalog(catalog))
        .map((catalog) => catalog.id);

    if (!searchCatalogIds.length) return { metas: [] };

    const results = await Promise.allSettled(
        searchCatalogIds.map((catalogId) => getCatalog(url, type, catalogId, { search: query }, safeManifest))
    );

    const metas = results.flatMap((result) => {
        if (result.status !== 'fulfilled') return [];
        return result.value.metas || [];
    });

    const seen = new Set<string>();
    const deduped = metas.filter((meta) => {
        if (!meta?.id || seen.has(meta.id)) return false;
        seen.add(meta.id);
        return true;
    });

    return { metas: deduped };
}

export async function fetchAllSubtitles(
    addonUrls: string[],
    manifests: Record<string, AddonManifest>,
    type: string,
    id: string
): Promise<any[]> {
    const normalizedType = normalizeContentType(type);

    const subtitleResults = await Promise.allSettled(
        addonUrls.map(async (addonUrl) => {
            const manifest = manifests[addonUrl] || await fetchManifest(addonUrl);
            const subtitleResource = manifest.resources?.find((resource) => {
                if (typeof resource === 'string') return resource === 'subtitles';
                if (resource.name !== 'subtitles') return false;
                if (!resource.types || resource.types.length === 0) return true;
                return resource.types.includes(normalizedType);
            });

            if (!subtitleResource) return [];

            const mediaType = normalizedType === 'movie' ? 'movie' : 'series';
            const idPrefixes = typeof subtitleResource === 'string'
                ? undefined
                : subtitleResource.idPrefixes;

            const formattedId =
                formatIdForIdPrefixes(id, mediaType, idPrefixes) ||
                formatIdForIdPrefixes(id, mediaType) ||
                id;

            const data = await getSubtitles(addonUrl, normalizedType, formattedId, manifest);

            return (data.subtitles || []).map((subtitle) => ({
                ...subtitle,
                addonId: manifest.id,
                addonName: manifest.name,
                isExternal: true,
            }));
        })
    );

    const allSubtitles = subtitleResults.flatMap((result) => {
        if (result.status !== 'fulfilled') return [];
        return result.value;
    });

    const seen = new Set<string>();
    return allSubtitles.filter((subtitle) => {
        if (!subtitle?.url || seen.has(subtitle.url)) return false;
        seen.add(subtitle.url);
        return true;
    });
}
