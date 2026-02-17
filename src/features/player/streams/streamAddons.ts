import type { Addon } from '@/src/core/stores/userStore';
import type { AddonManifest } from '@/src/core/types/addon-types';

export type StremioType = 'movie' | 'series';
type StreamResource = NonNullable<AddonManifest['resources']>[number];
type StreamResourceObject = Exclude<StreamResource, string>;

export interface StreamAddon {
    url: string;
    name?: string;
    idPrefixes?: string[];
    manifestId?: string;
    manifestVersion?: string;
}

function pickStreamResource(resources: AddonManifest['resources'] | undefined, type: StremioType): StreamResourceObject | 'stream' | null {
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

export function computeStreamAddons(enabledAddons: Addon[], manifests: Record<string, AddonManifest>, type: StremioType) {
    const streamAddons: StreamAddon[] = [];
    let missingManifestCount = 0;

    for (const addon of enabledAddons) {
        const m = manifests[addon.url];
        if (!m) {
            missingManifestCount++;
            continue;
        }

        const resource = pickStreamResource(m.resources, type);
        if (!resource) continue;

        const idPrefixes =
            typeof resource === 'string' ? undefined : Array.isArray(resource.idPrefixes) ? resource.idPrefixes : undefined;

        streamAddons.push({
            url: addon.url,
            name: m.name,
            idPrefixes,
            manifestId: m.id,
            manifestVersion: m.version,
        });
    }

    // Stable ordering to avoid UI churn.
    streamAddons.sort((a, b) => a.url.localeCompare(b.url));

    const addonFingerprints = streamAddons.map((a) => {
        const prefixes = a.idPrefixes && a.idPrefixes.length > 0 ? a.idPrefixes.join(',') : '';
        return `${a.url}|${a.manifestId || ''}|${a.manifestVersion || ''}|${prefixes}`;
    });

    return {
        streamAddons,
        addonFingerprints,
        missingManifestCount,
    };
}
