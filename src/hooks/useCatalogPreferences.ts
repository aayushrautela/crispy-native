import { useCallback } from 'react';
import { CatalogPreferences, useUserStore } from '../core/stores/userStore';

export type { CatalogPreferences };

/**
 * Unique key for a catalog item: ${addonUrl}-${type}-${id}
 * We use addonUrl because addonId might not be globally unique or available consistently.
 */
export function getCatalogKey(catalog: { addonUrl: string; type: string; id: string }): string {
    return `${catalog.addonUrl}-${catalog.type}-${catalog.id}`;
}

export function useCatalogPreferences() {
    const { catalogPrefs, updateCatalogPrefs } = useUserStore();

    const savePrefs = useCallback((newPrefs: Partial<CatalogPreferences>) => {
        updateCatalogPrefs(newPrefs);
    }, [updateCatalogPrefs]);

    const toggleCatalog = useCallback((catalog: { addonUrl: string; type: string; id: string }) => {
        const key = getCatalogKey(catalog);
        const newDisabled = catalogPrefs.disabled.includes(key)
            ? catalogPrefs.disabled.filter(k => k !== key)
            : [...catalogPrefs.disabled, key];

        savePrefs({ disabled: newDisabled });
    }, [catalogPrefs.disabled, savePrefs]);

    const toggleHero = useCallback((catalog: { addonUrl: string; type: string; id: string }) => {
        const key = getCatalogKey(catalog);
        const newHero = catalogPrefs.hero.includes(key)
            ? catalogPrefs.hero.filter(k => k !== key)
            : [...catalogPrefs.hero, key];

        savePrefs({ hero: newHero });
    }, [catalogPrefs.hero, savePrefs]);

    const toggleTraktTopPicks = useCallback(() => {
        savePrefs({ traktTopPicks: !catalogPrefs.traktTopPicks });
    }, [catalogPrefs.traktTopPicks, savePrefs]);

    const toggleContinueWatching = useCallback(() => {
        savePrefs({ continueWatching: !catalogPrefs.continueWatching });
    }, [catalogPrefs.continueWatching, savePrefs]);

    // Sorting is now just filtering disabled items as reordering is removed
    const sortCatalogsByPreferences = useCallback((catalogs: any[]): any[] => {
        // We preserve the input order (manifest order)
        // This function name is kept for compatibility but it could be renamed to filterCatalogs later
        return catalogs;
    }, []);

    return {
        preferences: {
            disabled: new Set(catalogPrefs.disabled),
            hero: new Set(catalogPrefs.hero),
            traktTopPicks: catalogPrefs.traktTopPicks,
            continueWatching: catalogPrefs.continueWatching
        },
        toggleCatalog,
        toggleTraktTopPicks,
        toggleContinueWatching,
        toggleHero,
        sortCatalogsByPreferences,
        getCatalogKey
    };
}
