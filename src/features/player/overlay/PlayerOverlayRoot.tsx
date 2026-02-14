import CrispyNativeCore, { type CrispyMediaMetadata } from '@/modules/crispy-native-core';
import { AddonService } from '@/src/core/services/AddonService';
import { IntroService, type IntroTimestamps } from '@/src/core/services/IntroService';
import { useProviderStore } from '@/src/core/stores/providerStore';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { useMetaAggregator } from '@/src/features/meta/hooks/useMetaAggregator';
import { CustomSubtitles } from '@/src/features/player/components/subtitles/CustomSubtitles';
import { useNativePlayerSessionStore, type PlaybackState, type PlayerContentType } from '@/src/features/player/native/nativePlayerSessionStore';
import { parseSubtitle } from '@/src/features/player/utils/subtitleParser';
import { usePlayerLogic } from '@/src/features/player/hooks/usePlayerLogic';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

// New Decomposed Components & Hooks
import { PlayerLoadingCurtain } from './components/PlayerLoadingCurtain';
import { PlayerControls } from './components/PlayerControls';
import { PlayerSkipIntro, PlayerUpNext } from './components/PlayerOverlays';
import { PlayerTabSystem } from './components/PlayerTabSystem';
import { usePlayerGestures } from './hooks/usePlayerGestures';

const UP_NEXT_TRIGGER_SECONDS = 25;
const VLC_DEBUG_LINE_LIMIT = 12;


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

const formatDebugSize = (width: any, height: any) => {
    const w = Math.round(toFiniteNumber(width));
    const h = Math.round(toFiniteNumber(height));
    return `${w}x${h}`;
};

const mapMachineStatusToPlaybackState = (status: string): PlaybackState => {
    switch (status) {
        case 'booting_torrent':
        case 'polling_localhost':
            return 'resolving';
        case 'loading_media':
            return 'loading';
        case 'buffering':
            return 'buffering';
        case 'playing':
        case 'paused':
            return 'ready';
        case 'error':
            return 'error';
        default:
            return 'idle';
    }
};

