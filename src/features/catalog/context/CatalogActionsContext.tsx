import { MetaPreview } from '@/src/core/services/AddonService';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CatalogActionsSheet } from '../components/CatalogActionsSheet';

interface CatalogActionsContextValue {
    openActions: (item: MetaPreview) => void;
    closeActions: () => void;
}

const CatalogActionsContext = createContext<CatalogActionsContextValue | null>(null);

export function CatalogActionsProvider({ children }: { children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);
    const [item, setItem] = useState<MetaPreview | null>(null);

    const closeActions = useCallback(() => {
        setVisible(false);
    }, []);

    const openActions = useCallback((nextItem: MetaPreview) => {
        setItem(nextItem);
        setVisible(true);
    }, []);

    const value = useMemo(() => {
        return { openActions, closeActions };
    }, [openActions, closeActions]);

    return (
        <CatalogActionsContext.Provider value={value}>
            {children}
            <CatalogActionsSheet item={item} visible={visible} onClose={closeActions} />
        </CatalogActionsContext.Provider>
    );
}

export function useCatalogActions() {
    const ctx = useContext(CatalogActionsContext);
    if (!ctx) {
        throw new Error('useCatalogActions must be used within CatalogActionsProvider');
    }
    return ctx;
}
