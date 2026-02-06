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
}

export const PlayerLoadingCurtain: React.FC<PlayerLoadingCurtainProps> = ({
    sessionId,
    loadingStreamSwitch,
    buffering,
    firstFrameRendered,
    position = 0,
    stableDuration = 0,
    lastError,
    isPipMode,
}) => {
    const { theme } = useTheme();
    const session = useNativePlayerSessionStore((s) => (sessionId ? s.sessionsById[sessionId] : undefined));

    const showLoadingCurtain = React.useMemo(() => {
        if (isPipMode) return false;
        if (loadingStreamSwitch) return true;
        if (buffering) return true;
        
        const pState = session?.playbackState || 'idle';
        const ready = pState === 'ready' || firstFrameRendered || position > 0 || stableDuration > 0;
        if (!ready && !lastError) return true;
        return false;
    }, [isPipMode, loadingStreamSwitch, buffering, session?.playbackState, firstFrameRendered, position, stableDuration, lastError]);

    if (!showLoadingCurtain) return null;

    return (
        <View style={styles.centerLoading} pointerEvents="none">
            <View style={styles.loadingBadge}>
                <LoadingIndicator size="large" color={theme.colors.primary} />
                <Typography variant="body" className="text-white mt-2">
                    {loadingStreamSwitch ? 'Switching Stream...' : buffering ? 'Buffering...' : 'Loading...'}
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
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
    },
});
