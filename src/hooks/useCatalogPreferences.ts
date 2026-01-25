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

    const moveCatalog = useCallback((catalog: { addonUrl: string; type: string; id: string }, direction: 'up' | 'down') => {
        const key = getCatalogKey(catalog);
        const order = [...catalogPrefs.order];
        let currentIndex = order.indexOf(key);

        if (currentIndex === -1) {
            order.push(key);
            currentIndex = order.length - 1;
        }

        const newIndex = direction === 'up'
            ? Math.max(0, currentIndex - 1)
            : Math.min(order.length - 1, currentIndex + 1);

        if (currentIndex !== newIndex && newIndex >= 0 && newIndex < order.length) {
            [order[currentIndex], order[newIndex]] = [order[newIndex], order[currentIndex]];
            savePrefs({ order });
        }
    }, [catalogPrefs.order, savePrefs]);

    const sortCatalogsByPreferences = useCallback((catalogs: any[]): any[] => {
        return [...catalogs].sort((a, b) => {
            const keyA = getCatalogKey(a);
            const keyB = getCatalogKey(b);
            const indexA = catalogPrefs.order.indexOf(keyA);
            const indexB = catalogPrefs.order.indexOf(keyB);

            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return 0;
        });
    }, [catalogPrefs.order]);

    const toggleTraktTopPicks = useCallback(() => {
        savePrefs({ traktTopPicks: !catalogPrefs.traktTopPicks });
    }, [catalogPrefs.traktTopPicks, savePrefs]);

    const toggleContinueWatching = useCallback(() => {
        savePrefs({ continueWatching: !catalogPrefs.continueWatching });
    }, [catalogPrefs.continueWatching, savePrefs]);

    return {
        preferences: {
            disabled: new Set(catalogPrefs.disabled),
            order: catalogPrefs.order,
            hero: new Set(catalogPrefs.hero),
            traktTopPicks: catalogPrefs.traktTopPicks,
            continueWatching: catalogPrefs.continueWatching
        },
        toggleCatalog,
        toggleTraktTopPicks,
        toggleContinueWatching,
        toggleHero,
        moveCatalog,
        sortCatalogsByPreferences,
        getCatalogKey
    };
}
