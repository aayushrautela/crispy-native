export interface StreamBehaviorHints {
    headers?: Record<string, string>;
    [key: string]: unknown;
}

// Stremio-like stream payload with a few UI-friendly optional fields.
// Keep this permissive: addons often add extra properties.
export interface Stream {
    url?: string;
    infoHash?: string;
    fileIdx?: number;
    name?: string;
    title?: string;
    description?: string;
    quality?: string;
    size?: string;
    seeders?: number;
    addonName?: string;
    behaviorHints?: StreamBehaviorHints;
    [key: string]: unknown;
}

// Internal list item type used by stream selection UIs.
export interface StreamListItem extends Stream {
    _streamKey: string;
    _sourceAddonUrl: string;
    _sourceAddonName?: string;
    _addonRank: number;
    _streamRank: number;
}
