import CrispyNativeCore from '@/modules/crispy-native-core';
import { useTheme } from '@/src/core/ThemeContext';
import { ExpressiveButton } from '@/src/core/ui/ExpressiveButton';
import { ExpressiveSwitch } from '@/src/core/ui/ExpressiveSwitch';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, TextInput, View } from 'react-native';

const SERVER_ORIGIN = 'http://localhost:8090';
const DEBUG_SESSION_ID = 'torrent-debug';

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeInfoHash(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const directHash = trimmed.match(/^[0-9a-fA-F]{40}$/)?.[0];
    if (directHash) return directHash.toLowerCase();
    const magnetHash = trimmed.match(/xt=urn:btih:([a-zA-Z0-9]{40})/i)?.[1];
    if (magnetHash) return magnetHash.toLowerCase();
    return null;
}

function isMagnetLink(input: string): boolean {
    return input.trim().toLowerCase().startsWith('magnet:');
}

function parseFileIndex(url: string | null): number | null {
    if (!url) return null;
    const playMatch = url.match(/\/play\/[0-9a-fA-F]{40}\/(\d+)$/);
    if (playMatch?.[1]) {
        const n = Number.parseInt(playMatch[1], 10);
        return Number.isFinite(n) ? n : null;
    }

    const streamMatch = url.match(/[?&]index=(\d+)/);
    if (streamMatch?.[1]) {
        const n = Number.parseInt(streamMatch[1], 10);
        return Number.isFinite(n) ? n : null;
    }

    const legacyMatch = url.match(/\/(\d+)$/);
    if (legacyMatch?.[1]) {
        const n = Number.parseInt(legacyMatch[1], 10);
        return Number.isFinite(n) ? n : null;
    }

    return null;
}

