import { MetaPreview } from '@/src/core/services/AddonService';
import { useTraktStore } from '@/src/core/stores/traktStore';
import { useTheme } from '@/src/core/ThemeContext';
import { ActionItem, ActionSheet } from '@/src/core/ui/ActionSheet';
import { useTraktContext } from '@/src/features/trakt/context/TraktContext';
import { useRouter } from 'expo-router';
import { Check, Eye, EyeOff, Info, Plus } from 'lucide-react-native';
import React, { useMemo } from 'react';

interface CatalogActionsSheetProps {
    item: MetaPreview | null;
    visible: boolean;
    onClose: () => void;
}

export function CatalogActionsSheet({ item, visible, onClose }: CatalogActionsSheetProps) {
    const router = useRouter();
    const { theme } = useTheme();
    const {
        isAuthenticated,
        addToWatchlist,
        removeFromWatchlist,
        markMovieAsWatched,
        removeMovieFromHistory,
    } = useTraktContext();

    const id = item?.id || '';
    const type = item?.type === 'movie' ? 'movie' : 'series';

    const inList = useTraktStore(state => (id ? state.isInWatchlist(id) : false));
    const isWatched = useTraktStore(state => (id ? state.isWatched(id) : false));

    const actions = useMemo<ActionItem[]>(() => {
        if (!item) return [];

        const base: ActionItem[] = [
            {
                id: 'details',
                label: 'View Details',
                icon: <Info size={20} color={theme.colors.onSurface} />,
                onPress: () => {
                    router.push({
                        pathname: '/meta/[id]' as any,
                        params: { id: item.id, type: item.type }
                    });
                    onClose();
                }
            }
        ];

        if (!isAuthenticated) return base;

        base.push({
            id: 'watchlist',
            label: inList ? 'Remove from My List' : 'Add to My List',
            icon: inList
                ? <Check size={20} color={theme.colors.primary} />
                : <Plus size={20} color={theme.colors.onSurface} />,
            onPress: async () => {
                if (!id) return;
                if (inList) await removeFromWatchlist(id, type);
                else await addToWatchlist(id, type);
                onClose();
            }
        });

        if (type === 'movie') {
            base.push({
                id: 'watched',
                label: isWatched ? 'Mark as Unwatched' : 'Mark as Watched',
                icon: isWatched
                    ? <EyeOff size={20} color={theme.colors.onSurface} />
                    : <Eye size={20} color={theme.colors.onSurface} />,
                onPress: async () => {
                    if (!id) return;
                    if (isWatched) await removeMovieFromHistory(id);
                    else await markMovieAsWatched(id);
                    onClose();
                }
            });
        }

        return base;
    }, [addToWatchlist, id, inList, isAuthenticated, isWatched, item, markMovieAsWatched, onClose, removeFromWatchlist, removeMovieFromHistory, router, theme.colors.onSurface, theme.colors.primary, type]);

    return (
        <ActionSheet
            visible={visible}
            onClose={onClose}
            title={item?.name || ''}
            actions={actions}
        />
    );
}