export default function PlayerOverlayRoot(props: PlayerOverlayRootProps) {
    const { theme } = useTheme();
    const settings = useUserStore((s) => s.settings);
    const addons = useUserStore((s) => s.addons);
    const getStreams = useProviderStore((s) => s.getStreams);

    const sessionId = useMemo(() => props.sessionId || '', [props.sessionId]);
    const session = useNativePlayerSessionStore((s) => (sessionId ? s.sessionsById[sessionId] : undefined));
    const playbackEngine = useMemo(() => {
        const raw = (session?.engine || props.engine || 'exoplayer').toLowerCase();
        return raw === 'vlc' ? 'vlc' : 'exoplayer';
    }, [props.engine, session?.engine]);

    const contentId = useMemo(() => session?.id || '', [session?.id]);
    const contentType: PlayerContentType = useMemo(() => {
        const t = session?.type;
        return (t === 'movie' || t === 'series') ? t : 'movie';
    }, [session?.type]);

    const poster = useMemo(() => session?.poster || '', [session?.poster]);
    const episodeTitle = useMemo(() => session?.episodeTitle || '', [session?.episodeTitle]);
    const derivedTitle = useMemo(() => session?.title || props.title || 'Now Playing', [props.title, session?.title]);

    // --- Core Player Logic (State Machine) ---
    const { state: playerState, dispatch } = usePlayerLogic(sessionId);
    const bootstrapLoadDispatchedRef = useRef(false);

    useEffect(() => {
        if (bootstrapLoadDispatchedRef.current) return;
        if (playerState.status !== 'idle' || playerState.stream) return;

        const streamUrl = session?.url || props.url || '';
        const streamInfoHash = session?.infoHash;
        if (!streamUrl && !streamInfoHash) {
            bootstrapLoadDispatchedRef.current = true;
            dispatch({ type: 'ERROR', error: 'No stream source available for playback.', fatal: true });
            return;
        }

        bootstrapLoadDispatchedRef.current = true;
        dispatch({
            type: 'LOAD_STREAM',
            stream: {
                url: streamUrl || undefined,
                infoHash: streamInfoHash,
                fileIdx: session?.fileIdx,
                behaviorHints: {
                    headers: session?.headers,
                },
            },
            engine: playbackEngine === 'vlc' ? 'vlc' : 'exo',
            meta: {
                title: episodeTitle || derivedTitle || 'Now Playing',
                subtitle: contentType === 'movie' ? 'Movie' : derivedTitle || 'Series',
                artworkUrl: poster || undefined,
                contentId,
            },
        });
    }, [
        session,
        props.url,
        playbackEngine,
        episodeTitle,
        derivedTitle,
        contentType,
        poster,
        contentId,
        playerState.status,
        playerState.stream,
        dispatch,
    ]);

    useEffect(() => {
        if (!sessionId) return;

        const patch: {
            playbackState: PlaybackState;
            engine: 'exoplayer' | 'vlc';
            url?: string;
            headers?: Record<string, string>;
        } = {
            playbackState: mapMachineStatusToPlaybackState(playerState.status),
            engine: playerState.engine === 'vlc' ? 'vlc' : 'exoplayer',
        };

        if (playerState.resolvedUrl) {
            patch.url = playerState.resolvedUrl;
        }
        if (playerState.stream?.behaviorHints?.headers) {
            patch.headers = playerState.stream.behaviorHints.headers;
        }

        useNativePlayerSessionStore.getState().patchSession(sessionId, patch);
    }, [sessionId, playerState.status, playerState.engine, playerState.resolvedUrl, playerState.stream]);
    
    // Derived UI State
    const paused = playerState.status === 'paused';
    const buffering = playerState.status === 'buffering' || playerState.status === 'booting_torrent' || playerState.status === 'polling_localhost' || playerState.status === 'loading_media';
    const firstFrameRendered = playerState.status === 'playing' || playerState.status === 'paused'; // Simplified
    const lastError = playerState.error;

    const [showControls, setShowControls] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('none');
    const [isPipMode, setIsPipMode] = useState(false);
    const [isLoadingCurtainVisible, setIsLoadingCurtainVisible] = useState(false);
    const [progress, setProgress] = useState({ position: 0, duration: 0 });
    const [stableDuration, setStableDuration] = useState(0);
    const [isSeeking, setIsSeeking] = useState(false);


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

    // Stream & Content management - read from session store (single source of truth)
    const availableStreams = useMemo(() => (session?.streams as any[]) ?? [], [session?.streams]);
    const [pendingEpisode, setPendingEpisode] = useState<any>(null);
    const [showUpNext, setShowUpNext] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [resizeMode, setResizeMode] = useState<'contain' | 'cover'>('contain');
    const [introTimestamps, setIntroTimestamps] = useState<IntroTimestamps | null>(null);
    const [vlcDebugSnapshot, setVlcDebugSnapshot] = useState<Record<string, any> | null>(null);
    const [vlcDebugLines, setVlcDebugLines] = useState<string[]>([]);

    const pendingSeekAfterLoadRef = useRef<number | null>(null);
    const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const appendVlcDebugLine = useCallback((line: string) => {
        setVlcDebugLines((prev) => {
            const next = prev.length >= VLC_DEBUG_LINE_LIMIT
                ? [...prev.slice(prev.length - VLC_DEBUG_LINE_LIMIT + 1), line]
                : [...prev, line];
            return next;
        });
    }, []);

    // Meta Aggregator
    const baseId = useMemo(() => pickBaseId(contentId), [contentId]);
    const currentSeason = useMemo(() => (contentType === 'series' ? pickSeasonFromId(contentId) : 1), [contentId, contentType]);
    const [activeSeason, setActiveSeason] = useState(currentSeason);
    useEffect(() => { setActiveSeason(currentSeason); }, [currentSeason]);
    const { meta, enriched, seasonEpisodes, colors } = useMetaAggregator(baseId, String(contentType), activeSeason);

    const isLoading = useMemo(() => {
        if (buffering) return true;
        const pState = playerState.status;
        if (pState === 'booting_torrent' || pState === 'polling_localhost' || pState === 'loading_media') return true;
        return false;
    }, [buffering, playerState.status]);

    const loadingText = useMemo(() => {
        if (playerState.status === 'booting_torrent') return 'Starting torrent stream...';
        if (playerState.status === 'polling_localhost') return 'Connecting to peers...';
        if (playerState.status === 'loading_media') return 'Loading stream...';
        if (playerState.status === 'buffering') return 'Buffering...';
        return 'Loading...';
    }, [playerState.status]);

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
        // Optimistic update handled by dispatch if we wanted, but machine waits for native event.
        // We just send the command.
        void CrispyNativeCore.nativePlayerSetPaused(nextPaused);
        animatePlayPause();
        resetControlsTimer();
    }, [paused, resetControlsTimer]);

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

    // --- Native Events (Data Only) ---
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('nativePlayerEvent', (incoming: any) => {
            const evt = incoming?.nativeEvent ?? incoming;
            if (!evt || typeof evt !== 'object') return;
            if (sessionId && evt.sessionId && evt.sessionId !== sessionId) return;
            switch (evt.type) {
                case 'load':
                    {
                        const duration = toFiniteNumber(evt.duration);
                        setStableDuration(duration);
                        setProgress(p => ({ ...p, duration }));
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
                case 'vlc-debug':
                    {
                        const snapshot = evt.snapshot && typeof evt.snapshot === 'object' ? evt.snapshot : evt;
                        setVlcDebugSnapshot(snapshot);

                        const line = [
                            String(snapshot.reason || 'unknown'),
                            `mode=${String(snapshot.resizeMode || '-')}`,
                            `video=${formatDebugSize(snapshot.videoWidth, snapshot.videoHeight)}`,
                            `container=${formatDebugSize(snapshot.containerWidth, snapshot.containerHeight)}`,
                            `target=${formatDebugSize(snapshot.targetWidth, snapshot.targetHeight)}`,
                        ].join(' | ');

                        appendVlcDebugLine(line);
                        console.log('[VLC_DEBUG]', snapshot);
                        break;
                    }
                // 'buffering', 'isPlaying', 'first-frame', 'error', 'end' handled by usePlayerLogic
            }
        });
        return () => sub.remove();
    }, [sessionId, isSeeking, contentType, appendVlcDebugLine]);

    useEffect(() => {
        if (playbackEngine === 'vlc') return;
        setVlcDebugSnapshot(null);
        setVlcDebugLines([]);
    }, [playbackEngine]);

    useEffect(() => {
        if (Platform.OS !== 'android') return;
        if (playbackEngine !== 'vlc') return;

        const decoderMode = settings.decoderMode || 'auto';
        const gpuMode = settings.gpuMode || 'gpu';

        const applyPlaybackModes = async () => {
            try {
                await CrispyNativeCore.nativePlayerSetDecoderMode(decoderMode);
                await CrispyNativeCore.nativePlayerSetGpuMode(gpuMode);
            } catch (error) {
                console.warn('[PlayerOverlayRoot] Failed to apply playback modes', error);
            }
        };

        void applyPlaybackModes();
    }, [playbackEngine, settings.decoderMode, settings.gpuMode]);

    // --- Subtitle logic ---
    useEffect(() => {
        if (!contentId) return;
        const addonUrls = (addons || [])
            .filter((a: any) => a && a.enabled !== false)
            .map((a: any) => String(a.url))
            .filter(Boolean);

        let cancelled = false;
        setExternalSubtitlesLoading(true);

        AddonService.fetchAllSubtitles(addonUrls, contentType, contentId)
            .then((subs) => {
                if (cancelled) return;
                setExternalSubtitles(subs || []);
            })
            .catch(() => {
                if (cancelled) return;
                setExternalSubtitles([]);
            })
            .finally(() => {
                if (cancelled) return;
                setExternalSubtitlesLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [contentId, contentType, addons]);

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

    // --- Stream switching (Delegated to Machine) ---
    const switchToStream = useCallback((stream: any, options?: any) => {
        const nextMd = { 
            title: options?.nextEpisodeTitle || mediaMetadata.title, 
            subtitle: options?.nextShowTitle || mediaMetadata.subtitle, 
            artworkUrl: options?.nextPoster || mediaMetadata.artworkUrl,
            contentId: options?.nextContentId ?? contentId
        };
        
        pendingSeekAfterLoadRef.current = pendingEpisode ? 0 : progress.position;

        // Sync session store immediately for UI
        useNativePlayerSessionStore.getState().patchSession(sessionId, {
            id: nextMd.contentId,
            paused: false, // Auto-play
            artworkUrl: nextMd.artworkUrl,
            url: stream?.url,
            headers: stream?.behaviorHints?.headers,
            infoHash: stream?.infoHash,
            fileIdx: typeof stream?.fileIdx === 'number' ? stream.fileIdx : undefined,
        });

        dispatch({ 
            type: 'LOAD_STREAM', 
            stream, 
            meta: nextMd 
        });

        setActiveTab('none');
        setPendingEpisode(null);
    }, [sessionId, contentId, progress.position, mediaMetadata, pendingEpisode, dispatch]);

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

    const vlcEngineSnapshot = (vlcDebugSnapshot?.vlcEngine && typeof vlcDebugSnapshot.vlcEngine === 'object')
        ? vlcDebugSnapshot.vlcEngine as Record<string, any>
        : null;

    return (
        <View style={styles.container} pointerEvents="box-none">
            <PlayerLoadingCurtain
                sessionId={sessionId}
                loadingStreamSwitch={playerState.status === 'loading_media' || playerState.status === 'booting_torrent' || playerState.status === 'polling_localhost'}
                buffering={buffering}
                firstFrameRendered={firstFrameRendered}
                position={progress.position}
                stableDuration={stableDuration}
                lastError={lastError}
                isPipMode={isPipMode}
                loadingText={loadingText}
                onVisibilityChange={setIsLoadingCurtainVisible}
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

            {false && playbackEngine === 'vlc' && !isPipMode && (
                <View pointerEvents="none" style={styles.vlcDebugOverlay}>
                    <View style={styles.vlcDebugCard}>
                        <Text style={styles.vlcDebugTitle}>VLC Debug</Text>
                        <Text style={styles.vlcDebugLine}>jsMode={resizeMode} nativeMode={String(vlcDebugSnapshot?.resizeMode || '-')}</Text>
                        <Text style={styles.vlcDebugLine}>reason={String(vlcDebugSnapshot?.reason || 'waiting')}</Text>
                        <Text style={styles.vlcDebugLine}>video={formatDebugSize(vlcDebugSnapshot?.videoWidth, vlcDebugSnapshot?.videoHeight)} container={formatDebugSize(vlcDebugSnapshot?.containerWidth, vlcDebugSnapshot?.containerHeight)}</Text>
                        <Text style={styles.vlcDebugLine}>surface={formatDebugSize(vlcDebugSnapshot?.surfaceViewWidth, vlcDebugSnapshot?.surfaceViewHeight)} holder={formatDebugSize(vlcDebugSnapshot?.holderFrameWidth, vlcDebugSnapshot?.holderFrameHeight)}</Text>
                        <Text style={styles.vlcDebugLine}>target={formatDebugSize(vlcDebugSnapshot?.targetWidth, vlcDebugSnapshot?.targetHeight)} retries={Math.round(toFiniteNumber(vlcDebugSnapshot?.surfaceAttachRetryCount))}</Text>
                        {vlcEngineSnapshot && (
                            <Text style={styles.vlcDebugLine}>engineState={String(vlcEngineSnapshot?.state || '-')} engineMode={String(vlcEngineSnapshot?.resizeMode || '-')} scaleType={String(vlcEngineSnapshot?.lastAppliedScaleType || '-')}</Text>
                        )}
                        <Text style={styles.vlcDebugLog}>{vlcDebugLines.join('\n') || 'waiting for vlc-debug events...'}</Text>
                    </View>
                </View>
            )}

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
                    onClose={() => {
                        void CrispyNativeCore.closePlayerActivity().then((ok) => {
                            console.log('[PlayerOverlayRoot] closePlayerActivity', { ok });
                        });
                    }}
                    onTabOpen={(tab) => setActiveTab(tab as ActiveTab)}
                    seekAccumulation={seekAccumulation}
                    playPauseAnimatedStyle={playPauseAnimatedStyle}
                    feedbackAnimatedStyle={feedbackAnimatedStyle}
                    formatTime={formatTime}
                    isLoading={isLoading || isLoadingCurtainVisible}
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
                streamsLoading={false}
                onSwitchToStream={switchToStream}
                playbackRate={playbackRate}
                onSelectSpeed={(r) => { setPlaybackRate(r); CrispyNativeCore.nativePlayerSetRate(r); }}
                resizeMode={resizeMode}
                onSelectResizeMode={(m) => {
                    setResizeMode(m);
                    appendVlcDebugLine(`js:setResizeMode mode=${m}`);
                    void CrispyNativeCore.nativePlayerSetResizeMode(m).then((ok) => {
                        console.log('[PlayerOverlayRoot] nativePlayerSetResizeMode', { mode: m, ok });
                    });
                }}
                meta={meta}
                enriched={enriched}
                seasonEpisodes={seasonEpisodes}
                colors={colors}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    vlcDebugOverlay: {
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        zIndex: 120,
    },
    vlcDebugCard: {
        backgroundColor: 'rgba(0,0,0,0.72)',
        borderColor: 'rgba(255,255,255,0.22)',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    vlcDebugTitle: {
        color: '#9FE870',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 4,
    },
    vlcDebugLine: {
        color: '#FFFFFF',
        fontSize: 11,
        lineHeight: 14,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    vlcDebugLog: {
        color: '#8FD2FF',
        fontSize: 10,
        lineHeight: 13,
        marginTop: 6,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
});
