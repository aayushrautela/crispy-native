
import { TrailerService } from '@/src/core/services/TrailerService';
import { TMDBMeta } from '@/src/core/services/TMDBService';
import { adjustBrightness, isDarkColor } from '@/src/core/utils/colors';
import { useTraktWatchState } from '@/src/features/trakt/hooks/useTraktWatchState';
import { Play, RotateCcw } from 'lucide-react-native';
import React, { useMemo, useState, useEffect } from 'react';
import Animated, { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

interface UseHeroStateProps {
    meta: any;
    enriched: Partial<TMDBMeta>;
    colors: any;
    scrollY: Animated.SharedValue<number>;
    heroHeight: number;
}

export const useHeroState = ({ meta, enriched, colors, scrollY, heroHeight }: UseHeroStateProps) => {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [trailerKey, setTrailerKey] = useState<string | null>(null);
    const [showTrailer, setShowTrailer] = useState(false);
    const [revealTrailer, setRevealTrailer] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);

    // Watch state integration
    const { state, progress, isLoading, episode, lastWatchedAt } = useTraktWatchState(
        enriched.imdbId || meta?.id,
        meta?.type
    );

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

        let mountTimer: NodeJS.Timeout;
        let revealTimer: NodeJS.Timeout;

        if (key) {
            mountTimer = setTimeout(() => setShowTrailer(true), 2000);
            revealTimer = setTimeout(() => setRevealTrailer(true), 4000);
        }

        return () => {
            clearTimeout(mountTimer);
            clearTimeout(revealTimer);
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

    const watchButtonIcon = useMemo(() => (
        state === 'rewatch'
            ? <RotateCcw size= { 20} color = "black" /> 
            : <Play size={ 20 } color = "black" fill = "black" />
    ), [state]);

const watchButtonColor = useMemo(() => (
    isDarkColor(colors.lightVibrant) ? colors.lightMuted : colors.lightVibrant
), [colors]);

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

const pillColor = useMemo(() => adjustBrightness(watchButtonColor, 0.85), [watchButtonColor]);

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
    watchButtonSubtext,
    pillColor,
    toggleTrailer,
};
};
