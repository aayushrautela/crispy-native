import { useCallback } from 'react';
import { Platform } from 'react-native';

const END_EPSILON = 0.3;

export const usePlayerControls = (
    vlcPlayerRef: any,
    paused: boolean,
    setPaused: (paused: boolean) => void,
    currentTime: number,
    duration: number,
    isSeeking: React.MutableRefObject<boolean>,
    isMounted: React.MutableRefObject<boolean>,
    // Dual engine support
    exoPlayerRef?: React.RefObject<{ seek: (seconds: number) => void } | null>,
    useExoPlayer?: boolean,
    iosPlayerRef?: React.RefObject<{ seek: (seconds: number) => void } | null>
) => {
    const togglePlayback = useCallback(() => {
        setPaused(!paused);
    }, [paused, setPaused]);

    const seekToTime = useCallback((rawSeconds: number) => {
        const timeInSeconds = Math.max(0, Math.min(rawSeconds, duration > 0 ? duration - END_EPSILON : rawSeconds));

        console.log('[usePlayerControls] seekToTime:', {
            timeInSeconds,
            useExoPlayer,
            duration,
            platform: Platform.OS
        });

        // iOS KSPlayer
        if (Platform.OS === 'ios' && iosPlayerRef?.current) {
            isSeeking.current = true;
            iosPlayerRef.current.seek(timeInSeconds);

            setTimeout(() => {
                if (isMounted.current) {
                    isSeeking.current = false;
                }
            }, 500);
            return;
        }

        // ExoPlayer
        if (useExoPlayer && exoPlayerRef?.current && duration > 0) {
            isSeeking.current = true;
            exoPlayerRef.current.seek(timeInSeconds);

            setTimeout(() => {
                if (isMounted.current) {
                    isSeeking.current = false;
                }
            }, 500);
            return;
        }

        // VLC Player
        if (vlcPlayerRef?.current && duration > 0) {
            isSeeking.current = true;
            vlcPlayerRef.current.seek(timeInSeconds);

            setTimeout(() => {
                if (isMounted.current) {
                    isSeeking.current = false;
                }
            }, 500);
            return;
        }
    }, [duration, vlcPlayerRef, exoPlayerRef, useExoPlayer, iosPlayerRef, isSeeking, isMounted]);

    const skip = useCallback((seconds: number) => {
        seekToTime(currentTime + seconds);
    }, [currentTime, seekToTime]);

    return {
        togglePlayback,
        seekToTime,
        skip
    };
};
