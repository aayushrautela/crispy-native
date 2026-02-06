import { useCallback, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import CrispyNativeCore from '@/modules/crispy-native-core';
import { useNativePlayerSessionStore } from '@/src/features/player/native/nativePlayerSessionStore';

interface UsePlayerGesturesProps {
    sessionId: string;
    position: number;
    duration: number;
    showControls: boolean;
    setShowControls: (show: boolean) => void;
    resetControlsTimer: () => void;
    togglePlay: () => void;
}

export const usePlayerGestures = ({
    sessionId,
    position,
    duration,
    showControls,
    setShowControls,
    resetControlsTimer,
    togglePlay,
}: UsePlayerGesturesProps) => {
    const { width } = useWindowDimensions();
    const [seekAccumulation, setSeekAccumulation] = useState<{ amount: number; direction: 'forward' | 'backward' | null }>({ amount: 0, direction: null });
    const seekAccumulationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seekBasePosition = useRef<number | null>(null);
    const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

    const playPauseScale = useSharedValue(1);

    const handleSeek = useCallback(
        (direction: 'forward' | 'backward') => {
            if (seekAccumulationTimer.current) clearTimeout(seekAccumulationTimer.current);

            setSeekAccumulation((prev) => {
                const isSameDirection = prev.direction === direction;
                const newAmount = isSameDirection ? prev.amount + 10 : 10;

                if (seekBasePosition.current === null || !isSameDirection) {
                    seekBasePosition.current = position;
                }

                const totalDelta = direction === 'forward' ? newAmount : -newAmount;
                const targetPos = Math.max(0, Math.min(duration > 0 ? duration : Number.MAX_SAFE_INTEGER, (seekBasePosition.current ?? 0) + totalDelta));

                void CrispyNativeCore.nativePlayerSeek(targetPos);
                
                return { amount: newAmount, direction };
            });

            seekAccumulationTimer.current = setTimeout(() => {
                setSeekAccumulation({ amount: 0, direction: null });
                seekBasePosition.current = null;
            }, 800);

            resetControlsTimer();
        },
        [duration, position, resetControlsTimer]
    );

    const handleTouchEnd = useCallback(
        (e: any) => {
            const now = Date.now();
            const { locationX: x } = e.nativeEvent;

            if (now - lastTapRef.current.time < 300) {
                if (x < width * 0.3) {
                    handleSeek('backward');
                } else if (x > width * 0.7) {
                    handleSeek('forward');
                }
            } else {
                if (showControls) {
                    setShowControls(false);
                } else {
                    resetControlsTimer();
                }
            }

            lastTapRef.current = { time: now, x };
        },
        [handleSeek, resetControlsTimer, showControls, width]
    );

    const animatePlayPause = useCallback(() => {
        playPauseScale.value = withSequence(withTiming(0.85, { duration: 100 }), withTiming(1, { duration: 150 }));
    }, [playPauseScale]);

    return {
        seekAccumulation,
        handleTouchEnd,
        playPauseScale,
        animatePlayPause,
    };
};
