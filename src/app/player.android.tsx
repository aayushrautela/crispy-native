import CrispyNativeCore from '@/modules/crispy-native-core';
import { useUserStore } from '@/src/core/stores/userStore';
import { LoadingIndicator } from '@/src/core/ui/LoadingIndicator';
import { Typography } from '@/src/core/ui/Typography';
import { useNativePlayerSessionStore, type PlayerContentType } from '@/src/features/player/native/nativePlayerSessionStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

const LOCAL_STREAM_BASE = 'http://127.0.0.1:11470';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const pickParam = (v: string | string[] | undefined): string | undefined => {
    if (Array.isArray(v)) return v[0];
    return v;
};

const normalizeLocalStreamUrl = (url: string) => {
    if (!url) return url;
    return url.replace('http://localhost:11470', LOCAL_STREAM_BASE).replace('http://127.0.0.1:11470', LOCAL_STREAM_BASE);
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

const waitForLocalStreamReady = async (url: string, signal: AbortSignal, timeoutMs = 45_000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (signal.aborted) throw new Error('aborted');
        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: { Range: 'bytes=0-1' },
                signal,
            });
            if (res.status === 200 || res.status === 206) return;
            await sleep(750);
        } catch {
            await sleep(750);
        }
    }
    throw new Error(`Timed out waiting for local stream (${timeoutMs}ms)`);
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
    const fileIdx = fileIdxParam ? Number.parseInt(fileIdxParam, 10) : undefined;

    const headers = useMemo(() => parseJsonParam<Record<string, string>>(pickParam(params.headers)), [params.headers]);
    const warmStreams = useMemo(() => parseJsonParam<unknown[]>(pickParam(params.streams)) ?? [], [params.streams]);

    const sessionId = useMemo(() => Math.random().toString(36).slice(2), []);
    const launchedRef = useRef(false);
    const handoffRef = useRef(false);

    const [status, setStatus] = useState<'resolving' | 'launching' | 'failed'>('resolving');
    const [message, setMessage] = useState<string>('Resolving stream...');

    const preferredEngine = useMemo<'exoplayer' | 'mpv'>(() => {
        if (settings.videoPlayerEngine === 'mpv') return 'mpv';
        return 'exoplayer';
    }, [settings.videoPlayerEngine]);

    useEffect(() => {
        let mounted = true;
        const controller = new AbortController();

        const run = async () => {
            try {
                setStatus('resolving');
                setMessage('Resolving stream...');

                let finalUrl = urlParam;
                let resolvedInfoHash: string | undefined = infoHash || undefined;
                let resolvedFileIdx: number | undefined = typeof fileIdx === 'number' && Number.isFinite(fileIdx) ? fileIdx : undefined;

                if (!finalUrl && resolvedInfoHash) {
                    setMessage('Starting torrent stream...');
                    const localUrl = await CrispyNativeCore.startStream(resolvedInfoHash, resolvedFileIdx ?? -1, sessionId);
                    if (!localUrl) throw new Error('Failed to start stream');
                    finalUrl = normalizeLocalStreamUrl(localUrl);
                    setMessage('Connecting to peers...');
                    await waitForLocalStreamReady(finalUrl, controller.signal, 60_000);
                }

                if (!finalUrl) {
                    throw new Error('Missing playback URL');
                }

                if (!mounted) return;

                setStatus('launching');
                setMessage('Opening player...');

                 useNativePlayerSessionStore.getState().upsertSession({
                     sessionId,
                     id,
                     type,
                    title,
                    poster,
                    episodeTitle,
                    url: finalUrl,
                    headers,
                     streams: warmStreams,
                     infoHash: resolvedInfoHash,
                     fileIdx: resolvedFileIdx,
                     engine: preferredEngine,
                     paused: false,
                     artist: type === 'movie' ? 'Movie' : title,
                     artworkUrl: poster,
                 });

                if (launchedRef.current) return;
                launchedRef.current = true;

                 const tryOpen = (engineToUse: 'exoplayer' | 'mpv') => CrispyNativeCore.openPlayerActivity({
                     sessionId,
                     url: finalUrl,
                     headers,
                     engine: engineToUse,
                     paused: false,
                     metadata: {
                         title: episodeTitle || title || 'Now Playing',
                         subtitle: type === 'movie' ? 'Movie' : title || 'Series',
                         artworkUrl: poster || undefined,
                     },
                 });

                 let ok = await tryOpen(preferredEngine);
                 if (!ok && settings.videoPlayerEngine === 'auto' && preferredEngine === 'exoplayer') {
                     console.warn('[player.android] ExoPlayer open failed; retrying with MPV');
                     useNativePlayerSessionStore.getState().patchSession(sessionId, { engine: 'mpv' });
                     ok = await tryOpen('mpv');
                 }

                 if (!ok) throw new Error('Failed to open native player');
                 handoffRef.current = true;
                 router.back();
            } catch (e: any) {
                if (!mounted) return;
                console.error('[player.android] launch failed', e);
                setStatus('failed');
                setMessage(e?.message ? String(e.message) : 'Failed to open player');
            }
        };

        run();

        return () => {
            mounted = false;
            controller.abort();
            if (handoffRef.current) return;
            try {
                CrispyNativeCore.destroyStream?.(sessionId);
            } catch {
                // ignore
            }
        };
     }, [preferredEngine, episodeTitle, fileIdx, headers, id, infoHash, poster, router, sessionId, settings.videoPlayerEngine, title, type, urlParam, warmStreams]);

    return (
        <View style={styles.root}>
            <LoadingIndicator size="large" color="#fff" />
            <Typography variant="body" style={styles.text}>
                {message}
            </Typography>

            {status === 'failed' && (
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
