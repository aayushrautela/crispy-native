/**
 * useKSPlayer - iOS Player Hook
 * 
 * Placeholder hook for KSPlayer integration.
 * Will provide iOS-specific player controls and state management.
 */

import { useRef } from 'react';
import { KSPlayerSurfaceRef } from '../KSPlayerSurface';

export function useKSPlayer() {
    const ksPlayerRef = useRef<KSPlayerSurfaceRef>(null);

    const seek = (seconds: number) => {
        ksPlayerRef.current?.seek(seconds);
    };

    const setAudioTrack = (id: number) => {
        ksPlayerRef.current?.setAudioTrack(id);
    };

    const setSubtitleTrack = (id: number) => {
        ksPlayerRef.current?.setSubtitleTrack(id);
    };

    return {
        ksPlayerRef,
        seek,
        setAudioTrack,
        setSubtitleTrack,
    };
}
