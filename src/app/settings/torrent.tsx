import CrispyNativeCore from '@/modules/crispy-native-core';
import { useTheme } from '@/src/core/ThemeContext';
import { ExpressiveButton } from '@/src/core/ui/ExpressiveButton';
import { ExpressiveSwitch } from '@/src/core/ui/ExpressiveSwitch';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, TextInput, View } from 'react-native';

type TorrentStats = {
    infoHash: string;
    name: string;
    peers: number;
    seeds: number;
    downloadSpeed: number;
    uploadSpeed: number;
    progress: number;
    state: string;
};

type FileStats = {
    streamProgress: number;
    streamLen: number;
    streamName: string;
    downloaded: number;
    pieceLength: number;
};

const SERVER_ORIGIN = 'http://127.0.0.1:11470';

function normalizeInfoHash(input: string): string | null {
    const trimmed = input.trim();
    const match = trimmed.match(/[0-9a-fA-F]{40}/);
    return match ? match[0].toLowerCase() : null;
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
    const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exp);
    return `${value.toFixed(value >= 100 || exp === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[exp]}`;
}

function formatSpeed(bytesPerSec: number): string {
    return `${formatBytes(bytesPerSec)}/s`;
}

export default function TorrentDebugScreen() {
    const { theme } = useTheme();

    const isAndroid = Platform.OS === 'android';

    const [input, setInput] = useState('');
    const [activeInfoHash, setActiveInfoHash] = useState<string | null>(null);
    const [activeFileIdx, setActiveFileIdx] = useState<number | null>(null);
    const [streamUrl, setStreamUrl] = useState<string | null>(null);

    const [torrentStats, setTorrentStats] = useState<TorrentStats | null>(null);
    const [fileStats, setFileStats] = useState<FileStats | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [warmOnStart, setWarmOnStart] = useState(true);

    const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const warmInFlight = useRef(false);
    const activeInfoHashRef = useRef<string | null>(null);

    const normalized = useMemo(() => normalizeInfoHash(input), [input]);

    useEffect(() => {
        activeInfoHashRef.current = activeInfoHash;
    }, [activeInfoHash]);

    const stopPolling = useCallback(() => {
        if (pollTimer.current) {
            clearInterval(pollTimer.current);
            pollTimer.current = null;
        }
    }, []);

    const pollOnce = useCallback(async (infoHash: string, fileIdx: number | null) => {
        try {
            const tsRes = await fetch(`${SERVER_ORIGIN}/${infoHash}/stats.json`);
            if (tsRes.ok) {
                const json = (await tsRes.json()) as TorrentStats;
                setTorrentStats(json);
            }

            if (fileIdx != null) {
                const fsRes = await fetch(`${SERVER_ORIGIN}/${infoHash}/${fileIdx}/stats.json`);
                if (fsRes.ok) {
                    const json = (await fsRes.json()) as FileStats;
                    setFileStats(json);
                }
            }

            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    const start = useCallback(async () => {
        const infoHash = normalized;
        if (!infoHash) {
            Alert.alert('Invalid infoHash', 'Paste a 40-character hex infoHash (or a magnet containing it).');
            return;
        }

        setIsStarting(true);
        setError(null);
        setTorrentStats(null);
        setFileStats(null);
        setActiveInfoHash(infoHash);
        setActiveFileIdx(null);
        setStreamUrl(null);

        try {
            const url = await CrispyNativeCore.startStream(infoHash, -1, 'torrent-debug');
            setStreamUrl(url);

            const idxFromUrl = url?.match(/\/(\d+)$/)?.[1];
            const fileIdx = idxFromUrl ? Number.parseInt(idxFromUrl, 10) : null;
            setActiveFileIdx(Number.isFinite(fileIdx as number) ? (fileIdx as number) : null);

            stopPolling();
            await pollOnce(infoHash, Number.isFinite(fileIdx as number) ? (fileIdx as number) : null);
            pollTimer.current = setInterval(() => {
                void pollOnce(infoHash, Number.isFinite(fileIdx as number) ? (fileIdx as number) : null);
            }, 1000);

            if (warmOnStart && Number.isFinite(fileIdx as number)) {
                // Trigger streaming prioritization without invoking any player.
                void (async () => {
                    if (warmInFlight.current) return;
                    warmInFlight.current = true;
                    try {
                        await fetch(`${SERVER_ORIGIN}/${infoHash}/${fileIdx}`, {
                            headers: {
                                Range: 'bytes=0-1048575',
                            },
                        });
                    } catch {
                        // ignore: this is best-effort diagnostics
                    } finally {
                        warmInFlight.current = false;
                    }
                })();
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setIsStarting(false);
        }
    }, [normalized, pollOnce, stopPolling, warmOnStart]);

    const stop = useCallback(async () => {
        stopPolling();
        const infoHash = activeInfoHash;
        setActiveInfoHash(null);
        setActiveFileIdx(null);
        setStreamUrl(null);

        try {
            if (infoHash) {
                await CrispyNativeCore.stopTorrent(infoHash);
            }
            await CrispyNativeCore.destroyStream('torrent-debug');
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, [activeInfoHash, stopPolling]);

    useEffect(() => {
        return () => {
            stopPolling();
            // Keep it on-demand: stop diagnostic torrents when leaving screen.
            const infoHash = activeInfoHashRef.current;
            if (infoHash) {
                void CrispyNativeCore.stopTorrent(infoHash);
                void CrispyNativeCore.destroyStream('torrent-debug');
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const percent = useMemo(() => {
        const p = fileStats?.streamProgress ?? torrentStats?.progress;
        if (!Number.isFinite(p as number)) return null;
        const v = Math.max(0, Math.min(1, p as number));
        return v;
    }, [fileStats?.streamProgress, torrentStats?.progress]);

    const surfaceContainerHigh = (theme.colors as any).surfaceContainerHigh || theme.colors.surfaceVariant;

    return (
        <SettingsSubpage title="Torrent Debug">
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
                <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                    Download-only diagnostics. Starts the torrent engine and polls `/{'{'}infoHash{'}'}/stats.json`.
                </Typography>

                {!isAndroid ? (
                    <View style={[styles.card, { backgroundColor: surfaceContainerHigh, borderColor: theme.colors.outlineVariant }]}> 
                        <Typography variant="label-large" style={{ color: theme.colors.onSurface }}>
                            Android Only
                        </Typography>
                        <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                            Torrent engine diagnostics are currently implemented via Android `TorrentService`.
                        </Typography>
                    </View>
                ) : null}

                <View style={[styles.card, { backgroundColor: surfaceContainerHigh, borderColor: theme.colors.outlineVariant }]}> 
                    <Typography variant="label-large" style={{ color: theme.colors.onSurface }}>
                        infoHash
                    </Typography>
                    <TextInput
                        value={input}
                        onChangeText={setInput}
                        placeholder="40-char hex infoHash (or magnet)"
                        placeholderTextColor={theme.colors.onSurfaceVariant}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={[
                            styles.input,
                            {
                                color: theme.colors.onSurface,
                                borderColor: theme.colors.outlineVariant,
                            }
                        ]}
                    />
                    <Typography variant="label-small" style={{ color: normalized ? theme.colors.primary : theme.colors.onSurfaceVariant }}>
                        {normalized ? `Detected: ${normalized}` : 'Waiting for a valid 40-hex infoHash'}
                    </Typography>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                        <ExpressiveButton
                            title={isStarting ? 'Starting…' : 'Start'}
                            onPress={start}
                            disabled={!isAndroid || !normalized || isStarting}
                            isLoading={isStarting}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <ExpressiveButton
                            title="Stop"
                            variant="tonal"
                            onPress={stop}
                            disabled={!isAndroid || !activeInfoHash}
                        />
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: surfaceContainerHigh, borderColor: theme.colors.outlineVariant }]}> 
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                            <Typography variant="label-large" style={{ color: theme.colors.onSurface }}>
                                Warm via Local HTTP
                            </Typography>
                            <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                                Sends a small Range request to trigger streaming prioritization (no player).
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
                        Platform: {Platform.OS} {String(Platform.Version)}
                    </Typography>
                    <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                        Active: {activeInfoHash ? activeInfoHash : '—'}
                    </Typography>
                    <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                        FileIdx: {activeFileIdx != null ? String(activeFileIdx) : '—'}
                    </Typography>
                    <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                        URL: {streamUrl ? streamUrl : '—'}
                    </Typography>
                    {error ? (
                        <Typography variant="body" style={{ color: theme.colors.error }}>
                            Error: {error}
                        </Typography>
                    ) : null}
                </View>

                <View style={[styles.card, { backgroundColor: surfaceContainerHigh, borderColor: theme.colors.outlineVariant }]}> 
                    <Typography variant="label-large" style={{ color: theme.colors.onSurface }}>
                        Progress
                    </Typography>
                    <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceVariant }]}> 
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    width: `${Math.round(((percent ?? 0) * 1000)) / 10}%`,
                                    backgroundColor: theme.colors.primary,
                                }
                            ]}
                        />
                    </View>
                    <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                        {percent != null ? `${Math.round(percent * 1000) / 10}%` : '—'}
                    </Typography>
                    {fileStats ? (
                        <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                            {fileStats.streamName} · {formatBytes(fileStats.downloaded)} / {formatBytes(fileStats.streamLen)}
                        </Typography>
                    ) : null}
                    {torrentStats ? (
                        <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                            {torrentStats.state} · peers {torrentStats.peers} · seeds {torrentStats.seeds} · down {formatSpeed(torrentStats.downloadSpeed)} · up {formatSpeed(torrentStats.uploadSpeed)}
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
    progressTrack: {
        height: 10,
        borderRadius: 999,
        overflow: 'hidden',
    },
    progressFill: {
        height: 10,
        borderRadius: 999,
    },
});