export default function TorrentDebugScreen() {
    const { theme } = useTheme();
    const isAndroid = Platform.OS === 'android';

    const [input, setInput] = useState('');
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [activeInfoHash, setActiveInfoHash] = useState<string | null>(null);
    const [activeFileIdx, setActiveFileIdx] = useState<number | null>(null);

    const [engineReady, setEngineReady] = useState(false);
    const [streamReady, setStreamReady] = useState(false);
    const [lastStatusCode, setLastStatusCode] = useState<number | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [warmOnStart, setWarmOnStart] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const activeInfoHashRef = useRef<string | null>(null);

    const normalizedHash = useMemo(() => normalizeInfoHash(input), [input]);
    const inputIsMagnet = useMemo(() => isMagnetLink(input), [input]);

    useEffect(() => {
        activeInfoHashRef.current = activeInfoHash;
    }, [activeInfoHash]);

    const stopPolling = useCallback(() => {
        if (pollTimer.current) {
            clearInterval(pollTimer.current);
            pollTimer.current = null;
        }
    }, []);

    const checkEngineReady = useCallback(async () => {
        for (let i = 0; i < 25; i++) {
            try {
                const response = await fetch(`${SERVER_ORIGIN}/echo`, { cache: 'no-store' });
                if (response.ok) {
                    return true;
                }
            } catch {
                // ignore and retry
            }
            await delay(120);
        }
        return false;
    }, []);

    const probeStream = useCallback(async (url: string) => {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Range: 'bytes=0-1',
                },
            });
            setLastStatusCode(response.status);
            const ok = response.status === 200 || response.status === 206;
            if (ok) {
                setStreamReady(true);
                setError(null);
            }
            return ok;
        } catch {
            setLastStatusCode(null);
            return false;
        }
    }, []);

    const warmStream = useCallback(async (url: string) => {
        try {
            await fetch(url, {
                method: 'GET',
                headers: {
                    Range: 'bytes=0-1048575',
                },
            });
        } catch {
            // best effort only
        }
    }, []);

    const start = useCallback(async () => {
        const raw = input.trim();
        if (!raw) {
            Alert.alert('Missing torrent input', 'Paste a 40-char hash or a magnet link.');
            return;
        }

        const canStart = !!normalizedHash || inputIsMagnet;
        if (!canStart) {
            Alert.alert('Unsupported input', 'Use a 40-char infoHash or a magnet link.');
            return;
        }

        setIsStarting(true);
        setError(null);
        setEngineReady(false);
        setStreamReady(false);
        setLastStatusCode(null);
        setStreamUrl(null);
        setActiveInfoHash(normalizedHash);
        setActiveFileIdx(null);

        try {
            const resolvedUrl = normalizedHash
                ? await CrispyNativeCore.startStream(normalizedHash, -1, DEBUG_SESSION_ID)
                : await CrispyNativeCore.startStreamFromLink(raw, -1, DEBUG_SESSION_ID);

            if (!resolvedUrl) {
                throw new Error('Torrent engine returned no stream URL');
            }

            setStreamUrl(resolvedUrl);
            setActiveFileIdx(parseFileIndex(resolvedUrl));

            const ready = await checkEngineReady();
            setEngineReady(ready);
            if (!ready) {
                throw new Error(`TorrServer is not reachable at ${SERVER_ORIGIN}`);
            }

            if (warmOnStart) {
                void warmStream(resolvedUrl);
            }

            stopPolling();
            void probeStream(resolvedUrl);
            pollTimer.current = setInterval(() => {
                void probeStream(resolvedUrl);
            }, 1000);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setIsStarting(false);
        }
    }, [checkEngineReady, input, inputIsMagnet, normalizedHash, probeStream, stopPolling, warmOnStart, warmStream]);

    const stop = useCallback(async () => {
        stopPolling();

        const hash = activeInfoHash;
        setStreamUrl(null);
        setActiveInfoHash(null);
        setActiveFileIdx(null);
        setStreamReady(false);
        setLastStatusCode(null);

        try {
            if (hash) {
                await CrispyNativeCore.stopTorrent(hash);
            }
            await CrispyNativeCore.destroyStream(DEBUG_SESSION_ID);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, [activeInfoHash, stopPolling]);

    useEffect(() => {
        return () => {
            stopPolling();
            const hash = activeInfoHashRef.current;
            if (hash) {
                void CrispyNativeCore.stopTorrent(hash);
            }
            void CrispyNativeCore.destroyStream(DEBUG_SESSION_ID);
        };
    }, [stopPolling]);

    const surfaceContainerHigh = (theme.colors as any).surfaceContainerHigh || theme.colors.surfaceVariant;

    return (
        <SettingsSubpage title="Torrent Debug">
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
                <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                    TorrServer diagnostics for Android. Checks `/echo` health and probes the stream URL via HTTP Range.
                </Typography>

                {!isAndroid ? (
                    <View style={[styles.card, { backgroundColor: surfaceContainerHigh, borderColor: theme.colors.outlineVariant }]}>
                        <Typography variant="label-large" style={{ color: theme.colors.onSurface }}>
                            Android Only
                        </Typography>
                        <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                            iOS does not include torrent playback.
                        </Typography>
                    </View>
                ) : null}

                <View style={[styles.card, { backgroundColor: surfaceContainerHigh, borderColor: theme.colors.outlineVariant }]}>
                    <Typography variant="label-large" style={{ color: theme.colors.onSurface }}>
                        Torrent Input
                    </Typography>
                    <TextInput
                        value={input}
                        onChangeText={setInput}
                        placeholder="40-char hash or magnet link"
                        placeholderTextColor={theme.colors.onSurfaceVariant}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={[
                            styles.input,
                            {
                                color: theme.colors.onSurface,
                                borderColor: theme.colors.outlineVariant,
                            },
                        ]}
                    />
                    <Typography variant="label-small" style={{ color: normalizedHash || inputIsMagnet ? theme.colors.primary : theme.colors.onSurfaceVariant }}>
                        {normalizedHash ? `Detected hash: ${normalizedHash}` : inputIsMagnet ? 'Detected: magnet link' : 'Waiting for valid hash or magnet'}
                    </Typography>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                        <ExpressiveButton
                            title={isStarting ? 'Starting…' : 'Start'}
                            onPress={start}
                            disabled={!isAndroid || isStarting || (!normalizedHash && !inputIsMagnet)}
                            isLoading={isStarting}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <ExpressiveButton
                            title="Stop"
                            variant="tonal"
                            onPress={stop}
                            disabled={!isAndroid || !streamUrl}
                        />
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: surfaceContainerHigh, borderColor: theme.colors.outlineVariant }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                            <Typography variant="label-large" style={{ color: theme.colors.onSurface }}>
                                Warm Stream on Start
                            </Typography>
                            <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                                Sends an initial 1MB range request after stream URL creation.
                            </Typography>
                        </View>
                        <ExpressiveSwitch value={warmOnStart} onValueChange={setWarmOnStart} />
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: surfaceContainerHigh, borderColor: theme.colors.outlineVariant }]}>
                    <Typography variant="label-large" style={{ color: theme.colors.onSurface }}>
                        Status
                    </Typography>
                    <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                        Server: {SERVER_ORIGIN}
                    </Typography>
                    <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                        Engine Ready (/echo): {engineReady ? 'yes' : 'no'}
                    </Typography>
                    <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                        Stream Ready (Range 0-1): {streamReady ? 'yes' : 'no'}
                    </Typography>
                    <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                        Last HTTP Status: {lastStatusCode ?? '—'}
                    </Typography>
                    <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                        Active Hash: {activeInfoHash ?? '—'}
                    </Typography>
                    <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                        FileIdx: {activeFileIdx != null ? String(activeFileIdx) : '—'}
                    </Typography>
                    <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                        URL: {streamUrl ?? '—'}
                    </Typography>
                    {error ? (
                        <Typography variant="body" style={{ color: theme.colors.error }}>
                            Error: {error}
                        </Typography>
                    ) : null}
                </View>

                <View style={{ height: 24 }} />
            </View>
        </SettingsSubpage>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        gap: 10,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
    },
});
