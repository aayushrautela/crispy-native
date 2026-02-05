import CrispyNativeCore, { type CrispyMediaMetadata } from '@/modules/crispy-native-core';
import { AddonService } from '@/src/core/services/AddonService';
import { IntroService, type IntroTimestamps } from '@/src/core/services/IntroService';
import { useProviderStore } from '@/src/core/stores/providerStore';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { LoadingIndicator } from '@/src/core/ui/LoadingIndicator';
import { SideSheet } from '@/src/core/ui/SideSheet';
import { Typography } from '@/src/core/ui/Typography';
import { useMetaAggregator } from '@/src/features/meta/hooks/useMetaAggregator';
import { CustomSubtitles } from '@/src/features/player/components/subtitles/CustomSubtitles';
import { AudioTab } from '@/src/features/player/components/tabs/AudioTab';
import { InfoTab } from '@/src/features/player/components/tabs/InfoTab';
import { SettingsTab } from '@/src/features/player/components/tabs/SettingsTab';
import { StreamsTab } from '@/src/features/player/components/tabs/StreamsTab';
import { SubtitlesTab } from '@/src/features/player/components/tabs/SubtitlesTab';
import { useNativePlayerSessionStore, type PlayerContentType } from '@/src/features/player/native/nativePlayerSessionStore';
import { parseSubtitle } from '@/src/features/player/utils/subtitleParser';
import {
    ArrowLeft,
    Headphones,
    Info,
    Languages,
    Layers,
    Pause,
    Play,
    Settings,
    StepBack,
    StepForward,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, DeviceEventEmitter, FlatList, Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

const UP_NEXT_TRIGGER_SECONDS = 25;

type ActiveTab = 'none' | 'audio' | 'subtitles' | 'streams' | 'settings' | 'info';

type NativePlayerEvent =
    | {
          sessionId?: string;
          engine?: string;
          type?: 'load';
          duration?: number;
          width?: number;
          height?: number;
      }
    | {
          sessionId?: string;
          engine?: string;
          type?: 'progress';
          position?: number;
          duration?: number;
      }
    | {
          sessionId?: string;
          engine?: string;
          type?: 'tracks';
          audioTracks?: any[];
          subtitleTracks?: any[];
      }
    | {
          sessionId?: string;
          engine?: string;
          type?: 'error';
          message?: string;
      }
    | {
          sessionId?: string;
          engine?: string;
          type?: 'end';
      }
    | {
          sessionId?: string;
          engine?: string;
          type?: 'isPlaying';
          isPlaying?: boolean;
      }
    | {
          sessionId?: string;
          engine?: string;
          type?: 'buffering';
          buffering?: boolean;
      }
    | {
          sessionId?: string;
          engine?: string;
          type?: 'first-frame';
      }
    | {
          sessionId?: string;
          engine?: string;
          type?: string;
          [key: string]: any;
      };

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

export default function PlayerOverlayRoot(props: PlayerOverlayRootProps) {
    const { theme } = useTheme();
    const settings = useUserStore((s) => s.settings);
    const manifests = useUserStore((s) => s.manifests);
    const getStreams = useProviderStore((s) => s.getStreams);

    const sessionId = useMemo(() => props.sessionId || '', [props.sessionId]);
    const session = useNativePlayerSessionStore((s) => (sessionId ? s.sessionsById[sessionId] : undefined));

    const contentType: PlayerContentType = useMemo(() => {
        const t = session?.type;
        if (t === 'movie' || t === 'series') return t;
        return 'movie';
    }, [session?.type]);

    const contentId = useMemo(() => session?.id || '', [session?.id]);
    const poster = useMemo(() => session?.poster || '', [session?.poster]);
    const episodeTitle = useMemo(() => session?.episodeTitle || '', [session?.episodeTitle]);

    const derivedTitle = useMemo(() => session?.title || props.title || 'Now Playing', [props.title, session?.title]);

    const [paused, setPaused] = useState<boolean>(() => {
        if (typeof session?.paused === 'boolean') return session.paused;
        return props.paused ?? false;
    });
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
    const [audioTracks, setAudioTracks] = useState<any[]>([]);
    const [subtitleTracks, setSubtitleTracks] = useState<any[]>([]);
    const [selectedAudioId, setSelectedAudioId] = useState<number | undefined>(undefined);
    const [selectedSubtitleId, setSelectedSubtitleId] = useState<number>(-1);
    const [subtitleDelay, setSubtitleDelay] = useState(0);

    const [externalSubtitles, setExternalSubtitles] = useState<Array<{ id: string; title: string; language?: string; url: string; addonName?: string }>>([]);
    const [externalSubtitlesLoading, setExternalSubtitlesLoading] = useState(false);
    const [selectedExternalSubtitleUrl, setSelectedExternalSubtitleUrl] = useState<string | null>(null);
    const [subtitleCues, setSubtitleCues] = useState<any[]>([]);
    const [subtitleFileLoading, setSubtitleFileLoading] = useState(false);
    const [currentSubtitleText, setCurrentSubtitleText] = useState('');
    const [subtitleSize, setSubtitleSize] = useState(24);
    const [subtitleOffset, setSubtitleOffset] = useState(0);
    const lastCueIndexRef = useRef(0);

    const [availableStreams, setAvailableStreams] = useState<any[]>(() => (Array.isArray(session?.streams) ? (session?.streams as any[]) : []));
    const [streamsLoading, setStreamsLoading] = useState(false);
    const [pendingEpisode, setPendingEpisode] = useState<null | { videoId: string; season: number; episode: number; episodeTitle?: string }>(null);

    const [resizeMode, setResizeMode] = useState<'contain' | 'cover' | 'stretch'>('contain');
    const [playbackRate, setPlaybackRate] = useState(1.0);

    const pendingSeekAfterLoadRef = useRef<number | null>(null);
    const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Gesture & Feedback State
    const [seekAccumulation, setSeekAccumulation] = useState<{ amount: number; direction: 'forward' | 'backward' | null }>({ amount: 0, direction: null });
    const seekAccumulationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seekBasePosition = useRef<number | null>(null);
    const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
    const { width } = useWindowDimensions();

    const playPauseScale = useSharedValue(1);
    const playPauseAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: playPauseScale.value }],
    }));
    const feedbackAnimatedStyle = useAnimatedStyle(() => ({
        opacity: withTiming(seekAccumulation.direction ? 1 : 0, { duration: 150 }),
    }));

    const formatTime = useCallback((seconds: number) => {
        if (!seconds || !isFinite(seconds) || isNaN(seconds)) return '0:00';
        const totalSecs = Math.floor(seconds);
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;

        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, []);

    const baseId = useMemo(() => pickBaseId(contentId), [contentId]);
    const currentSeason = useMemo(() => (contentType === 'series' ? pickSeasonFromId(contentId) : 1), [contentId, contentType]);
    const [activeSeason, setActiveSeason] = useState(currentSeason);
    useEffect(() => {
        setActiveSeason(currentSeason);
    }, [currentSeason]);

    const { meta, enriched, seasonEpisodes, colors } = useMetaAggregator(baseId, String(contentType), activeSeason);

    const mediaMetadata: CrispyMediaMetadata = useMemo(() => {
        let displayTitle = (episodeTitle || derivedTitle) || 'Unknown Title';
        let displaySubtitle = (contentType === 'movie' ? 'Movie' : derivedTitle) || 'Crispy Player';
        let displayArtwork = poster || '';

        if (contentType === 'series') {
            if (enriched?.title) displaySubtitle = enriched.title;
            else if ((meta as any)?.name) displaySubtitle = (meta as any).name;
        } else {
            if (enriched?.title) displayTitle = enriched.title;
            else if ((meta as any)?.name) displayTitle = (meta as any).name;
        }

        if (enriched?.poster) displayArtwork = enriched.poster;
        else if ((meta as any)?.poster) displayArtwork = (meta as any).poster;

        return {
            title: displayTitle,
            subtitle: displaySubtitle,
            artworkUrl: displayArtwork || undefined,
        };
    }, [contentType, derivedTitle, enriched?.poster, enriched?.title, episodeTitle, meta, poster]);

    // Streams from session store act as warm cache.
    useEffect(() => {
        if (!sessionId) return;
        if (!Array.isArray(session?.streams)) return;
        setAvailableStreams(session.streams as any[]);
    }, [session?.streams, sessionId]);

    const loadStreamsFor = useCallback(
        async (t: PlayerContentType, videoId: string) => {
            if (!videoId) return;
            setStreamsLoading(true);
            try {
                const streams = await getStreams(t, videoId);
                setAvailableStreams(streams);
                useNativePlayerSessionStore.getState().patchSession(sessionId, { streams });
            } catch (e) {
                console.error('[PlayerOverlayRoot] Failed to fetch streams', e);
                setAvailableStreams([]);
            } finally {
                setStreamsLoading(false);
            }
        },
        [getStreams, sessionId]
    );

    useEffect(() => {
        if (!sessionId || !contentId) return;
        if (pendingEpisode) return;

        let cancelled = false;
        setStreamsLoading(true);

        getStreams(contentType, contentId)
            .then((streams) => {
                if (!cancelled) {
                    setAvailableStreams(streams);
                    useNativePlayerSessionStore.getState().patchSession(sessionId, { streams });
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    console.error('[PlayerOverlayRoot] Failed to fetch streams', e);
                    setAvailableStreams([]);
                }
            })
            .finally(() => {
                if (!cancelled) setStreamsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [contentId, contentType, getStreams, pendingEpisode, sessionId]);

    // Clear any external subtitle selection when content changes.
    useEffect(() => {
        setSelectedExternalSubtitleUrl(null);
        setSubtitleCues([]);
        setCurrentSubtitleText('');
        lastCueIndexRef.current = 0;
    }, [contentId]);

    // Fetch external subtitles (addon-based)
    useEffect(() => {
        if (!sessionId || !contentId) return;

        const addonUrls = Object.keys(manifests || {});
        if (addonUrls.length === 0) {
            setExternalSubtitles([]);
            return;
        }

        let cancelled = false;
        setExternalSubtitlesLoading(true);

        AddonService.fetchAllSubtitles(addonUrls, contentType, contentId)
            .then((subs) => {
                if (cancelled) return;
                const list = (subs || []).map((s: any) => ({
                    id: String(s.url || s.id || Math.random()),
                    title: String(s.title || s.name || s.language || 'Subtitle'),
                    language: s.language ? String(s.language) : undefined,
                    url: String(s.url || ''),
                    addonName: s.addonName ? String(s.addonName) : undefined,
                })).filter((s: any) => typeof s.url === 'string' && s.url.length > 0);
                setExternalSubtitles(list);
            })
            .catch((e) => {
                if (cancelled) return;
                console.error('[PlayerOverlayRoot] Failed to fetch subtitles', e);
                setExternalSubtitles([]);
            })
            .finally(() => {
                if (!cancelled) setExternalSubtitlesLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [contentId, contentType, manifests, sessionId]);

    // Load/parse external subtitle file when selected.
    useEffect(() => {
        if (!selectedExternalSubtitleUrl) {
            setSubtitleCues([]);
            setCurrentSubtitleText('');
            return;
        }

        const controller = new AbortController();
        setSubtitleFileLoading(true);
        setCurrentSubtitleText('');
        lastCueIndexRef.current = 0;

        fetch(selectedExternalSubtitleUrl, { signal: controller.signal })
            .then((r) => r.text())
            .then((text) => {
                const cues = parseSubtitle(text, selectedExternalSubtitleUrl);
                setSubtitleCues(cues);
            })
            .catch((e) => {
                if (controller.signal.aborted) return;
                console.error('[PlayerOverlayRoot] Failed to load subtitle file', e);
                setSubtitleCues([]);
            })
            .finally(() => {
                if (!controller.signal.aborted) setSubtitleFileLoading(false);
            });

        return () => {
            controller.abort();
        };
    }, [selectedExternalSubtitleUrl]);

    // Compute active external subtitle text.
    useEffect(() => {
        if (!selectedExternalSubtitleUrl) {
            if (currentSubtitleText) setCurrentSubtitleText('');
            return;
        }
        if (!subtitleCues || subtitleCues.length === 0) {
            if (currentSubtitleText) setCurrentSubtitleText('');
            return;
        }

        const adjustedPosition = progress.position - subtitleDelay;
        const cues = subtitleCues as Array<{ start: number; end: number; text: string }>;

        let idx = Math.max(0, Math.min(cues.length - 1, lastCueIndexRef.current || 0));
        const inCue = (i: number) => cues[i] && adjustedPosition >= cues[i].start && adjustedPosition <= cues[i].end;

        if (!inCue(idx)) {
            // Try adjacent cues first.
            if (idx + 1 < cues.length && inCue(idx + 1)) idx = idx + 1;
            else if (idx - 1 >= 0 && inCue(idx - 1)) idx = idx - 1;
            else {
                // Fallback scan.
                idx = cues.findIndex((c) => adjustedPosition >= c.start && adjustedPosition <= c.end);
            }
        }

        const nextText = idx >= 0 ? String(cues[idx]?.text || '') : '';
        if (nextText !== currentSubtitleText) {
            setCurrentSubtitleText(nextText);
        }
        if (idx >= 0) lastCueIndexRef.current = idx;
    }, [currentSubtitleText, progress.position, selectedExternalSubtitleUrl, subtitleCues, subtitleDelay]);

    const subtitleOptions = useMemo(() => {
        const embedded = (subtitleTracks || []).map((t: any) => ({
            key: `sid:${t.id}`,
            kind: 'embedded' as const,
            trackId: Number(t.id),
            title: String(t.title || t.name || t.language || `Subtitle ${t.id}`),
        }));
        const external = (externalSubtitles || []).map((t) => ({
            key: `ext:${t.url}`,
            kind: 'external' as const,
            url: t.url,
            title: `${t.title}${t.language ? ` (${t.language})` : ''}${t.addonName ? ` - ${t.addonName}` : ''}`,
        }));
        return [{ key: 'off', kind: 'off' as const, title: 'Off' }, ...embedded, ...external];
    }, [externalSubtitles, subtitleTracks]);

    // Fetch Intro Data (series only)
    const [introTimestamps, setIntroTimestamps] = useState<IntroTimestamps | null>(null);
    useEffect(() => {
        const fetchIntro = async () => {
            if (contentType !== 'series' || !contentId) {
                setIntroTimestamps(null);
                return;
            }

            const season = pickSeasonFromId(contentId);
            const episode = pickEpisodeFromId(contentId);
            if (!season || !episode) {
                setIntroTimestamps(null);
                return;
            }

            const parts = String(contentId).split(':');
            const imdbFallback = parts[0]?.startsWith('tt') ? parts[0] : null;
            const imdbId = (enriched as any)?.imdbId || imdbFallback;
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

        fetchIntro();
    }, [contentId, contentType, enriched]);

    const [showUpNext, setShowUpNext] = useState(false);

    const resetControlsTimer = useCallback(() => {
        if (isPipMode) return;
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        setShowControls(true);
        if (activeTab === 'none') {
            controlsTimer.current = setTimeout(() => setShowControls(false), 5000);
        }
    }, [activeTab, isPipMode]);

    useEffect(() => {
        if (isPipMode) return;
        if (activeTab !== 'none') {
            if (controlsTimer.current) clearTimeout(controlsTimer.current);
            setShowControls(true);
        } else {
            resetControlsTimer();
        }
    }, [activeTab, isPipMode, resetControlsTimer]);

    // PiP events
    useEffect(() => {
        const pipSubscription = DeviceEventEmitter.addListener('onPipModeChanged', (isPip: boolean) => {
            setIsPipMode(!!isPip);
            if (isPip) {
                setShowControls(false);
                setActiveTab('none');
                if (controlsTimer.current) clearTimeout(controlsTimer.current);
            } else {
                setShowControls(true);
                setActiveTab('none');
                if (controlsTimer.current) clearTimeout(controlsTimer.current);
                controlsTimer.current = setTimeout(() => setShowControls(false), 5000);
            }
        });

        const pipWillEnterSubscription = DeviceEventEmitter.addListener('onPipWillEnter', () => {
            setIsPipMode(true);
            setShowControls(false);
            setActiveTab('none');
            if (controlsTimer.current) clearTimeout(controlsTimer.current);
        });

        const pipDismissedSubscription = DeviceEventEmitter.addListener('onPipDismissed', () => {
            setPaused(true);
            useNativePlayerSessionStore.getState().patchSession(sessionId, { paused: true });
            setIsPipMode(false);
            setShowControls(false);
            setActiveTab('none');
            if (controlsTimer.current) clearTimeout(controlsTimer.current);
        });

        // Sync initial state in case the event was missed.
        if (Platform.OS === 'android' && CrispyNativeCore.isInPiPMode) {
            void CrispyNativeCore.isInPiPMode().then((v: boolean) => {
                if (v) {
                    setIsPipMode(true);
                    setShowControls(false);
                    setActiveTab('none');
                }
            });
        }

        return () => {
            pipSubscription.remove();
            pipWillEnterSubscription.remove();
            pipDismissedSubscription.remove();
        };
    }, [sessionId]);

    // Background: hide overlays.
    useEffect(() => {
        if (Platform.OS !== 'android') return;
        const sub = AppState.addEventListener('change', (state) => {
            if (state !== 'active') {
                setShowControls(false);
                setActiveTab('none');
            } else {
                resetControlsTimer();
            }
        });
        return () => sub.remove();
    }, [resetControlsTimer]);

    // Native player events
    useEffect(() => {
        if (!sessionId) return;

        const nativeEvents = DeviceEventEmitter.addListener('nativePlayerEvent', (evt: NativePlayerEvent) => {
            if (!evt || evt.sessionId !== sessionId) return;

            const type = evt.type;
            if (type === 'load') {
                setLastError(null);
                const duration = typeof (evt as any).duration === 'number' ? (evt as any).duration : 0;
                if (duration > 0 && stableDuration <= 0) {
                    setStableDuration(duration);
                }
                if (duration > 0) {
                    setProgress((p) => ({ ...p, duration }));
                }
                setLoadingStreamSwitch(false);

                // Fallback: seek after load if first-frame event isn't available yet.
                if (pendingSeekAfterLoadRef.current !== null) {
                    const target = pendingSeekAfterLoadRef.current;
                    pendingSeekAfterLoadRef.current = null;
                    setTimeout(() => {
                        void CrispyNativeCore.nativePlayerSeek(target);
                    }, 250);
                }
                return;
            }

            if (type === 'progress') {
                const position = typeof (evt as any).position === 'number' ? (evt as any).position : 0;
                const duration = typeof (evt as any).duration === 'number' ? (evt as any).duration : 0;
                if (duration > 0 && stableDuration <= 0) {
                    setStableDuration(duration);
                }

                if (!isSeeking) {
                    setProgress({ position, duration });
                }

                if (contentType === 'series' && duration > 0) {
                    const timeLeft = duration - position;
                    if (timeLeft <= UP_NEXT_TRIGGER_SECONDS && timeLeft > 0 && !showUpNext) {
                        setShowUpNext(true);
                    } else if ((timeLeft > UP_NEXT_TRIGGER_SECONDS || timeLeft <= 0) && showUpNext) {
                        setShowUpNext(false);
                    }
                }
                return;
            }

            if (type === 'tracks') {
                const a = (evt as any).audioTracks || [];
                const s = (evt as any).subtitleTracks || [];
                const mappedAudio = a.map((t: any) => ({ ...t, title: t.name || t.title || t.language || `Track ${t.id}` }));
                const mappedSubtitles = s.map((t: any) => ({ ...t, title: t.name || t.title || t.language || 'Unknown' }));

                setAudioTracks(mappedAudio);
                setSubtitleTracks(mappedSubtitles);

                const selectedAudio = mappedAudio.find((t: any) => t?.selected === true);
                const selectedSub = mappedSubtitles.find((t: any) => t?.selected === true);

                if (selectedAudio && Number.isFinite(Number(selectedAudio.id))) {
                    setSelectedAudioId(Number(selectedAudio.id));
                }
                if (selectedSub && Number.isFinite(Number(selectedSub.id))) {
                    setSelectedSubtitleId(Number(selectedSub.id));
                }
                return;
            }

            if (type === 'isPlaying') {
                const isPlaying = !!(evt as any).isPlaying;
                const nextPaused = !isPlaying;
                setPaused(nextPaused);
                useNativePlayerSessionStore.getState().patchSession(sessionId, { paused: nextPaused });
                return;
            }

            if (type === 'buffering') {
                setBuffering(!!(evt as any).buffering);
                return;
            }

            if (type === 'first-frame') {
                setFirstFrameRendered(true);
                setBuffering(false);
                if (pendingSeekAfterLoadRef.current !== null) {
                    const target = pendingSeekAfterLoadRef.current;
                    pendingSeekAfterLoadRef.current = null;
                    void CrispyNativeCore.nativePlayerSeek(target);
                }
                return;
            }

            if (type === 'error') {
                setLastError((evt as any).message || 'Playback error');
                setLoadingStreamSwitch(false);
                return;
            }

            if (type === 'end') {
                void CrispyNativeCore.closePlayerActivity();
            }
        });

        return () => {
            nativeEvents.remove();
        };
        // stableDuration/isSeeking/showUpNext/contentType are intentionally part of the closure.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contentType, isSeeking, sessionId, showUpNext, stableDuration]);

    const onClose = useCallback(() => {
        void CrispyNativeCore.closePlayerActivity();
    }, []);

    const togglePlay = useCallback(() => {
        const nextPaused = !paused;
        setPaused(nextPaused);
        useNativePlayerSessionStore.getState().patchSession(sessionId, { paused: nextPaused });

        playPauseScale.value = withSequence(withTiming(0.85, { duration: 100 }), withTiming(1, { duration: 150 }));

        void CrispyNativeCore.nativePlayerSetPaused(nextPaused);
        resetControlsTimer();
    }, [paused, playPauseScale, resetControlsTimer, sessionId]);

    const handleSeek = useCallback(
        (direction: 'forward' | 'backward') => {
            if (seekAccumulationTimer.current) clearTimeout(seekAccumulationTimer.current);

            setSeekAccumulation((prev) => {
                const isSameDirection = prev.direction === direction;
                const newAmount = isSameDirection ? prev.amount + 10 : 10;

                if (seekBasePosition.current === null || !isSameDirection) {
                    seekBasePosition.current = progress.position;
                }

                const totalDelta = direction === 'forward' ? newAmount : -newAmount;
                const dur = stableDuration || progress.duration;
                const targetPos = Math.max(0, Math.min(dur > 0 ? dur : Number.MAX_SAFE_INTEGER, (seekBasePosition.current ?? 0) + totalDelta));

                void CrispyNativeCore.nativePlayerSeek(targetPos);
                setProgress((p) => ({ ...p, position: targetPos }));

                return { amount: newAmount, direction };
            });

            seekAccumulationTimer.current = setTimeout(() => {
                setSeekAccumulation({ amount: 0, direction: null });
                seekBasePosition.current = null;
            }, 800);

            resetControlsTimer();
        },
        [progress.duration, progress.position, resetControlsTimer, stableDuration]
    );

    const handleTouchEnd = useCallback(
        (e: any) => {
            const now = Date.now();
            const { locationX: x } = e.nativeEvent;

            if (now - lastTapRef.current.time < 300) {
                if (x < width * 0.3) {
                    handleSeek('backward');
                } else if (x > width * 0.7) {
                    handleSeek('forward');
                }
            } else {
                if (showControls) {
                    setShowControls(false);
                    if (controlsTimer.current) clearTimeout(controlsTimer.current);
                } else {
                    resetControlsTimer();
                }
            }

            lastTapRef.current = { time: now, x };
        },
        [handleSeek, resetControlsTimer, showControls, width]
    );

    const onSelectSpeed = useCallback(
        (rate: number) => {
            setPlaybackRate(rate);
            void CrispyNativeCore.nativePlayerSetRate(rate);
            resetControlsTimer();
        },
        [resetControlsTimer]
    );

    const onSelectResizeMode = useCallback(
        (mode: 'contain' | 'cover' | 'stretch') => {
            setResizeMode(mode);
            void CrispyNativeCore.nativePlayerSetResizeMode(mode);
            resetControlsTimer();
        },
        [resetControlsTimer]
    );

    const onUpdateSubtitleDelay = useCallback(
        (delaySec: number) => {
            setSubtitleDelay(delaySec);
            void CrispyNativeCore.nativePlayerSetSubtitleDelay(delaySec);
            resetControlsTimer();
        },
        [resetControlsTimer]
    );

    const resolveStreamUrl = useCallback(
        async (stream: any) => {
            const directUrl = stream?.url;
            if (typeof directUrl === 'string' && directUrl.length > 0) {
                return { url: directUrl, infoHash: undefined as string | undefined, fileIdx: undefined as number | undefined };
            }

            const infoHash = stream?.infoHash;
            const fileIdx = typeof stream?.fileIdx === 'number' ? stream.fileIdx : -1;
            if (typeof infoHash === 'string' && infoHash.length > 0) {
                const localUrl = await CrispyNativeCore.startStream(infoHash, fileIdx, sessionId);
                if (!localUrl) return null;
                return { url: localUrl, infoHash, fileIdx: fileIdx >= 0 ? fileIdx : undefined };
            }
            return null;
        },
        [sessionId]
    );

    const switchToStream = useCallback(
        async (stream: any, options?: { nextContentId?: string; nextEpisodeTitle?: string; nextShowTitle?: string; nextPoster?: string; nextStreams?: any[] }) => {
            setLastError(null);
            setLoadingStreamSwitch(true);
            setFirstFrameRendered(false);
            setBuffering(true);

            // External subtitle overlay is stream/content scoped.
            setSelectedExternalSubtitleUrl(null);
            setSubtitleCues([]);
            setCurrentSubtitleText('');
            lastCueIndexRef.current = 0;

            const resolved = await resolveStreamUrl(stream);
            if (!resolved) {
                setLoadingStreamSwitch(false);
                setBuffering(false);
                setLastError('Failed to resolve stream');
                return;
            }

            const nextHeaders = stream?.behaviorHints?.headers as Record<string, string> | undefined;
            const nextId = options?.nextContentId;
            const nextPoster = options?.nextPoster;
            const nextShowTitle = options?.nextShowTitle;
            const nextEpisodeTitle = options?.nextEpisodeTitle;
            const nextStreams = options?.nextStreams;

            const md: CrispyMediaMetadata = {
                title: nextEpisodeTitle || mediaMetadata.title,
                subtitle: nextShowTitle || mediaMetadata.subtitle,
                artworkUrl: nextPoster || mediaMetadata.artworkUrl,
            };

            // Preserve position on quality switch.
            pendingSeekAfterLoadRef.current = pendingEpisode ? 0 : progress.position;

            // Patch session so other RN roots can display the updated context.
            useNativePlayerSessionStore.getState().patchSession(sessionId, {
                id: nextId ?? contentId,
                type: nextId ? 'series' : contentType,
                title: nextShowTitle ?? derivedTitle,
                episodeTitle: nextEpisodeTitle ?? episodeTitle,
                poster: nextPoster ?? poster,
                url: resolved.url,
                headers: nextHeaders,
                streams: nextStreams ?? availableStreams,
                infoHash: resolved.infoHash,
                fileIdx: resolved.fileIdx,
                paused,
                artist: md.subtitle,
                artworkUrl: md.artworkUrl,
            });

            await CrispyNativeCore.nativePlayerLoad({
                url: resolved.url,
                headers: nextHeaders,
                paused,
                metadata: md,
            });

            setActiveTab('none');
            setPendingEpisode(null);
        },
        [availableStreams, contentId, contentType, derivedTitle, episodeTitle, mediaMetadata, paused, poster, progress.position, resolveStreamUrl, sessionId]
    );

    const showLoadingCurtain = useMemo(() => {
        if (isPipMode) return false;
        if (loadingStreamSwitch) return true;
        if (buffering) return true;
        if (!firstFrameRendered && (progress.position <= 0 && (stableDuration || progress.duration) <= 0)) return true;
        return false;
    }, [buffering, firstFrameRendered, isPipMode, loadingStreamSwitch, progress.duration, progress.position, stableDuration]);

    if (isPipMode) {
        return <View style={styles.pipContainer} pointerEvents="none" />;
    }

    return (
        <View style={styles.container} pointerEvents="box-none">
            {/* LOADING CURTAIN OVERLAY */}
            {showLoadingCurtain && (
                <View style={styles.centerLoading} pointerEvents="none">
                    <LoadingIndicator size="large" color={theme.colors.primary} />
                    <Typography variant="body" className="text-white mt-4">
                        {loadingStreamSwitch ? 'Switching Stream...' : buffering ? 'Buffering...' : 'Loading...'}
                    </Typography>
                </View>
            )}

            {/* Skip Intro Button Overlay */}
            {settings.introSkipMode !== 'off' &&
                introTimestamps &&
                progress.position >= introTimestamps.start &&
                progress.position <= introTimestamps.end && (
                    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.skipIntroContainer}>
                        <Pressable
                            style={[styles.skipIntroBtn, { backgroundColor: theme.colors.primary, borderColor: theme.colors.outline }]}
                            onPress={() => {
                                void CrispyNativeCore.nativePlayerSeek(introTimestamps.end);
                                setProgress((p) => ({ ...p, position: introTimestamps.end }));
                                resetControlsTimer();
                            }}
                        >
                            <StepForward size={20} color={theme.colors.onPrimary} style={{ marginRight: 8 }} />
                            <Typography variant="label" style={{ color: theme.colors.onPrimary }}>
                                SKIP INTRO
                            </Typography>
                        </Pressable>
                    </Animated.View>
                )}

            {/* Up Next Overlay */}
            {showUpNext && contentType === 'series' && (
                <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.upNextContainer}>
                    <View style={[styles.upNextCard, { backgroundColor: 'rgba(30,30,30,0.95)' }]}> 
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            {!!poster && <Image source={{ uri: poster }} style={styles.upNextPoster} />}
                            <View style={{ flex: 1, justifyContent: 'center' }}>
                                <Typography variant="label-small" style={{ color: theme.colors.primary }}>
                                    UP NEXT
                                </Typography>
                                <Typography variant="title-medium" style={{ color: 'white' }} numberOfLines={1}>
                                    {derivedTitle}
                                </Typography>
                                <Typography variant="body-small" style={{ color: 'rgba(255,255,255,0.7)' }} numberOfLines={1}>
                                    Next Episode
                                </Typography>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                            <Pressable
                                style={[styles.upNextActionBtn, { backgroundColor: theme.colors.primary, flex: 2 }]}
                                onPress={() => {
                                    const currentEp = pickEpisodeFromId(contentId);
                                    if (!currentEp) {
                                        setShowUpNext(false);
                                        return;
                                    }
                                    const nextEpNum = currentEp + 1;
                                    const nextEp = (seasonEpisodes || []).find((e: any) => Number(e.episode) === nextEpNum);
                                    if (nextEp) {
                                        const videoId = `${baseId}:${activeSeason}:${nextEpNum}`;
                                        setPendingEpisode({
                                            videoId,
                                            season: activeSeason,
                                            episode: nextEpNum,
                                            episodeTitle: nextEp.name || nextEp.title,
                                        });
                                        setActiveTab('streams');
                                        void loadStreamsFor('series', videoId);
                                    } else {
                                        setShowUpNext(false);
                                    }
                                }}
                            >
                                <Typography variant="label" style={{ color: theme.colors.onPrimary }}>
                                    PLAY NEXT
                                </Typography>
                            </Pressable>
                            <Pressable style={[styles.upNextActionBtn, { backgroundColor: 'rgba(255,255,255,0.1)', flex: 1 }]} onPress={() => setShowUpNext(false)}>
                                <Typography variant="label" style={{ color: 'white' }}>
                                    CANCEL
                                </Typography>
                            </Pressable>
                        </View>
                    </View>
                </Animated.View>
            )}

            {/* External Subtitles Overlay */}
            <CustomSubtitles
                visible={!isPipMode && !!selectedExternalSubtitleUrl && !!currentSubtitleText}
                text={currentSubtitleText}
                fontSize={subtitleSize}
                bottomOffset={(showControls ? 110 : 40) + subtitleOffset}
            />

            {/* Gesture Layer & Controls */}
            <Pressable style={StyleSheet.absoluteFill} pointerEvents={isPipMode ? 'none' : 'auto'} onPress={isPipMode ? undefined : handleTouchEnd}>
                {showControls && !isPipMode && (
                    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.overlay}>
                        {/* Top Bar */}
                        <View style={styles.topBar}>
                            <Pressable onPress={onClose} style={styles.backBtn}>
                                <ArrowLeft color="#fff" size={24} />
                            </Pressable>
                            <View style={styles.titlesContainer}>
                                <Text style={styles.mainTitle} numberOfLines={1}>
                                    {derivedTitle}
                                </Text>
                                {!!episodeTitle && (
                                    <Text style={styles.subTitle} numberOfLines={1}>
                                        {episodeTitle}
                                    </Text>
                                )}
                                {!!lastError && (
                                    <Text style={[styles.subTitle, { color: 'rgba(255,120,120,0.95)' }]} numberOfLines={2}>
                                        {lastError}
                                    </Text>
                                )}
                            </View>
                        </View>

                        {/* Center Area */}
                        <View style={styles.centerArea} pointerEvents="box-none">
                            {seekAccumulation.direction === 'backward' && (
                                <Animated.View style={[styles.seekFeedbackLeft, feedbackAnimatedStyle]}>
                                    <StepBack color="#fff" size={24} />
                                    <Text style={styles.seekFeedbackText}>{seekAccumulation.amount}s</Text>
                                </Animated.View>
                            )}

                            {seekAccumulation.direction === 'forward' && (
                                <Animated.View style={[styles.seekFeedbackRight, feedbackAnimatedStyle]}>
                                    <StepForward color="#fff" size={24} />
                                    <Text style={styles.seekFeedbackText}>{seekAccumulation.amount}s</Text>
                                </Animated.View>
                            )}

                            <Animated.View style={[styles.centerPlayBtn, playPauseAnimatedStyle]}>
                                <Pressable onPress={togglePlay} style={styles.centerPlayPressable}>
                                    {paused ? <Play color="#fff" size={32} fill="#fff" style={{ marginLeft: 3 }} /> : <Pause color="#fff" size={32} fill="#fff" />}
                                </Pressable>
                            </Animated.View>
                        </View>

                        {/* Bottom Controls */}
                        <View style={styles.bottomArea}>
                            <View
                                style={styles.progressContainer}
                                onStartShouldSetResponder={() => true}
                                onMoveShouldSetResponder={() => true}
                                onResponderGrant={(e) => {
                                    setIsSeeking(true);
                                    const { pageX } = e.nativeEvent;
                                    const duration = stableDuration || progress.duration;
                                    const percentage = Math.max(0, Math.min(1, pageX / width));
                                    const targetPos = (duration > 0 ? duration : 0) * percentage;
                                    void CrispyNativeCore.nativePlayerSeek(targetPos);
                                    resetControlsTimer();
                                    setProgress((p) => ({ ...p, position: targetPos }));
                                }}
                                onResponderMove={(e) => {
                                    const { pageX } = e.nativeEvent;
                                    const duration = stableDuration || progress.duration;
                                    const percentage = Math.max(0, Math.min(1, pageX / width));
                                    const targetPos = (duration > 0 ? duration : 0) * percentage;
                                    void CrispyNativeCore.nativePlayerSeek(targetPos);
                                    resetControlsTimer();
                                    setProgress((p) => ({ ...p, position: targetPos }));
                                }}
                                onResponderRelease={() => {
                                    setTimeout(() => setIsSeeking(false), 500);
                                }}
                            >
                                {(() => {
                                    const duration = stableDuration || progress.duration || 1;
                                    const rawPercent = (progress.position / duration) * 100;
                                    const percent = Math.max(0, Math.min(100, rawPercent));
                                    const fillWidth = Math.max(0, percent - 0.8);
                                    const inactiveLeft = Math.min(100, percent + 0.8);

                                    return (
                                        <View style={styles.progressBackground}>
                                            <View style={[styles.progressFill, { backgroundColor: theme.colors.primary, width: `${fillWidth}%` }]} />
                                            <View style={[styles.progressInactive, { left: `${inactiveLeft}%`, right: 0 }]} />
                                            <View style={[styles.progressThumb, { left: `${percent}%`, backgroundColor: '#fff' }]} />
                                        </View>
                                    );
                                })()}
                            </View>

                            <View style={styles.controlsRow}>
                                <View style={styles.timePill}>
                                    <Text style={styles.timeText}>{formatTime(progress.position)}</Text>
                                    <Text style={[styles.timeText, { opacity: 0.5, marginHorizontal: 4 }]}>/</Text>
                                    <Text style={styles.timeText}>{formatTime(stableDuration || progress.duration)}</Text>
                                </View>

                                <View style={styles.actionsPill}>
                                    {[
                                        { icon: Headphones, key: 'audio' },
                                        { icon: Languages, key: 'subtitles' },
                                        { icon: Layers, key: 'streams' },
                                        { icon: Settings, key: 'settings' },
                                        { icon: Info, key: 'info' },
                                    ].map((item, i) => (
                                        <Pressable
                                            key={i}
                                            style={styles.actionIconBtn}
                                            onPress={() => {
                                                setActiveTab(item.key as ActiveTab);
                                            }}
                                        >
                                            <item.icon color="#fff" size={20} />
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        </View>
                    </Animated.View>
                )}
            </Pressable>

            {/* Side Sheet */}
            <SideSheet
                isVisible={activeTab !== 'none'}
                onClose={() => {
                    setActiveTab('none');
                    if (pendingEpisode) setPendingEpisode(null);
                }}
                title={activeTab !== 'none' ? activeTab.charAt(0).toUpperCase() + activeTab.slice(1) : undefined}
            >
                <View style={{ flex: 1 }}>
                    {activeTab === 'audio' && (
                        <AudioTab
                            tracks={audioTracks}
                            selectedTrackId={selectedAudioId}
                            onSelectTrack={(track) => {
                                const id = Number(track.id);
                                setSelectedAudioId(Number.isFinite(id) ? id : undefined);
                                void CrispyNativeCore.nativePlayerSetAudioTrack(id);
                                setActiveTab('none');
                            }}
                        />
                    )}

                    {activeTab === 'subtitles' && (
                        <View style={{ flex: 1 }}>
                            {(externalSubtitlesLoading || subtitleFileLoading) && (
                                <View style={styles.inlineLoadingRow}>
                                    <ActivityIndicator size="small" color={theme.colors.primary} />
                                    <Text style={styles.inlineLoadingText}>
                                        {subtitleFileLoading ? 'Loading subtitle...' : 'Fetching subtitles...'}
                                    </Text>
                                </View>
                            )}

                            <FlatList
                                data={subtitleOptions}
                                keyExtractor={(item) => item.key}
                                contentContainerStyle={{ paddingBottom: 14 }}
                                renderItem={({ item }) => {
                                    const selected =
                                        item.kind === 'off'
                                            ? !selectedExternalSubtitleUrl && selectedSubtitleId < 0
                                            : item.kind === 'embedded'
                                              ? !selectedExternalSubtitleUrl && selectedSubtitleId === item.trackId
                                              : selectedExternalSubtitleUrl === item.url;

                                    return (
                                        <Pressable
                                            style={[styles.subtitleRow, selected && styles.subtitleRowSelected]}
                                            onPress={() => {
                                                if (item.kind === 'off') {
                                                    setSelectedExternalSubtitleUrl(null);
                                                    setSubtitleCues([]);
                                                    setCurrentSubtitleText('');
                                                    lastCueIndexRef.current = 0;
                                                    setSelectedSubtitleId(-1);
                                                    void CrispyNativeCore.nativePlayerSetSubtitleTrack(-1);
                                                    return;
                                                }

                                                if (item.kind === 'embedded') {
                                                    setSelectedExternalSubtitleUrl(null);
                                                    setSubtitleCues([]);
                                                    setCurrentSubtitleText('');
                                                    lastCueIndexRef.current = 0;
                                                    setSelectedSubtitleId(item.trackId);
                                                    void CrispyNativeCore.nativePlayerSetSubtitleTrack(item.trackId);
                                                    return;
                                                }

                                                // external
                                                setSelectedSubtitleId(-1);
                                                void CrispyNativeCore.nativePlayerSetSubtitleTrack(-1);
                                                setSelectedExternalSubtitleUrl(item.url);
                                            }}
                                        >
                                            <Text style={styles.subtitleRowText} numberOfLines={2}>
                                                {item.title}
                                            </Text>
                                        </Pressable>
                                    );
                                }}
                            />

                            <View style={styles.subtitleControls}>
                                <SubtitlesTab delay={subtitleDelay} onUpdateDelay={onUpdateSubtitleDelay} />

                                {!!selectedExternalSubtitleUrl && (
                                    <View style={styles.subtitleTuning}>
                                        <View style={styles.subtitleTuningRow}>
                                            <Text style={styles.subtitleTuningLabel}>Size</Text>
                                            <Pressable
                                                style={styles.subtitleTuningBtn}
                                                onPress={() => setSubtitleSize((s) => Math.max(12, s - 2))}
                                            >
                                                <Text style={styles.subtitleTuningBtnText}>-</Text>
                                            </Pressable>
                                            <Text style={styles.subtitleTuningValue}>{subtitleSize}</Text>
                                            <Pressable
                                                style={styles.subtitleTuningBtn}
                                                onPress={() => setSubtitleSize((s) => Math.min(64, s + 2))}
                                            >
                                                <Text style={styles.subtitleTuningBtnText}>+</Text>
                                            </Pressable>
                                        </View>

                                        <View style={styles.subtitleTuningRow}>
                                            <Text style={styles.subtitleTuningLabel}>Offset</Text>
                                            <Pressable
                                                style={styles.subtitleTuningBtn}
                                                onPress={() => setSubtitleOffset((o) => Math.max(-200, o - 10))}
                                            >
                                                <Text style={styles.subtitleTuningBtnText}>-</Text>
                                            </Pressable>
                                            <Text style={styles.subtitleTuningValue}>{subtitleOffset}</Text>
                                            <Pressable
                                                style={styles.subtitleTuningBtn}
                                                onPress={() => setSubtitleOffset((o) => Math.min(200, o + 10))}
                                            >
                                                <Text style={styles.subtitleTuningBtnText}>+</Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {activeTab === 'settings' && (
                        <SettingsTab
                            playbackSpeed={playbackRate}
                            onSelectSpeed={onSelectSpeed}
                            resizeMode={resizeMode}
                            onSelectResizeMode={onSelectResizeMode}
                        />
                    )}

                    {activeTab === 'streams' && (
                        <StreamsTab
                            streams={availableStreams}
                            currentStreamUrl={session?.url || props.url || ''}
                            isLoading={streamsLoading}
                            onSelectStream={(stream) => {
                                if (pendingEpisode) {
                                    const nextTitle = enriched?.title || (meta as any)?.name || derivedTitle || 'Video';
                                    const epName = pendingEpisode.episodeTitle || '';
                                    const nextEpisodeTitle = `S${pendingEpisode.season}:E${pendingEpisode.episode}${epName ? ` - ${epName}` : ''}`;
                                    const artwork = enriched?.poster || (meta as any)?.poster || poster;
                                    void switchToStream(stream, {
                                        nextContentId: pendingEpisode.videoId,
                                        nextShowTitle: nextTitle,
                                        nextEpisodeTitle,
                                        nextPoster: artwork,
                                        nextStreams: availableStreams,
                                    });
                                    return;
                                }

                                void switchToStream(stream);
                            }}
                        />
                    )}

                    {activeTab === 'info' && (
                        <InfoTab
                            meta={Object.keys(enriched || {}).length > 0 ? enriched : meta || {}}
                            seasonEpisodes={seasonEpisodes}
                            activeSeason={activeSeason}
                            onSeasonChange={setActiveSeason}
                            currentEpisodeId={String(contentId).split(':').slice(-1)[0]}
                            onSelectEpisode={(ep) => {
                                const seasonNum = activeSeason;
                                const episodeNum = Number(ep?.episode ?? ep?.number ?? ep?.episodeNumber);
                                if (!baseId || !seasonNum || !episodeNum) return;

                                const videoId = `${baseId}:${seasonNum}:${episodeNum}`;
                                if (videoId === contentId) {
                                    setPendingEpisode(null);
                                    setActiveTab('streams');
                                    void loadStreamsFor(contentType, contentId);
                                    return;
                                }

                                setPendingEpisode({
                                    videoId,
                                    season: seasonNum,
                                    episode: episodeNum,
                                    episodeTitle: ep?.name || ep?.title,
                                });
                                setActiveTab('streams');
                                void loadStreamsFor('series', videoId);
                            }}
                            colors={colors}
                        />
                    )}
                </View>
            </SideSheet>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    pipContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    centerLoading: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    skipIntroContainer: {
        position: 'absolute',
        bottom: 120,
        right: 48,
        zIndex: 100,
    },
    skipIntroBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    upNextContainer: {
        position: 'absolute',
        bottom: 100,
        right: 48,
        width: 320,
        zIndex: 100,
    },
    upNextCard: {
        padding: 16,
        borderRadius: 16,
        overflow: 'hidden',
    },
    upNextPoster: {
        width: 60,
        height: 90,
        borderRadius: 8,
    },
    upNextActionBtn: {
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'space-between',
        paddingVertical: 24,
        paddingHorizontal: Platform.OS === 'ios' ? 48 : 32,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    titlesContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    mainTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    subTitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        marginTop: 2,
    },
    centerArea: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    seekFeedbackLeft: {
        position: 'absolute',
        left: '15%',
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,0,0,0.4)',
        gap: 4,
    },
    seekFeedbackRight: {
        position: 'absolute',
        right: '15%',
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,0,0,0.4)',
        gap: 4,
    },
    seekFeedbackText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    centerPlayBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerPlayPressable: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomArea: {
        gap: 8,
    },
    progressContainer: {
        height: 44,
        justifyContent: 'center',
    },
    progressBackground: {
        height: 10,
        borderRadius: 5,
        position: 'relative',
        width: '100%',
    },
    progressFill: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        borderTopLeftRadius: 5,
        borderBottomLeftRadius: 5,
        borderTopRightRadius: 2,
        borderBottomRightRadius: 2,
    },
    progressInactive: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderTopLeftRadius: 2,
        borderBottomLeftRadius: 2,
        borderTopRightRadius: 5,
        borderBottomRightRadius: 5,
    },
    progressThumb: {
        position: 'absolute',
        top: -8,
        height: 26,
        width: 4,
        borderRadius: 2,
        marginLeft: -2,
        zIndex: 2,
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    timePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    timeText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    actionsPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    actionIconBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 2,
    },

    inlineLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    inlineLoadingText: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 13,
        fontWeight: '500',
    },

    subtitleRow: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'transparent',
    },
    subtitleRowSelected: {
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    subtitleRowText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },

    subtitleControls: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 16,
    },
    subtitleTuning: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    subtitleTuningRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    subtitleTuningLabel: {
        width: 60,
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        fontWeight: '600',
    },
    subtitleTuningBtn: {
        width: 40,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    subtitleTuningBtnText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '800',
        lineHeight: 18,
    },
    subtitleTuningValue: {
        width: 44,
        textAlign: 'center',
        color: 'white',
        fontSize: 14,
        fontWeight: '800',
    },
});
