import { useReducer, useEffect, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import CrispyNativeCore from '@/modules/crispy-native-core';
import { playerReducer, initialPlayerState } from '../state/playerMachine';
import { isMagnetUrl, normalizeLocalStreamUrl } from '../utils/streamUtils';

const POLL_INTERVAL_MS = 750;
const POLL_TIMEOUT_MS = 180_000;

export function usePlayerLogic(sessionId: string, options?: { skipNativeLoad?: boolean }) {
    const [state, dispatch] = useReducer(playerReducer, initialPlayerState);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollStartTimeRef = useRef<number>(0);
    const lastAppliedSetPausedCommandRef = useRef<{ version: number; phase: typeof state.phase } | null>(null);

    useEffect(() => {
        if (state.phase === 'booting_torrent' && state.stream) {
            const { infoHash, fileIdx, url } = state.stream;

            const startPromise = infoHash
                ? CrispyNativeCore.startStream(infoHash, fileIdx ?? -1, sessionId)
                : isMagnetUrl(url)
                    ? CrispyNativeCore.startStreamFromLink(url!, fileIdx ?? -1, sessionId)
                    : Promise.resolve<string | null>(null);

            startPromise
                .then((url) => {
                    if (url) {
                        const normalized = normalizeLocalStreamUrl(url);
                        dispatch({ type: 'TORRENT_ENGINE_STARTED', url: normalized });
                    } else {
                        dispatch({ type: 'ERROR', error: 'Torrent engine started but returned no URL' });
                    }
                })
                .catch((err) => {
                    dispatch({ type: 'ERROR', error: `Failed to start torrent: ${err.message}` });
                });
        }
    }, [state.phase, state.stream, sessionId]);

    useEffect(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }

        if (state.phase === 'polling_localhost' && state.pollingUrl) {
            pollStartTimeRef.current = Date.now();

            const checkUrl = async () => {
                if (Date.now() - pollStartTimeRef.current > POLL_TIMEOUT_MS) {
                    dispatch({ type: 'ERROR', error: 'Timed out waiting for local stream' });
                    return;
                }

                try {
                    const res = await fetch(state.pollingUrl!, { method: 'GET', headers: { Range: 'bytes=0-1' } });
                    if (res.status === 200 || res.status === 206) {
                        dispatch({ type: 'LOCALHOST_READY' });
                        return;
                    }

                    if (res.status === 404 || (res.status >= 500 && res.status !== 503)) {
                        dispatch({ type: 'ERROR', error: `Local stream returned HTTP ${res.status}` });
                    }
                } catch {
                }
            };

            void checkUrl();
            pollIntervalRef.current = setInterval(checkUrl, POLL_INTERVAL_MS);
        }
    }, [state.phase, state.pollingUrl]);

    useEffect(() => {
        if (options?.skipNativeLoad) return;
        if (state.phase === 'loading_media' && state.resolvedUrl) {
            const loadMedia = async () => {
                try {
                    await CrispyNativeCore.nativePlayerLoad({
                        url: state.resolvedUrl!,
                        headers: state.stream?.behaviorHints?.headers,
                        paused: state.intent === 'pause',
                        metadata: state.meta ? {
                            title: state.meta.title,
                            subtitle: state.meta.subtitle,
                            artworkUrl: state.meta.artworkUrl,
                        } : undefined
                    });
                } catch (e: any) {
                    dispatch({ type: 'ERROR', error: `Failed to load player: ${e.message}` });
                }
            };
            void loadMedia();
        }
    }, [state.phase, state.resolvedUrl, state.meta, state.stream, state.intent, options?.skipNativeLoad]);

    useEffect(() => {
        const pendingSetPaused = state.pending.setPaused;
        if (!pendingSetPaused) return;
        const lastApplied = lastAppliedSetPausedCommandRef.current;
        const shouldApply = !lastApplied
            || lastApplied.version !== pendingSetPaused.version
            || lastApplied.phase !== state.phase;
        if (!shouldApply) return;

        lastAppliedSetPausedCommandRef.current = {
            version: pendingSetPaused.version,
            phase: state.phase,
        };
        CrispyNativeCore.nativePlayerSetPaused(pendingSetPaused.value).catch((err: any) => {
            dispatch({ type: 'ERROR', error: `Failed to update pause state: ${err?.message || String(err)}`, fatal: false });
        });
    }, [state.pending.setPaused, state.phase]);

    useEffect(() => {
        if (state.phase === 'recovering') {
            dispatch({ type: 'RECOVER_WITH_VLC' });
        }
    }, [state.phase]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('nativePlayerEvent', (incoming: any) => {
            const evt = incoming?.nativeEvent ?? incoming;
            if (!evt || typeof evt !== 'object') return;
            if (sessionId && evt.sessionId && evt.sessionId !== sessionId) return;

            switch (evt.type) {
                case 'load':
                    dispatch({ type: 'NATIVE_LOAD' });
                    break;
                case 'first-frame':
                    dispatch({ type: 'NATIVE_FIRST_FRAME' });
                    break;
                case 'buffering':
                    dispatch({ type: 'NATIVE_BUFFERING', buffering: !!evt.buffering });
                    break;
                case 'isPlaying':
                    dispatch({ type: 'NATIVE_IS_PLAYING', isPlaying: !!evt.isPlaying });
                    break;
                case 'error':
                    dispatch({ type: 'ERROR', error: evt.message || 'Unknown player error', fatal: false });
                    break;
                case 'end':
                    dispatch({ type: 'PLAYBACK_ENDED' });
                    break;
            }
        });
        return () => sub.remove();
    }, [sessionId]);

    return { state, dispatch };
}
