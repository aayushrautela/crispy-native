
import { TMDBMeta } from '@/src/core/services/TMDBService';
import { TrailerService } from '@/src/core/services/TrailerService';
import { useTheme } from '@/src/core/ThemeContext';
import { Play, RotateCcw } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { runOnJS, useAnimatedReaction, type SharedValue } from 'react-native-reanimated';

interface UseHeroStateProps {
    meta: any;
    enriched: Partial<TMDBMeta>;
    scrollY: SharedValue<number>;
    heroHeight: number;
    watchState: {
        state: 'watch' | 'continue' | 'rewatch';
        progress?: number;
        episode?: any;
        lastWatchedAt?: string;
        isLoading: boolean;
    };
}

export const useHeroState = ({ meta, enriched, scrollY, heroHeight, watchState }: UseHeroStateProps) => {
    const { theme } = useTheme();
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [trailerKey, setTrailerKey] = useState<string | null>(null);
    const [showTrailer, setShowTrailer] = useState(false);
    const [revealTrailer, setRevealTrailer] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);

    // Watch state is now passed in via props (Lifted State)
    const { state, progress, isLoading, episode, lastWatchedAt } = watchState;

    // Visibility-based playback
    useAnimatedReaction(
        () => scrollY.value > heroHeight,
        (isOut, prevIsOut) => {
            if (isOut !== prevIsOut) {
                runOnJS(setIsPlaying)(!isOut);
            }
        },
        [heroHeight]
    );

    // Trailer logic
    useEffect(() => {
        const key = TrailerService.getFirstTrailerKey(enriched.videos || []);
        setTrailerKey(key);

        let mountTimer: ReturnType<typeof setTimeout> | undefined;
        let revealTimer: ReturnType<typeof setTimeout> | undefined;

        if (key) {
            mountTimer = setTimeout(() => setShowTrailer(true), 2000);
            revealTimer = setTimeout(() => setRevealTrailer(true), 4000);
        }

        return () => {
            if (mountTimer) clearTimeout(mountTimer);
            if (revealTimer) clearTimeout(revealTimer);
        };
    }, [enriched.videos]);

    const toggleTrailer = () => {
        if (!trailerKey) return;
        if (revealTrailer) {
            setRevealTrailer(false);
            setShowTrailer(false);
        } else {
            setShowTrailer(true);
            setRevealTrailer(true);
        }
    };

    // Formatted watch button data
    const watchButtonLabel = useMemo(() => {
        if (state === 'continue') {
            const isSeries = meta?.type === 'series' || meta?.type === 'tv' || meta?.type === 'show';
            if (isSeries && episode) return `Continue (S${episode.season} E${episode.number})`;
            if (!isSeries && progress !== undefined) return `Resume from ${Math.round(progress)}%`;
            return 'Continue';
        }
        return state === 'rewatch' ? 'Rewatch' : 'Watch now';
    }, [state, progress, episode, meta?.type]);



    const watchButtonColor = theme.colors.primary;
    const watchButtonTextColor = theme.colors.onPrimary;
    const pillColor = theme.colors.secondaryContainer;

    const watchButtonIcon = useMemo(() => (
        state === 'rewatch'
            ? <RotateCcw size={20} color={theme.colors.onSecondaryContainer} />
            : <Play size={20} color={theme.colors.onSecondaryContainer} fill={theme.colors.onSecondaryContainer} />
    ), [state, theme.colors.onSecondaryContainer]);

    const watchButtonSubtext = useMemo(() => {
        if (state === 'rewatch') {
            if (lastWatchedAt) {
                const date = new Date(lastWatchedAt);
                return `Last watched on ${date.toLocaleDateString()}`;
            }
            return null;
        }

        const runtime = enriched.runtimeMinutes;
        if (!runtime) return null;

        const percentageWatched = progress || 0;
        const remainingMinutes = Math.max(0, runtime * (1 - percentageWatched / 100));
        const endsAt = new Date(Date.now() + remainingMinutes * 60000);

        return `Ends at ${endsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`;
    }, [state, progress, enriched.runtimeMinutes, lastWatchedAt]);

    return {
        isDescriptionExpanded,
        setIsDescriptionExpanded,
        trailerKey,
        showTrailer,
        revealTrailer,
        isPlaying,
        isLoading,
        watchButtonLabel,
        watchButtonIcon,
        watchButtonColor,
        watchButtonTextColor, // New export
        watchButtonSubtext,
        pillColor,
        toggleTrailer,
    };
};
