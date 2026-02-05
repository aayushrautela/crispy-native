import CrispyNativeCore, { type CrispyMediaMetadata } from '@/modules/crispy-native-core';
import { AddonService } from '@/src/core/services/AddonService';
import { IntroService, type IntroTimestamps } from '@/src/core/services/IntroService';
import { useProviderStore } from '@/src/core/stores/providerStore';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { useMetaAggregator } from '@/src/features/meta/hooks/useMetaAggregator';
import { CustomSubtitles } from '@/src/features/player/components/subtitles/CustomSubtitles';
import { useNativePlayerSessionStore, type PlayerContentType } from '@/src/features/player/native/nativePlayerSessionStore';
import { parseSubtitle } from '@/src/features/player/utils/subtitleParser';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

// New Decomposed Components & Hooks
import { PlayerLoadingCurtain } from './components/PlayerLoadingCurtain';
import { PlayerControls } from './components/PlayerControls';
import { PlayerSkipIntro, PlayerUpNext } from './components/PlayerOverlays';
import { PlayerTabSystem } from './components/PlayerTabSystem';
import { usePlayerGestures } from './hooks/usePlayerGestures';

const UP_NEXT_TRIGGER_SECONDS = 25;
const LOCAL_STREAM_BASE = 'http://127.0.0.1:11470';

const normalizeLocalStreamUrl = (url: string) => {
    if (!url) return url;
    return url
        .replace('http://localhost:11470', LOCAL_STREAM_BASE)
        .replace('http://127.0.0.1:11470', LOCAL_STREAM_BASE);
};

const isLocalStreamUrl = (url: string) => url.startsWith(LOCAL_STREAM_BASE);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const waitForLocalStreamReady = async (url: string, timeoutMs = 60_000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: { Range: 'bytes=0-1' },
            });
            if (res.status === 200 || res.status === 206) return;
            if (res.status === 503) {
                await sleep(750);
                continue;
            }
            const body = await res.text().catch(() => '');
            throw new Error(`Unexpected status ${res.status}${body ? `: ${body.slice(0, 120)}` : ''}`);
        } catch {
            await sleep(750);
        }
    }
    throw new Error(`Timed out waiting for local stream (${timeoutMs}ms)`);
};

type ActiveTab = 'none' | 'audio' | 'subtitles' | 'streams' | 'settings' | 'info';

interface PlayerOverlayRootProps {
    sessionId?: string;
    engine?: string;
    url?: string;
    paused?: boolean;
    title?: string;
    artist?: string;
    artworkUrl?: string;
}

const pickBaseId = (rawId: string) => {
    const parts = String(rawId || '').split(':');
    if (parts.length >= 2 && (parts[0] === 'tmdb' || parts[0] === 'trakt')) {
        return `${parts[0]}:${parts[1]}`;
    }
    return parts[0] || '';
};

const pickSeasonFromId = (rawId: string): number => {
    const parts = String(rawId || '').split(':');
    if (parts.length >= 4 && (parts[0] === 'tmdb' || parts[0] === 'trakt')) {
        return Number.parseInt(parts[2], 10) || 1;
    }
    if (parts.length >= 3) return Number.parseInt(parts[1], 10) || 1;
    return 1;
};

const pickEpisodeFromId = (rawId: string): number | null => {
    const parts = String(rawId || '').split(':');
    if (parts.length >= 4 && (parts[0] === 'tmdb' || parts[0] === 'trakt')) {
        const ep = Number.parseInt(parts[3], 10);
        return Number.isFinite(ep) ? ep : null;
    }
    if (parts.length >= 3) {
        const ep = Number.parseInt(parts[2], 10);
        return Number.isFinite(ep) ? ep : null;
    }
    return null;
};

const normalizePipMode = (payload: any): boolean => {
    if (typeof payload === 'boolean') return payload;
    if (typeof payload === 'number') return payload === 1;
    if (payload && typeof payload === 'object') {
        if (typeof payload.isInPictureInPictureMode === 'boolean') return payload.isInPictureInPictureMode;
        if (typeof payload.isPip === 'boolean') return payload.isPip;
        if (typeof payload.inPip === 'boolean') return payload.inPip;
        if (payload.nativeEvent) return normalizePipMode(payload.nativeEvent);
    }
    return !!payload;
};

const toFiniteNumber = (value: any): number => {
    const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return parsed;
};

