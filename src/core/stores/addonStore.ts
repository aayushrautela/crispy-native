import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AddonService } from '../api/AddonService';
import { StorageService } from '../storage';
import { AddonManifest } from '../types/addon-types';

interface AddonState {
    addonUrls: string[];
    manifests: Record<string, AddonManifest>;
    addAddon: (url: string) => Promise<void>;
    removeAddon: (url: string) => void;
    updateManifest: (url: string, manifest: AddonManifest) => void;
}

export const useAddonStore = create<AddonState>()(
    persist(
        (set) => ({
            addonUrls: [],
            manifests: {},
            addAddon: async (url) => {
                const normalizedUrl = AddonService.normalizeAddonUrl(url);
                const manifest = await AddonService.fetchManifest(normalizedUrl);
                set((state) => ({
                    addonUrls: state.addonUrls.includes(normalizedUrl) ? state.addonUrls : [...state.addonUrls, normalizedUrl],
                    manifests: { ...state.manifests, [normalizedUrl]: manifest }
                }));
            },
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
