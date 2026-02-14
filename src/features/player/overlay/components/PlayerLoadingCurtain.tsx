import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/src/core/ThemeContext';
import { LoadingIndicator } from '@/src/core/ui/LoadingIndicator';
import { Typography } from '@/src/core/ui/Typography';
import { useNativePlayerSessionStore } from '@/src/features/player/native/nativePlayerSessionStore';

interface PlayerLoadingCurtainProps {
    sessionId: string;
    loadingStreamSwitch?: boolean;
    buffering?: boolean;
    firstFrameRendered?: boolean;
    position?: number;
    stableDuration?: number;
    lastError?: string | null;
    isPipMode?: boolean;
    loadingText?: string;
    onVisibilityChange?: (visible: boolean) => void;
}

const HIDE_DEBOUNCE_MS = 300;

export const PlayerLoadingCurtain: React.FC<PlayerLoadingCurtainProps> = ({
    sessionId,
    loadingStreamSwitch,
    buffering,
    firstFrameRendered,
    position = 0,
    stableDuration = 0,
    lastError,
    isPipMode,
    loadingText,
    onVisibilityChange,
}) => {
    const { theme } = useTheme();
    const session = useNativePlayerSessionStore((s) => (sessionId ? s.sessionsById[sessionId] : undefined));
    const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const shouldShowLoadingCurtain = React.useMemo(() => {
        if (isPipMode) return false;
        if (loadingStreamSwitch) return true;
        if (buffering) return true;
        
        const pState = session?.playbackState || 'idle';
        const ready = pState === 'ready' || firstFrameRendered || position > 0 || stableDuration > 0;
        if (!ready && !lastError) return true;
        return false;
    }, [isPipMode, loadingStreamSwitch, buffering, session?.playbackState, firstFrameRendered, position, stableDuration, lastError]);

    const [showLoadingCurtain, setShowLoadingCurtain] = React.useState(shouldShowLoadingCurtain);

    React.useEffect(() => {
        if (isPipMode) {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
            setShowLoadingCurtain(false);
            return;
        }

        if (shouldShowLoadingCurtain) {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
            setShowLoadingCurtain(true);
            return;
        }

        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
        }
        hideTimerRef.current = setTimeout(() => {
            setShowLoadingCurtain(false);
            hideTimerRef.current = null;
        }, HIDE_DEBOUNCE_MS);

        return () => {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
        };
    }, [shouldShowLoadingCurtain, isPipMode]);

    React.useEffect(() => {
        onVisibilityChange?.(showLoadingCurtain);
    }, [showLoadingCurtain, onVisibilityChange]);

    if (!showLoadingCurtain) return null;

    return (
        <View style={styles.centerLoading} pointerEvents="none">
            <View style={styles.loadingBadge}>
                <LoadingIndicator size="large" color={theme.colors.primary} />
                <Typography variant="body" className="text-white mt-2">
                    {loadingText || (loadingStreamSwitch ? 'Switching Stream...' : buffering ? 'Buffering...' : 'Loading...')}
                </Typography>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    centerLoading: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    loadingBadge: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
});
