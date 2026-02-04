import CrispyNativeCore from '@/modules/crispy-native-core';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter, Pressable, StyleSheet, Text, View } from 'react-native';

interface PlayerOverlayRootProps {
    sessionId?: string;
    engine?: string;
    url?: string;
    paused?: boolean;
    title?: string;
    artist?: string;
    artworkUrl?: string;
}

export default function PlayerOverlayRoot(props: PlayerOverlayRootProps) {
    const [paused, setPaused] = useState<boolean>(props.paused ?? false);
    const [isPip, setIsPip] = useState(false);

    const title = useMemo(() => props.title || 'Now Playing', [props.title]);
    const subtitle = useMemo(() => props.artist || '', [props.artist]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('onPipModeChanged', (v: boolean) => {
            setIsPip(!!v);
        });
        const dismissed = DeviceEventEmitter.addListener('onPipDismissed', () => {
            setIsPip(false);
            setPaused(true);
        });
        return () => {
            sub.remove();
            dismissed.remove();
        };
    }, []);

    const onClose = useCallback(() => {
        void CrispyNativeCore.closePlayerActivity();
    }, []);

    const onTogglePlay = useCallback(() => {
        const next = !paused;
        setPaused(next);
        void CrispyNativeCore.nativePlayerSetPaused(next);
    }, [paused]);

    if (isPip) {
        // Avoid drawing heavy UI in PiP.
        return <View style={styles.pipContainer} pointerEvents="none" />;
    }

    return (
        <View style={styles.root} pointerEvents="box-none">
            <View style={styles.topBar} pointerEvents="box-none">
                <Pressable onPress={onClose} style={styles.closeBtn}>
                    <Text style={styles.closeText}>Close</Text>
                </Pressable>
                <View style={styles.titleWrap} pointerEvents="none">
                    <Text numberOfLines={1} style={styles.title}>{title}</Text>
                    {!!subtitle && <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>}
                </View>
            </View>

            <View style={styles.bottomBar} pointerEvents="box-none">
                <Pressable onPress={onTogglePlay} style={styles.playBtn}>
                    <Text style={styles.playText}>{paused ? 'Play' : 'Pause'}</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    pipContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: 'rgba(0,0,0,0.35)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    bottomBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 12,
        backgroundColor: 'rgba(0,0,0,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    closeText: {
        color: 'white',
        fontSize: 14,
        fontFamily: 'GoogleSans-Medium',
    },
    titleWrap: {
        flex: 1,
    },
    title: {
        color: 'white',
        fontSize: 16,
        fontFamily: 'GoogleSans-Bold',
    },
    subtitle: {
        marginTop: 2,
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        fontFamily: 'GoogleSans-Regular',
    },
    playBtn: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.65)',
    },
    playText: {
        color: 'white',
        fontSize: 15,
        fontFamily: 'GoogleSans-Medium',
    },
});