export default function PlayerOverlayRoot(props: PlayerOverlayRootProps) {
    const { theme } = useTheme();
    const settings = useUserStore((s) => s.settings);
    const manifests = useUserStore((s) => s.manifests);
    const getStreams = useProviderStore((s) => s.getStreams);

    const sessionId = useMemo(() => props.sessionId || '', [props.sessionId]);
    const session = useNativePlayerSessionStore((s) => (sessionId ? s.sessionsById[sessionId] : undefined));

    const contentId = useMemo(() => session?.id || '', [session?.id]);
    const contentType: PlayerContentType = useMemo(() => {
        const t = session?.type;
        return (t === 'movie' || t === 'series') ? t : 'movie';
    }, [session?.type]);

    const poster = useMemo(() => session?.poster || '', [session?.poster]);
    const episodeTitle = useMemo(() => session?.episodeTitle || '', [session?.episodeTitle]);
    const derivedTitle = useMemo(() => session?.title || props.title || 'Now Playing', [props.title, session?.title]);

    // Core Player State
    const [paused, setPaused] = useState<boolean>(() => session?.paused ?? props.paused ?? false);
    const [buffering, setBuffering] = useState(false);
    const [firstFrameRendered, setFirstFrameRendered] = useState(false);
    const [loadingStreamSwitch, setLoadingStreamSwitch] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('none');
    const [isPipMode, setIsPipMode] = useState(false);
    const [progress, setProgress] = useState({ position: 0, duration: 0 });
    const [stableDuration, setStableDuration] = useState(0);
    const [isSeeking, setIsSeeking] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);

    // Track state
    const [audioTracks, setAudioTracks] = useState<any[]>([]);
    const [subtitleTracks, setSubtitleTracks] = useState<any[]>([]);
    const [selectedAudioId, setSelectedAudioId] = useState<number | undefined>(undefined);
    const [selectedSubtitleId, setSelectedSubtitleId] = useState<number>(-1);
    const [subtitleDelay, setSubtitleDelay] = useState(0);

    // Subtitle management
    const [externalSubtitles, setExternalSubtitles] = useState<any[]>([]);
    const [externalSubtitlesLoading, setExternalSubtitlesLoading] = useState(false);
    const [selectedExternalSubtitleUrl, setSelectedExternalSubtitleUrl] = useState<string | null>(null);
    const [subtitleCues, setSubtitleCues] = useState<any[]>([]);
    const [subtitleFileLoading, setSubtitleFileLoading] = useState(false);
    const [currentSubtitleText, setCurrentSubtitleText] = useState('');
    const [subtitleSize, setSubtitleSize] = useState(24);
    const [subtitleOffset, setSubtitleOffset] = useState(0);
    const lastCueIndexRef = useRef(0);

    // Stream & Content management
    const [availableStreams, setAvailableStreams] = useState<any[]>([]);
    const [streamsLoading, setStreamsLoading] = useState(false);
    const [pendingEpisode, setPendingEpisode] = useState<any>(null);
    const [showUpNext, setShowUpNext] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [resizeMode, setResizeMode] = useState<'contain' | 'cover' | 'stretch'>('contain');
    const [introTimestamps, setIntroTimestamps] = useState<IntroTimestamps | null>(null);

    const pendingSeekAfterLoadRef = useRef<number | null>(null);
    const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Meta Aggregator
    const baseId = useMemo(() => pickBaseId(contentId), [contentId]);
    const currentSeason = useMemo(() => (contentType === 'series' ? pickSeasonFromId(contentId) : 1), [contentId, contentType]);
    const [activeSeason, setActiveSeason] = useState(currentSeason);
    useEffect(() => { setActiveSeason(currentSeason); }, [currentSeason]);
    const { meta, enriched, seasonEpisodes } = useMetaAggregator(baseId, String(contentType), activeSeason);

    // Fetch Intro Data
    useEffect(() => {
        const fetchIntro = async () => {
            if (contentType !== 'series' || !contentId) {
                setIntroTimestamps(null);
                return;
            }

            const season = pickSeasonFromId(contentId);
            const episode = pickEpisodeFromId(contentId);
            if (!episode) {
                setIntroTimestamps(null);
                return;
            }

            const imdbId = enriched?.imdbId || (contentId.startsWith('tt') ? contentId.split(':')[0] : null);
            if (!imdbId) {
                setIntroTimestamps(null);
                return;
            }

            try {
                const timestamps = await IntroService.getIntroTimestamps(imdbId, season, episode);
                setIntroTimestamps(timestamps || null);
            } catch {
                setIntroTimestamps(null);
            }
        };

        void fetchIntro();
    }, [contentType, contentId, enriched?.imdbId]);

    const mediaMetadata: CrispyMediaMetadata = useMemo(() => ({
        title: episodeTitle || derivedTitle,
        subtitle: (contentType === 'series' ? (enriched?.title || (meta as any)?.name) : 'Movie') || derivedTitle,
        artworkUrl: enriched?.poster || (meta as any)?.poster || poster || undefined,
    }), [contentType, derivedTitle, enriched, meta, episodeTitle, poster]);

    // Format helpers
    const formatTime = useCallback((seconds: number) => {
        if (!seconds || !isFinite(seconds) || isNaN(seconds)) return '0:00';
        const totalSecs = Math.floor(seconds);
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        return hours > 0 ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : `${mins}:${secs.toString().padStart(2, '0')}`;
    }, []);

    const resetControlsTimer = useCallback(() => {
        if (isPipMode) return;
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        setShowControls(true);
        if (activeTab === 'none') {
            controlsTimer.current = setTimeout(() => setShowControls(false), 5000);
        }
    }, [activeTab, isPipMode]);

    const togglePlay = useCallback(() => {
        const nextPaused = !paused;
        setPaused(nextPaused);
        useNativePlayerSessionStore.getState().patchSession(sessionId, { paused: nextPaused });
        animatePlayPause();
        void CrispyNativeCore.nativePlayerSetPaused(nextPaused);
        resetControlsTimer();
    }, [paused, resetControlsTimer, sessionId]);

    const { seekAccumulation, handleTouchEnd, playPauseScale, animatePlayPause } = usePlayerGestures({
        sessionId,
        position: progress.position,
        duration: stableDuration || progress.duration,
        showControls,
        setShowControls,
        resetControlsTimer,
        togglePlay,
    });

    const playPauseAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: playPauseScale.value }] }));
    const feedbackAnimatedStyle = useAnimatedStyle(() => ({ opacity: withTiming(seekAccumulation.direction ? 1 : 0, { duration: 150 }) }));

    // --- Native Events ---
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('nativePlayerEvent', (incoming: any) => {
            const evt = incoming?.nativeEvent ?? incoming;
            if (!evt || typeof evt !== 'object') return;
            if (sessionId && evt.sessionId && evt.sessionId !== sessionId) return;
            switch (evt.type) {
                case 'load':
                    {
                        const duration = toFiniteNumber(evt.duration);
                        setLastError(null);
                        setStableDuration(duration);
                        setProgress(p => ({ ...p, duration }));
                        setLoadingStreamSwitch(false);
                        setFirstFrameRendered(true);
                        useNativePlayerSessionStore.getState().patchSession(sessionId, { playbackState: 'ready' });
                        if (pendingSeekAfterLoadRef.current !== null) {
                            void CrispyNativeCore.nativePlayerSeek(pendingSeekAfterLoadRef.current);
                            pendingSeekAfterLoadRef.current = null;
                        }
                        break;
                    }
                case 'progress':
                    {
                        const position = toFiniteNumber(evt.position ?? evt.currentTime);
                        const duration = toFiniteNumber(evt.duration);
                        if (!isSeeking) setProgress({ position, duration });
                        if (position > 0) {
                            setFirstFrameRendered(true);
                            setBuffering(false);
                            useNativePlayerSessionStore.getState().patchSession(sessionId, { playbackState: 'ready' });
                        }
                        if (contentType === 'series' && duration > 0) {
                            const timeLeft = duration - position;
                            setShowUpNext(timeLeft <= UP_NEXT_TRIGGER_SECONDS && timeLeft > 0);
                        }
                        break;
                    }
                case 'tracks':
                    setAudioTracks(evt.audioTracks || []);
                    setSubtitleTracks(evt.subtitleTracks || []);
                    setSelectedAudioId(evt.audioTracks?.find((t: any) => t.selected)?.id);
                    setSelectedSubtitleId(evt.subtitleTracks?.find((t: any) => t.selected)?.id ?? -1);
                    break;
                case 'isPlaying':
                    setPaused(!evt.isPlaying);
                    useNativePlayerSessionStore.getState().patchSession(sessionId, { paused: !evt.isPlaying });
                    if (evt.isPlaying) {
                        setFirstFrameRendered(true);
                        useNativePlayerSessionStore.getState().patchSession(sessionId, { playbackState: 'ready' });
                    }
                    break;
                case 'buffering':
                    {
                        const isBuffering = !!evt.buffering;
                        setBuffering(isBuffering);
                        useNativePlayerSessionStore.getState().patchSession(sessionId, { playbackState: isBuffering ? 'buffering' : 'ready' });
                        break;
                    }
                case 'first-frame':
                    setFirstFrameRendered(true);
                    setBuffering(false);
                    useNativePlayerSessionStore.getState().patchSession(sessionId, { playbackState: 'ready' });
                    break;
                case 'error':
                    setLastError(evt.message);
                    setLoadingStreamSwitch(false);
                    useNativePlayerSessionStore.getState().patchSession(sessionId, { playbackState: 'error' });
                    break;
                case 'end': void CrispyNativeCore.closePlayerActivity(); break;
            }
        });
        return () => sub.remove();
    }, [sessionId, isSeeking, contentType]);

    // --- Subtitle logic ---
    useEffect(() => {
        if (!contentId) return;
        const addonUrls = Object.keys(manifests || {});
        AddonService.fetchAllSubtitles(addonUrls, contentType, contentId).then(setExternalSubtitles).catch(() => setExternalSubtitles([]));
    }, [contentId, contentType, manifests]);

    useEffect(() => {
        if (!selectedExternalSubtitleUrl) { setSubtitleCues([]); setCurrentSubtitleText(''); return; }
        setSubtitleFileLoading(true);
        fetch(selectedExternalSubtitleUrl).then(r => r.text()).then(text => setSubtitleCues(parseSubtitle(text, selectedExternalSubtitleUrl))).finally(() => setSubtitleFileLoading(false));
    }, [selectedExternalSubtitleUrl]);

    useEffect(() => {
        if (!selectedExternalSubtitleUrl || !subtitleCues.length) { setCurrentSubtitleText(''); return; }
        const adjustedPosition = progress.position - subtitleDelay;
        const cue = subtitleCues.find(c => adjustedPosition >= c.start && adjustedPosition <= c.end);
        if (cue?.text !== currentSubtitleText) setCurrentSubtitleText(cue?.text || '');
    }, [progress.position, subtitleCues, subtitleDelay, selectedExternalSubtitleUrl]);

    // --- Stream switching ---
    const switchToStream = useCallback(async (stream: any, options?: any) => {
        setLoadingStreamSwitch(true);
        setFirstFrameRendered(false);
        setBuffering(true);
        
        const directUrl = stream?.url;
        let resolved = directUrl ? { url: directUrl } : null;
        if (!resolved && stream?.infoHash) {
            const localUrl = await CrispyNativeCore.startStream(stream.infoHash, stream.fileIdx ?? -1, sessionId);
            if (localUrl) resolved = { url: localUrl };
        }

        if (!resolved) {
            setLastError('Failed to resolve');
            setLoadingStreamSwitch(false);
            setBuffering(false);
            return;
        }

        const normalizedUrl = normalizeLocalStreamUrl(resolved.url || '');
        if (!normalizedUrl) {
            setLastError('Missing stream URL');
            setLoadingStreamSwitch(false);
            setBuffering(false);
            return;
        }

        if (isLocalStreamUrl(normalizedUrl)) {
            try {
                await waitForLocalStreamReady(normalizedUrl);
            } catch (e) {
                setLastError('Torrent stream not ready. No peers yet.');
                setLoadingStreamSwitch(false);
                setBuffering(false);
                return;
            }
        }

        const nextMd = { title: options?.nextEpisodeTitle || mediaMetadata.title, subtitle: options?.nextShowTitle || mediaMetadata.subtitle, artworkUrl: options?.nextPoster || mediaMetadata.artworkUrl };
        pendingSeekAfterLoadRef.current = pendingEpisode ? 0 : progress.position;

        useNativePlayerSessionStore.getState().patchSession(sessionId, {
            id: options?.nextContentId ?? contentId,
            url: normalizedUrl,
            paused,
            artworkUrl: nextMd.artworkUrl,
        });

        await CrispyNativeCore.nativePlayerLoad({ url: normalizedUrl, headers: stream?.behaviorHints?.headers, paused, metadata: nextMd });
        setActiveTab('none');
        setPendingEpisode(null);
    }, [sessionId, contentId, paused, progress.position, mediaMetadata, pendingEpisode]);

    // --- Lifecycle ---
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('onPipModeChanged', (payload: any) => {
            const isPip = normalizePipMode(payload);
            setIsPipMode(isPip);
            setShowControls(!isPip);
            if (isPip) setActiveTab('none');
        });
        return () => sub.remove();
    }, []);

    useEffect(() => {
        let mounted = true;

        const syncPipState = async () => {
            const inPip = await CrispyNativeCore.isInPiPMode();
            if (!mounted) return;
            setIsPipMode(inPip);
            setShowControls(!inPip);
            if (inPip) setActiveTab('none');
        };

        void syncPipState();

        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                void syncPipState();
            }
        });

        return () => {
            mounted = false;
            sub.remove();
        };
    }, []);

    const subtitleOptions = useMemo(() => [
        { key: 'off', kind: 'off', title: 'Off' },
        ...externalSubtitles.map(s => ({ key: `ext:${s.url}`, kind: 'external', url: s.url, title: s.title }))
    ], [externalSubtitles]);

    return (
        <View style={styles.container} pointerEvents="box-none">
            <PlayerLoadingCurtain
                sessionId={sessionId}
                loadingStreamSwitch={loadingStreamSwitch}
                buffering={buffering}
                firstFrameRendered={firstFrameRendered}
                position={progress.position}
                stableDuration={stableDuration}
                lastError={lastError}
                isPipMode={isPipMode}
            />

            <PlayerSkipIntro
                visible={!!introTimestamps && progress.position >= introTimestamps.start && progress.position <= introTimestamps.end}
                introEnd={introTimestamps?.end || 0}
                setProgress={setProgress}
                resetControlsTimer={resetControlsTimer}
            />

            <PlayerUpNext
                visible={showUpNext}
                poster={poster}
                derivedTitle={derivedTitle}
                onCancel={() => setShowUpNext(false)}
                onPlayNext={() => {}} // Implementation in root or passed down
            />

            <CustomSubtitles
                visible={!isPipMode && !!selectedExternalSubtitleUrl && !!currentSubtitleText}
                text={currentSubtitleText}
                fontSize={subtitleSize}
                bottomOffset={(showControls ? 110 : 40) + subtitleOffset}
            />

            <Pressable style={StyleSheet.absoluteFill} pointerEvents={isPipMode ? 'none' : 'auto'} onPress={handleTouchEnd}>
                <PlayerControls
                    visible={showControls && !isPipMode}
                    paused={paused}
                    derivedTitle={derivedTitle}
                    episodeTitle={episodeTitle}
                    lastError={lastError}
                    progress={progress}
                    stableDuration={stableDuration}
                    isSeeking={isSeeking}
                    setIsSeeking={setIsSeeking}
                    setProgress={setProgress}
                    resetControlsTimer={resetControlsTimer}
                    togglePlay={togglePlay}
                    onClose={() => CrispyNativeCore.closePlayerActivity()}
                    onTabOpen={(tab) => setActiveTab(tab as ActiveTab)}
                    seekAccumulation={seekAccumulation}
                    playPauseAnimatedStyle={playPauseAnimatedStyle}
                    feedbackAnimatedStyle={feedbackAnimatedStyle}
                    formatTime={formatTime}
                />
            </Pressable>

            <PlayerTabSystem
                activeTab={activeTab}
                onClose={() => setActiveTab('none')}
                audioTracks={audioTracks}
                selectedAudioId={selectedAudioId}
                setSelectedAudioId={setSelectedAudioId}
                subtitleTracks={subtitleTracks}
                selectedSubtitleId={selectedSubtitleId}
                setSelectedSubtitleId={setSelectedSubtitleId}
                externalSubtitlesLoading={externalSubtitlesLoading}
                subtitleFileLoading={subtitleFileLoading}
                subtitleOptions={subtitleOptions}
                selectedExternalSubtitleUrl={selectedExternalSubtitleUrl}
                setSelectedExternalSubtitleUrl={setSelectedExternalSubtitleUrl}
                subtitleDelay={subtitleDelay}
                setSubtitleDelay={setSubtitleDelay}
                subtitleSize={subtitleSize}
                setSubtitleSize={setSubtitleSize}
                subtitleOffset={subtitleOffset}
                setSubtitleOffset={setSubtitleOffset}
                availableStreams={availableStreams}
                streamsLoading={streamsLoading}
                onSwitchToStream={switchToStream}
                playbackRate={playbackRate}
                onSelectSpeed={(r) => { setPlaybackRate(r); CrispyNativeCore.nativePlayerSetRate(r); }}
                resizeMode={resizeMode}
                onSelectResizeMode={(m) => { setResizeMode(m); CrispyNativeCore.nativePlayerSetResizeMode(m); }}
                meta={meta}
                enriched={enriched}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
});
