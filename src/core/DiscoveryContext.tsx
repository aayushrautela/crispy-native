import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { AddonService } from './services/AddonService';
import { storage } from './storage';
import { useUserStore } from './stores/userStore';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
            staleTime: 1000 * 60 * 5, // 5 minutes
        },
    },
});

const persister = createSyncStoragePersister({
    storage: {
        getItem: (key) => storage.getString(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.remove(key),
    },
});

persistQueryClient({
    queryClient,
    persister,
});

interface DiscoveryContextValue {
    refreshAddons: () => Promise<void>;
}

const DiscoveryContext = createContext<DiscoveryContextValue | null>(null);

export const DiscoveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { addons, updateManifest } = useUserStore();

    const refreshAddons = async () => {
        for (const addon of addons) {
            try {
                const manifest = await AddonService.fetchManifest(addon.url);
                updateManifest(addon.url, manifest);
            } catch (e) {
                console.error(`Failed to refresh addon: ${addon.url}`, e);
            }
        }
    };

    useEffect(() => {
        refreshAddons();
    }, []);

    const value = useMemo(() => ({ refreshAddons }), [refreshAddons]);

    return (
        <QueryClientProvider client={queryClient}>
            <DiscoveryContext.Provider value={value}>
                {children}
            </DiscoveryContext.Provider>
        </QueryClientProvider>
    );
};

export const useDiscovery = () => {
    const context = useContext(DiscoveryContext);
    if (!context) throw new Error('useDiscovery must be used within a DiscoveryProvider');
    return context;
};
