import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { StorageService } from '../storage';

export interface AddonManifest {
    id: string;
    name: string;
    version?: string;
    description?: string;
    icon?: string;
    background?: string;
    types?: string[];
    resources?: (string | { name: string; types?: string[]; idPrefixes?: string[] })[];
    catalogs?: {
        type: string;
        id: string;
        name?: string;
        extra?: (string | { name: string; isRequired?: boolean; options?: string[] })[];
    }[];
}

interface AddonState {
    addonUrls: string[];
    manifests: Record<string, AddonManifest>;
    addAddon: (url: string) => void;
    removeAddon: (url: string) => void;
    updateManifest: (url: string, manifest: AddonManifest) => void;
}

export const useAddonStore = create<AddonState>()(
    persist(
        (set) => ({
            addonUrls: [],
            manifests: {},
            addAddon: (url) => set((state) => ({
                addonUrls: state.addonUrls.includes(url) ? state.addonUrls : [...state.addonUrls, url]
            })),
            removeAddon: (url) => set((state) => {
                const newUrls = state.addonUrls.filter((u) => u !== url);
                const newManifests = { ...state.manifests };
                delete newManifests[url];
                return { addonUrls: newUrls, manifests: newManifests };
            }),
            updateManifest: (url, manifest) => set((state) => ({
                manifests: { ...state.manifests, [url]: manifest }
            })),
        }),
        {
            name: 'crispy-addon-store',
            storage: createJSONStorage(() => ({
                getItem: (name) => StorageService.getUser(name),
                setItem: (name, value) => StorageService.setUser(name, value),
                removeItem: (name) => StorageService.setUser(name, null),
            })),
        }
    )
);
