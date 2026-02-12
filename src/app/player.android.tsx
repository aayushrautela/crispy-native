import CrispyNativeCore from '@/modules/crispy-native-core';
import { useUserStore } from '@/src/core/stores/userStore';
import { LoadingIndicator } from '@/src/core/ui/LoadingIndicator';
import { Typography } from '@/src/core/ui/Typography';
import { useNativePlayerSessionStore, type PlayerContentType } from '@/src/features/player/native/nativePlayerSessionStore';
import { usePlayerLogic } from '@/src/features/player/hooks/usePlayerLogic';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

const pickParam = (v: string | string[] | undefined): string | undefined => {
    if (Array.isArray(v)) return v[0];
    return v;
};

const normalizeContentType = (raw: unknown): PlayerContentType => {
    const t = String(raw ?? '').toLowerCase();
    if (t === 'series' || t === 'show' || t === 'tv') return 'series';
    return 'movie';
};

const parseJsonParam = <T,>(raw: string | undefined): T | undefined => {
    if (!raw) return undefined;
    const s = (() => {
        try {
            return decodeURIComponent(raw);
        } catch {
            return raw;
        }
    })();
    try {
        return JSON.parse(s) as T;
    } catch {
        return undefined;
    }
};

export default function PlayerScreenAndroid() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const settings = useUserStore((s) => s.settings);

    const id = pickParam(params.id) || '';
    const type = normalizeContentType(pickParam(params.type));
    const urlParam = pickParam(params.url) || '';
    const title = pickParam(params.title) || '';
    const poster = pickParam(params.poster) || '';
    const episodeTitle = pickParam(params.episodeTitle) || '';

    const infoHash = pickParam(params.infoHash) || '';
    const fileIdxParam = pickParam(params.fileIdx);
    const parsedFileIdx = fileIdxParam ? Number.parseInt(fileIdxParam, 10) : Number.NaN;
    const fileIdx = Number.isFinite(parsedFileIdx) ? parsedFileIdx : undefined;

    const headers = useMemo(() => parseJsonParam<Record<string, string>>(pickParam(params.headers)), [params.headers]);
    const warmStreams = useMemo(() => parseJsonParam<unknown[]>(pickParam(params.streams)) ?? [], [params.streams]);

    const sessionId = useMemo(() => Math.random().toString(36).slice(2), []);
    const launchedRef = useRef(false);

    // Use machine to resolve stream (skip native load, as we launch Activity manually)
    const { state, dispatch } = usePlayerLogic(sessionId, { skipNativeLoad: true });
    
    // Initial Load
    useEffect(() => {
        if (urlParam || infoHash) {
            dispatch({
                type: 'LOAD_STREAM',
                stream: {
                    url: urlParam,
                    infoHash,
                    fileIdx,
                    behaviorHints: { headers }
                },
                engine: settings.videoPlayerEngine === 'vlc' ? 'vlc' : 'exo'
            });
        }
    }, [urlParam, infoHash, fileIdx, headers, settings.videoPlayerEngine, dispatch]);

    // Launch Activity when ready
    useEffect(() => {
        if (launchedRef.current) return;
        
        // If we have a resolved URL (meaning torrent is ready or HTTP is ready)
        if (state.resolvedUrl && (state.status === 'loading_media' || state.status === 'playing')) {
             launchedRef.current = true;
             const nativeEngine = state.engine === 'exo' ? 'exoplayer' : 'vlc';
             
             // Create Session
             useNativePlayerSessionStore.getState().upsertSession({
                 sessionId,
                 id,
                 type,
                 title,
                 poster,
                 episodeTitle,
                 url: state.resolvedUrl,
                 headers,
                 streams: warmStreams,
                 infoHash: infoHash || undefined,
                 fileIdx: fileIdx,
                 engine: nativeEngine,
                 paused: false,
                 artist: type === 'movie' ? 'Movie' : title,
                 artworkUrl: poster,
             });

             // Launch Native Activity
             CrispyNativeCore.openPlayerActivity({
                sessionId,
                url: state.resolvedUrl,
                headers,
                 engine: nativeEngine,
                paused: false,
                metadata: {
                     title: episodeTitle || title || 'Now Playing',
                     subtitle: type === 'movie' ? 'Movie' : title || 'Series',
                     artworkUrl: poster || undefined,
                 },
             }).then((ok) => {
                 if (ok) {
                     router.back();
                 } else {
                     // Fallback logic if needed, or dispatch error
                     dispatch({ type: 'ERROR', error: 'Failed to open native player', fatal: true });
                 }
             });
        }
    }, [state.resolvedUrl, state.status, state.engine, sessionId, id, type, title, poster, episodeTitle, headers, warmStreams, infoHash, fileIdx, router, dispatch]);

    return (
        <View style={styles.root}>
            <LoadingIndicator size="large" color="#fff" />
            <Typography variant="body" style={styles.text}>
                {state.status === 'booting_torrent' ? 'Starting torrent stream...' :
                 state.status === 'polling_localhost' ? 'Connecting to peers...' :
                 state.error ? `Error: ${state.error}` :
                 'Resolving stream...'}
            </Typography>

            {state.status === 'error' && (
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <Typography variant="label" style={styles.backText}>
                        Back
                    </Typography>
                </Pressable>
            )}
        </View>
    );
}


const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: 'black',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 14,
    },
    text: {
        color: 'rgba(255,255,255,0.85)',
        textAlign: 'center',
    },
    backBtn: {
        marginTop: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    backText: {
        color: 'white',
    },
});
