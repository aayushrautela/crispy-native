import { useCallback } from 'react';
import { VideoRef } from 'react-native-video';

const END_EPSILON = 0.3;

export const usePlayerControls = (
    mpvPlayerRef: any,
    paused: boolean,
    setPaused: (paused: boolean) => void,
    currentTime: number,
    duration: number,
    isSeeking: React.MutableRefObject<boolean>,
    isMounted: React.MutableRefObject<boolean>,
    // Dual engine support
    exoPlayerRef?: React.RefObject<VideoRef>,
    useExoPlayer?: boolean
) => {
    const togglePlayback = useCallback(() => {
        setPaused(!paused);
    }, [paused, setPaused]);

    const seekToTime = useCallback((rawSeconds: number) => {
        const timeInSeconds = Math.max(0, Math.min(rawSeconds, duration > 0 ? duration - END_EPSILON : rawSeconds));

        console.log('[usePlayerControls] seekToTime:', {
            timeInSeconds,
            useExoPlayer,
            duration
        });

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

        // MPV Player
        if (mpvPlayerRef?.current && duration > 0) {
            isSeeking.current = true;
            mpvPlayerRef.current.seek(timeInSeconds);

            setTimeout(() => {
                if (isMounted.current) {
                    isSeeking.current = false;
                }
            }, 500);
            return;
        }
    }, [duration, mpvPlayerRef, exoPlayerRef, useExoPlayer, isSeeking, isMounted]);

    const skip = useCallback((seconds: number) => {
        seekToTime(currentTime + seconds);
    }, [currentTime, seekToTime]);

    return {
        togglePlayback,
        seekToTime,
        skip
    };
};
