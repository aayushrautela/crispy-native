import CrispyNativeCore from '@/modules/crispy-native-core';
import { AddonService } from '@/src/core/services/AddonService';
import { IntroService, IntroTimestamps } from '@/src/core/services/IntroService';
import { TMDBService } from '@/src/core/services/TMDBService';
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
import { VideoSurface, VideoSurfaceRef } from '@/src/features/player/components/VideoSurface';
import { parseSubtitle } from '@/src/features/player/utils/subtitleParser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
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
    StepForward
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, DeviceEventEmitter, Image, Platform, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import Animated, {
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming
} from 'react-native-reanimated';

const SafeOrientation = ScreenOrientation || {};

const LOCAL_STREAM_BASE = 'http://127.0.0.1:11470';

const INTRO_SKIP_TO_SECONDS = 85;
const UP_NEXT_TRIGGER_SECONDS = 25;

const normalizeLocalStreamUrl = (url: string) => {
    if (!url) return url;
    return url
        .replace('http://localhost:11470', LOCAL_STREAM_BASE)
        .replace('http://127.0.0.1:11470', LOCAL_STREAM_BASE);
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type ContentType = 'movie' | 'series';

const pickParam = (v: string | string[] | undefined): string | undefined => {
    if (Array.isArray(v)) return v[0];
    return v;
};

const normalizeContentType = (raw: unknown): ContentType => {
    const t = String(raw ?? '').toLowerCase();
    if (t === 'series' || t === 'show' || t === 'tv') return 'series';
    return 'movie';
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
            if (res.status === 503) {
                await sleep(750);
                continue;
            }

            const body = await res.text().catch(() => '');
            throw new Error(`Unexpected status ${res.status}${body ? `: ${body.slice(0, 120)}` : ''}`);
        } catch {
            // Network errors can happen while the server/service spins up; retry briefly.
            await sleep(750);
        }
    }

    throw new Error(`Timed out waiting for local stream (${timeoutMs}ms)`);
};

type ActiveTab = 'none' | 'audio' | 'subtitles' | 'streams' | 'settings' | 'info';

export default function PlayerScreen() {
    const params = useLocalSearchParams();

    const idParam = pickParam(params.id);
    const typeParam = pickParam(params.type);
    const urlParam = pickParam(params.url);
    const titleParam = pickParam(params.title);
    const infoHashParam = pickParam(params.infoHash);
    const fileIdxParam = pickParam(params.fileIdx);
    const headersParam = pickParam(params.headers);
    const streamsParam = pickParam(params.streams);
    const posterParam = pickParam(params.poster);
    const episodeTitleParam = pickParam(params.episodeTitle);

    const id = idParam || '';
    const type: ContentType = normalizeContentType(typeParam);
    const url = urlParam || '';
    const title = titleParam || '';
    const infoHash = infoHashParam || '';
    const fileIdx = fileIdxParam || '';
    const poster = posterParam || '';
    const episodeTitle = episodeTitleParam || '';

    const { theme } = useTheme();
    const router = useRouter();
    const settings = useUserStore((s) => s.settings);
    const getStreams = useProviderStore((s) => s.getStreams);

    const [finalUrl, setFinalUrl] = useState<string | null>(null);
    const [headers, setHeaders] = useState<Record<string, string> | undefined>(undefined);

    // Internal state for seamless switching (overrides params)
    const [activeStream, setActiveStream] = useState<{ url?: string; infoHash?: string; fileIdx?: number; behaviorHints?: { headers?: Record<string, string> } } | null>(null);
    const [resumePosition, setResumePosition] = useState<number | null>(null);

    const [availableStreams, setAvailableStreams] = useState<any[]>([]); // For StreamsTab
    const [streamsLoading, setStreamsLoading] = useState(false);
    const [pendingEpisode, setPendingEpisode] = useState<null | { videoId: string; season: number; episode: number; episodeTitle?: string }>(null);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [paused, setPaused] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [progress, setProgress] = useState({ position: 0, duration: 0 });
    const [stableDuration, setStableDuration] = useState(0); // Prevent duration flicker
    const [isSeeking, setIsSeeking] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>('none');
    const [isPipMode, setIsPipMode] = useState(false);
    const [videoNaturalSize, setVideoNaturalSize] = useState<{ width: number; height: number } | null>(null);
    const [resizeMode, setResizeMode] = useState<'contain' | 'cover' | 'stretch'>('contain');

    const [introTimestamps, setIntroTimestamps] = useState<IntroTimestamps | null>(null);

    const [showUpNext, setShowUpNext] = useState(false);
    const [upNextTimer, setUpNextTimer] = useState(0);

    // If we navigate to a different item (e.g. another episode), clear any internal
    // overrides so the new route params take effect.
    const lastRouteKeyRef = useRef<string>('');
    useEffect(() => {
        const key = `${type}:${id}`;
        if (!id) return;

        if (!lastRouteKeyRef.current) {
            lastRouteKeyRef.current = key;
            return;
        }

        if (lastRouteKeyRef.current !== key) {
            lastRouteKeyRef.current = key;
            setActiveStream(null);
            setResumePosition(null);
            setPendingEpisode(null);
            setActiveTab('none');

            // Reset external subtitle overlay state on content change
            setSelectedExternalSubId(null);
            setSelectedSubtitleId(-1);
            setParsedCues([]);
            setCurrentSubtitleText('');
        }
    }, [id, type]);

    // Info Tab State (Meta Aggregator)
    const baseId = useMemo(() => {
        if (!id) return '';
        const parts = String(id).split(':');
        return parts[0];
    }, [id]);

    const currentSeason = useMemo(() => {
        if (!id || type === 'movie') return 1;
        const parts = String(id).split(':');
        return parts.length > 1 ? parseInt(parts[1]) : 1;
    }, [id, type]);

    const [activeSeason, setActiveSeason] = useState(currentSeason);

    useEffect(() => {
        if (currentSeason) setActiveSeason(currentSeason);
    }, [currentSeason]);

    const { meta, enriched, seasonEpisodes, colors } = useMetaAggregator(baseId, String(type), activeSeason);

    // Fetch Intro Data
    useEffect(() => {
        const fetchIntro = async () => {
            if (type !== 'series' || !id) {
                setIntroTimestamps(null);
                return;
            }
            
            // Extract season and episode from ID (e.g. tt12345:1:2 or tmdb:12345:1:2)
            const parts = String(id).split(':');
            if (parts.length < 3) return;
            
            const season = parseInt(parts[1], 10);
            const episode = parseInt(parts[2], 10);
            
            // Prefer IMDB ID if available in enriched meta
            const imdbId = enriched.imdbId || (parts[0].startsWith('tt') ? parts[0] : null);
            
            if (imdbId && season && episode) {
                const timestamps = await IntroService.getIntroTimestamps(imdbId, season, episode);
                if (timestamps) {
                    console.log('[Player] Found intro timestamps:', timestamps);
                    setIntroTimestamps(timestamps);
                } else {
                    setIntroTimestamps(null);
                }
            }
        };
        
        fetchIntro();
    }, [id, type, enriched.imdbId]);

    // Tracks State
    const [audioTracks, setAudioTracks] = useState<any[]>([]);
    const [subtitleTracks, setSubtitleTracks] = useState<any[]>([]);
    const [externalSubtitles, setExternalSubtitles] = useState<any[]>([]);
    const [subtitleDelay, setSubtitleDelay] = useState(0);
    const [subtitleSize, setSubtitleSize] = useState(24);
    const [subtitleOffset, setSubtitleOffset] = useState(0);

    // Combine embedded and external subtitles for the UI
    const allSubtitleTracks = useMemo(() => {
        const embedded = subtitleTracks.map(t => ({
            ...t,
            isExternal: false,
            source: 'embedded'
        }));

        const external = externalSubtitles.map(s => ({
            ...s,
            isExternal: true,
            source: 'external'
        }));

        return [...embedded, ...external];
    }, [subtitleTracks, externalSubtitles]);

    // Track selection state - matching Nuvio's dual-state pattern
    const [selectedSubtitleId, setSelectedSubtitleId] = useState<number>(-1); // -1 = off, >=0 = internal index
    const [selectedExternalSubId, setSelectedExternalSubId] = useState<string | null>(null);
    const [selectedAudioId, setSelectedAudioId] = useState<number | undefined>(undefined);

    // External Subtitle Logic
    const [parsedCues, setParsedCues] = useState<any[]>([]);
    const [currentSubtitleText, setCurrentSubtitleText] = useState('');

    // Convert to react-native-video format (Nuvio pattern)
    const selectedTextTrackProp = useMemo(() => {
        // If an external sub is selected, native internal sub should be 'disabled'
        if (selectedExternalSubId !== null) return { type: 'disabled' as const };

        return selectedSubtitleId === -1
            ? { type: 'disabled' as const }
            : { type: 'index' as const, value: selectedSubtitleId };
    }, [selectedSubtitleId, selectedExternalSubId]);

    const selectedAudioTrackProp = useMemo(() => {
        return selectedAudioId !== undefined
            ? { type: 'index' as const, value: selectedAudioId }
            : undefined;
    }, [selectedAudioId]);

    // Gesture & Feedback State
    const [seekAccumulation, setSeekAccumulation] = useState<{ amount: number; direction: 'forward' | 'backward' | null }>({ amount: 0, direction: null });
    const seekAccumulationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seekBasePosition = useRef<number | null>(null);
    const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
    const { width } = useWindowDimensions();

    // Play/Pause Animation State
    const playPauseScale = useSharedValue(1);
    // (reserved) icon animation state removed; controls already animate via reanimated

    // Media Metadata for Notification
    const mediaMetadata = useMemo(() => {
        let displayTitle = (episodeTitle || title) || 'Unknown Title';
        let displaySubtitle = (type === 'movie' ? 'Movie' : title) || 'Crispy Player';
        let displayArtwork = poster || '';

        // Try to upgrade metadata from MetaAggregator
        if (type === 'series') {
            // Upgrade Show Name (Subtitle)
            if (enriched?.title) displaySubtitle = enriched.title;
            else if ((meta as any)?.name) displaySubtitle = (meta as any).name;

            // Upgrade Episode Name (Title) & Artwork
            const episodeId = String(id).split(':')[2];
            if (episodeId && seasonEpisodes?.length > 0) {
                const ep = seasonEpisodes.find((e: any) => {
                    const num = e?.episode ?? e?.number ?? e?.episodeNumber;
                    return String(num) === episodeId || String(e?.id) === episodeId;
                });
                if (ep) {
                    if (ep.name || ep.title) displayTitle = ep.name || ep.title;
                    if (ep.thumbnail || ep.image) displayArtwork = ep.thumbnail || ep.image;
                }
            }
        } else {
            // For movies, upgrade from enriched/meta
            if (enriched?.title) displayTitle = enriched.title;
            else if ((meta as any)?.name) displayTitle = (meta as any).name;

            if (enriched?.poster) displayArtwork = enriched.poster;
            else if ((meta as any)?.poster) displayArtwork = (meta as any).poster;
        }

        const metaObj = {
            title: displayTitle,
            subtitle: displaySubtitle,
            artworkUrl: displayArtwork,
        };
        console.log('[Player] Generating mediaMetadata:', metaObj);
        return metaObj;
    }, [title, episodeTitle, type, poster, enriched, meta, seasonEpisodes, id]);


    // Dual-engine state
    const [useExoPlayer, setUseExoPlayer] = useState(() => {
        if (settings.videoPlayerEngine === 'mpv') return false;
        if (settings.videoPlayerEngine === 'exoplayer') return true;
        return true; // 'auto' defaults to ExoPlayer
    });

    const videoRef = useRef<VideoSurfaceRef>(null);
    const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Parse headers/streams if present
    useEffect(() => {
        if (headersParam && typeof headersParam === 'string') {
            try {
                setHeaders(JSON.parse(headersParam));
            } catch (e) {
                console.error('Failed to parse headers', e);
            }
        }

        if (streamsParam && typeof streamsParam === 'string') {
            try {
                setAvailableStreams(JSON.parse(streamsParam));
            } catch (e) {
                console.error('Failed to parse streams', e);
            }
        }
    }, [headersParam, streamsParam]);

    const loadStreamsFor = async (contentType: ContentType, videoId: string) => {
        if (!videoId) return;
        setStreamsLoading(true);
        try {
            const streams = await getStreams(contentType, videoId);
            setAvailableStreams(streams);
        } catch (e) {
            console.error('[Player] Failed to fetch streams', e);
            setAvailableStreams([]);
        } finally {
            setStreamsLoading(false);
        }
    };

    // Always fetch streams in-player (streams param is treated as warm cache only)
    useEffect(() => {
        if (!id) return;
        if (pendingEpisode) return;

        let cancelled = false;
        setStreamsLoading(true);

        getStreams(type, id)
            .then((streams) => {
                if (!cancelled) setAvailableStreams(streams);
            })
            .catch((e) => {
                if (!cancelled) {
                    console.error('[Player] Failed to fetch streams', e);
                    setAvailableStreams([]);
                }
            })
            .finally(() => {
                if (!cancelled) setStreamsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [getStreams, id, type, pendingEpisode]);

    const { manifests } = useUserStore();

    // Session ID to prevent race conditions during fast navigation
    const sessionId = useMemo(() => Math.random().toString(36).substring(7), []);

    // Resolve stream logic
    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        // Use activeStream if set, otherwise fall back to params
        const currentUrl = activeStream?.url || url;
        const currentInfoHash = activeStream?.infoHash || infoHash;
        const currentFileIdx =
            typeof activeStream?.fileIdx === 'number'
                ? activeStream.fileIdx
                : (fileIdx ? parseInt(String(fileIdx), 10) : undefined);

        const resolve = async () => {
            setLoading(true);
            setFinalUrl(null); // Clear previous URL to ensure reload/feedback
            setStableDuration(0); // Reset duration for new stream
            setExternalSubtitles([]); // Clear previous subtitles

            // 1. Magnet link or infoHash -> Torrent
            if (currentUrl?.startsWith('magnet:') || currentInfoHash) {
                const hash = (currentInfoHash as string) || extractInfoHash(currentUrl);
                const idx = typeof currentFileIdx === 'number' ? currentFileIdx : -1;

                if (hash) {
                    console.log(`Resolving torrent module... Hash: ${hash}, Idx: ${idx}, Session: ${sessionId}`);
                    // Start stream logic is now non-blocking on native side
                    const localUrl = await CrispyNativeCore.startStream(hash, idx, sessionId);
                    const normalizedUrl = localUrl ? normalizeLocalStreamUrl(localUrl) : null;
                    if (isMounted && normalizedUrl) {
                        console.log("Resolved to local URL:", normalizedUrl);
                        try {
                            await waitForLocalStreamReady(normalizedUrl, controller.signal);
                        } catch (e) {
                            if (!controller.signal.aborted) {
                                console.warn('[Player] Local stream not ready yet:', String(e));
                            }
                        }
                        if (isMounted) setFinalUrl(normalizedUrl);
                    }
                }
            }
            // 2. HTTP/HTTPS -> Debrid or Direct
            else {
                if (isMounted) setFinalUrl(currentUrl);
            }

            // 3. Fetch External Subtitles (Addon-based)
            if (isMounted && id && type) {
                try {
                    const addonUrls = Object.keys(manifests);
                    const subs = await AddonService.fetchAllSubtitles(addonUrls, type as string, id as string);
                    if (isMounted) {
                        setExternalSubtitles(subs.map((s, i) => ({
                            id: `external-${i}`,
                            title: s.name || s.lang || 'External',
                            language: s.lang,
                            url: s.url,
                            isExternal: true,
                            addonName: s.addonName
                        })));
                    }
                } catch (e) {
                    console.error("[Player] Failed to fetch external subtitles", e);
                }
            }

            setLoading(false);
        };

        resolve();

        // CLEANUP: Only destroy the stream belonging to THIS session
        return () => {
            isMounted = false;
            controller.abort();
            console.log(`Player unmounting, destroying session: ${sessionId}`);
            // Check if destroyStream exists (it should now, but safe guard)
            if (CrispyNativeCore.destroyStream) {
                CrispyNativeCore.destroyStream(sessionId);
            }
        };
    }, [url, infoHash, fileIdx, activeStream, id, type, sessionId, manifests]);

    useEffect(() => {
        // Lock to landscape
        const lock = async () => {
            try {
                await SafeOrientation.lockAsync?.(SafeOrientation.OrientationLock.LANDSCAPE);
            } catch (e) {
                console.warn("[Player] Failed to lock orientation:", e);
            }
        };

        lock();
        StatusBar.setHidden(true);
        if (Platform.OS === 'android') {
            NavigationBar.setVisibilityAsync("hidden");
            NavigationBar.setBehaviorAsync("overlay-swipe");
        }

        // Listen for PiP mode changes (Android)
        const pipSubscription = DeviceEventEmitter.addListener('onPipModeChanged', (isPip: boolean) => {
            console.log('[Player] PiP Mode Changed:', isPip);
            setIsPipMode(isPip);
            if (isPip) {
                setShowControls(false);
                setActiveTab('none');
                if (controlsTimer.current) clearTimeout(controlsTimer.current);
            } else {
                // When leaving PiP, bring controls back briefly so the user isn't stuck.
                setShowControls(true);
                setActiveTab('none');
                if (controlsTimer.current) clearTimeout(controlsTimer.current);
                controlsTimer.current = setTimeout(() => setShowControls(false), 5000);
            }
        });

        const pipWillEnterSubscription = DeviceEventEmitter.addListener('onPipWillEnter', () => {
            console.log('[Player] PiP Will Enter');
            setIsPipMode(true);
            setShowControls(false);
            setActiveTab('none');
            if (controlsTimer.current) clearTimeout(controlsTimer.current);
        });

        const pipDismissedSubscription = DeviceEventEmitter.addListener('onPipDismissed', () => {
            console.log('[Player] PiP dismissed — pausing playback');
            setPaused(true);
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
            const unlock = async () => {
                try {
                    await SafeOrientation.lockAsync?.(SafeOrientation.OrientationLock.PORTRAIT_UP);
                } catch (e) {
                    console.warn("[Player] Failed to unlock orientation:", e);
                }
            };

            unlock();
            StatusBar.setHidden(false);
            if (Platform.OS === 'android') {
                NavigationBar.setVisibilityAsync("visible");
            }
        };
    }, []);

    // Enable PiP only while the player screen is mounted.
    useEffect(() => {
        if (Platform.OS !== 'android') return;

        void CrispyNativeCore.setPiPConfig({
            enabled: true,
            isPlaying: !paused,
            width: videoNaturalSize?.width,
            height: videoNaturalSize?.height,
        });

        return () => {
            void CrispyNativeCore.setPiPConfig({ enabled: false, isPlaying: false });
        };
        // Intentionally mount/unmount only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep native PiP params up to date (aspect ratio + playback state).
    useEffect(() => {
        if (Platform.OS !== 'android') return;
        void CrispyNativeCore.setPiPConfig({
            enabled: true,
            isPlaying: !paused,
            width: videoNaturalSize?.width,
            height: videoNaturalSize?.height,
        });
    }, [paused, videoNaturalSize?.width, videoNaturalSize?.height]);

    // Reliability: poll PiP state. Some devices/RN states can drop the activity event.
    useEffect(() => {
        if (Platform.OS !== 'android') return;
        let cancelled = false;

        const id = setInterval(() => {
            void CrispyNativeCore.isInPiPMode().then((v: boolean) => {
                if (cancelled) return;
                if (v === isPipMode) return;

                setIsPipMode(v);
                if (v) {
                    setShowControls(false);
                    setActiveTab('none');
                    if (controlsTimer.current) clearTimeout(controlsTimer.current);
                } else {
                    // Match the native event behavior in case the activity callback is missed.
                    setShowControls(true);
                    setActiveTab('none');
                    if (controlsTimer.current) clearTimeout(controlsTimer.current);
                    controlsTimer.current = setTimeout(() => setShowControls(false), 5000);
                }
            });
        }, 800);

        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [isPipMode]);

    const resetControlsTimer = useCallback(() => {
        if (isPipMode) return;
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        setShowControls(true);
        // Only auto-hide if no tab is active
        if (activeTab === 'none') {
            controlsTimer.current = setTimeout(() => setShowControls(false), 5000);
        }
    }, [activeTab, isPipMode]);

    // Fallback: when app backgrounds (incl. PiP), immediately hide overlays.
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

    // Keep controls visible when tab is active
    useEffect(() => {
        if (isPipMode) return;
        if (activeTab !== 'none') {
            if (controlsTimer.current) clearTimeout(controlsTimer.current);
            setShowControls(true);
        } else {
            resetControlsTimer();
        }
    }, [activeTab, isPipMode, resetControlsTimer]);

    const togglePlay = () => {
        const nextPaused = !paused;
        setPaused(nextPaused);

        // Simple single bounce animation (no oscillation)
        playPauseScale.value = withSequence(
            withTiming(0.85, { duration: 100 }),
            withTiming(1, { duration: 150 })
        );

        resetControlsTimer();
    };

    const handleSeek = (direction: 'forward' | 'backward') => {
        if (seekAccumulationTimer.current) clearTimeout(seekAccumulationTimer.current);

        setSeekAccumulation(prev => {
            const isSameDirection = prev.direction === direction;
            const newAmount = isSameDirection ? prev.amount + 10 : 10;

            if (seekBasePosition.current === null || !isSameDirection) {
                seekBasePosition.current = progress.position;
            }

            const totalDelta = direction === 'forward' ? newAmount : -newAmount;
            const targetPos = Math.max(0, Math.min(stableDuration || progress.duration, seekBasePosition.current + totalDelta));

            // Seek expects seconds
            videoRef.current?.seek(targetPos);
            setProgress(p => ({ ...p, position: targetPos }));

            return { amount: newAmount, direction };
        });

        seekAccumulationTimer.current = setTimeout(() => {
            setSeekAccumulation({ amount: 0, direction: null });
            seekBasePosition.current = null;
        }, 800);

        resetControlsTimer();
    };

    const handleTouchEnd = (e: any) => {
        const now = Date.now();
        const { locationX: x } = e.nativeEvent;

        if (now - lastTapRef.current.time < 300) {
            // Double Tap Detected
            if (x < width * 0.3) {
                handleSeek('backward');
            } else if (x > width * 0.7) {
                handleSeek('forward');
            }
        } else {
            // Single Tap - Toggle Controls
            if (showControls) {
                setShowControls(false);
                if (controlsTimer.current) clearTimeout(controlsTimer.current);
            } else {
                resetControlsTimer();
            }
        }

        lastTapRef.current = { time: now, x };
    };

    const playPauseAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: playPauseScale.value }],
    }));

    const feedbackAnimatedStyle = useAnimatedStyle(() => ({
        opacity: withTiming(seekAccumulation.direction ? 1 : 0, { duration: 150 }),
    }));

    // Handle codec errors - switch to MPV
    const handleCodecError = () => {
        if (useExoPlayer && settings.videoPlayerEngine === 'auto') {
            console.warn('[PlayerScreen] Codec error detected, switching to MPV');
            setUseExoPlayer(false);
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds || !isFinite(seconds) || isNaN(seconds)) return '0:00';
        const totalSecs = Math.floor(seconds);
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;

        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const extractInfoHash = (magnet: string): string | null => {
        const match = magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    };

    return (
        <View style={[styles.container, { backgroundColor: '#000' }]}>
            {/* VIDEO LAYER - ALWAYS MOUNTED (zIndex: 0) */}
            <VideoSurface
                ref={videoRef}
                source={finalUrl || ''}
                headers={headers}
                paused={paused}
                rate={playbackRate}
                resizeMode={resizeMode}
                useExoPlayer={useExoPlayer}
                decoderMode={settings.decoderMode}
                gpuMode={settings.gpuMode}
                metadata={mediaMetadata}
                selectedAudioTrack={selectedAudioTrackProp}
                selectedTextTrack={selectedTextTrackProp}
                subtitleDelay={subtitleDelay}
                onCodecError={handleCodecError}
                onTracksChanged={(data) => {
                    console.log("Tracks changed", data);
                    setAudioTracks(data.audioTracks?.map((t: any) => ({ ...t, title: t.name || t.title || t.language || `Track ${t.id}` })) || []);
                    setSubtitleTracks(data.subtitleTracks?.map((t: any) => ({ ...t, title: t.name || t.title || t.language || 'Unknown' })) || []);
                }}
                onProgress={(data) => {
                    // Values are in SECONDS from react-native-video / MPV
                    const positionSec = data.currentTime ?? 0;
                    const durationSec = data.duration ?? 0;

                    // Don't overwrite progress while user is seeking
                    if (!isSeeking) {
                        setProgress({ position: positionSec, duration: durationSec });
                    }

                    // JS Overlay Sync Logic
                    if (selectedExternalSubId !== null && parsedCues.length > 0) {
                        const adjustedTime = positionSec + (subtitleDelay / 1000); // delay is usually in ms
                        const cue = parsedCues.find(c => adjustedTime >= c.start && adjustedTime <= c.end);
                        setCurrentSubtitleText(cue?.text || '');
                    }

                    // Up Next Logic
                    if (type === 'series' && durationSec > 0) {
                        const timeLeft = durationSec - positionSec;
                        if (timeLeft <= UP_NEXT_TRIGGER_SECONDS && timeLeft > 0 && !showUpNext) {
                            setShowUpNext(true);
                        } else if ((timeLeft > UP_NEXT_TRIGGER_SECONDS || timeLeft <= 0) && showUpNext) {
                            setShowUpNext(false);
                        }
                    }
                }}
                onLoad={(data) => {
                    setLoading(false);
                    // Duration is in SECONDS from react-native-video / MPV
                    const durationSec = data.duration ?? 0;
                    if (durationSec > 0) {
                        setStableDuration(durationSec);
                    }

                    if ((data.width ?? 0) > 0 && (data.height ?? 0) > 0) {
                        setVideoNaturalSize({ width: data.width, height: data.height });
                    }

                    // Handle Resume - seek expects seconds
                    if (resumePosition !== null && resumePosition > 0) {
                        console.log("Resuming at:", resumePosition);
                        videoRef.current?.seek(resumePosition);
                        setResumePosition(null); // Consumed
                    }
                }}
                onEnd={() => {
                    // Only exit if we are not loading a new stream
                    if (!loading) {
                        router.back();
                    }
                }}
                onError={(e) => console.error("Playback error", e.message)}
            />

            {/* LOADING CURTAIN OVERLAY (zIndex: 10) */}
            {!isPipMode && (!finalUrl || loading) && (
                <View style={styles.centerLoading} pointerEvents="none">
                    <LoadingIndicator size="large" color={theme.colors.primary} />
                    <Typography variant="body" className="text-white mt-4">Resolving Stream...</Typography>
                </View>
            )}

            {/* Subtitle Overlay (Nuvio Way) */}
            {!isPipMode && (
                <CustomSubtitles
                    visible={selectedExternalSubId !== null}
                    text={currentSubtitleText}
                    fontSize={subtitleSize}
                    bottomOffset={(showControls ? 110 : 40) + subtitleOffset} // Push up needed + user offset
                />
            )}

            {/* Skip Intro Button Overlay */}
            {settings.introSkipMode !== 'off' && introTimestamps && progress.position >= introTimestamps.start && progress.position <= introTimestamps.end && !isPipMode && (
                <Animated.View
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(300)}
                    style={styles.skipIntroContainer}
                >
                    <Pressable
                        style={[styles.skipIntroBtn, { backgroundColor: theme.colors.primary, borderColor: theme.colors.outline }]}
                        onPress={() => {
                            console.log('Skip Intro pressed');
                            videoRef.current?.seek(introTimestamps.end);
                            setProgress(p => ({ ...p, position: introTimestamps.end }));
                        }}
                    >
                        <StepForward size={20} color={theme.colors.onPrimary} style={{ marginRight: 8 }} />
                        <Typography variant="label" style={{ color: theme.colors.onPrimary }}>SKIP INTRO</Typography>
                    </Pressable>
                </Animated.View>
            )}

            {/* Up Next Overlay */}
            {showUpNext && !isPipMode && (
                <Animated.View
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(300)}
                    style={styles.upNextContainer}
                >
                    <View style={[styles.upNextCard, { backgroundColor: 'rgba(30,30,30,0.95)' }]}>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Image
                                source={{ uri: poster as string }}
                                style={styles.upNextPoster}
                            />
                            <View style={{ flex: 1, justifyContent: 'center' }}>
                                <Typography variant="label-small" style={{ color: theme.colors.primary }}>UP NEXT</Typography>
                                <Typography variant="title-medium" style={{ color: 'white' }} numberOfLines={1}>
                                    {title}
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
                                    // Trigger next episode flow via Info tab's selection logic
                                    const nextEpNum = Number(id.toString().split(':')[2]) + 1;
                                    const nextEp = seasonEpisodes.find(e => Number(e.episode) === nextEpNum);
                                    if (nextEp) {
                                        // Use existing onSelectEpisode-like logic
                                        const videoId = `${baseId}:${activeSeason}:${nextEpNum}`;
                                        setPendingEpisode({
                                            videoId,
                                            season: activeSeason,
                                            episode: nextEpNum,
                                            episodeTitle: nextEp.name || nextEp.title,
                                        });
                                        setActiveTab('streams');
                                        loadStreamsFor('series', videoId);
                                    } else {
                                        setShowUpNext(false);
                                    }
                                }}
                            >
                                <Typography variant="label" style={{ color: theme.colors.onPrimary }}>PLAY NEXT</Typography>
                            </Pressable>
                            <Pressable
                                style={[styles.upNextActionBtn, { backgroundColor: 'rgba(255,255,255,0.1)', flex: 1 }]}
                                onPress={() => setShowUpNext(false)}
                            >
                                <Typography variant="label" style={{ color: 'white' }}>CANCEL</Typography>
                            </Pressable>
                        </View>
                    </View>
                </Animated.View>
            )}

            {/* Gesture Layer & Main UI Wrapper */}
            <Pressable
                style={StyleSheet.absoluteFill}
                pointerEvents={isPipMode ? 'none' : 'auto'}
                onPress={isPipMode ? undefined : handleTouchEnd}
            >
                {showControls && !isPipMode && (
                    <Animated.View
                        entering={FadeIn.duration(300)}
                        exiting={FadeOut.duration(300)}
                        style={styles.overlay}
                    >
                        {/* 1. Top Bar - Simple Row (No Pill) */}
                        <View style={styles.topBar}>
                            <Pressable onPress={() => router.back()} style={styles.backBtn}>
                                <ArrowLeft color="#fff" size={24} />
                            </Pressable>
                            <View style={styles.titlesContainer}>
                                <Text style={styles.mainTitle} numberOfLines={1}>
                                    {title}
                                </Text>
                                {!!episodeTitle && (
                                    <Text style={styles.subTitle} numberOfLines={1}>
                                        {episodeTitle}
                                    </Text>
                                )}
                            </View>
                            {/* PiP Button removed per user request - handled via Home swipe */}
                        </View>

                        {/* 2. Center Area: Feedback & Play/Pause */}
                        <View style={styles.centerArea} pointerEvents="box-none">
                            {/* YouTube-style Seek Feedback - Left */}
                            {seekAccumulation.direction === 'backward' && (
                                <Animated.View style={[styles.seekFeedbackLeft, feedbackAnimatedStyle]}>
                                    <StepBack color="#fff" size={24} />
                                    <Text style={styles.seekFeedbackText}>{seekAccumulation.amount}s</Text>
                                </Animated.View>
                            )}

                            {/* YouTube-style Seek Feedback - Right */}
                            {seekAccumulation.direction === 'forward' && (
                                <Animated.View style={[styles.seekFeedbackRight, feedbackAnimatedStyle]}>
                                    <StepForward color="#fff" size={24} />
                                    <Text style={styles.seekFeedbackText}>{seekAccumulation.amount}s</Text>
                                </Animated.View>
                            )}

                            {/* Play/Pause Pop */}
                            {!loading && (
                                <Animated.View style={[styles.centerPlayBtn, playPauseAnimatedStyle]}>
                                    <Pressable onPress={togglePlay} style={styles.centerPlayPressable}>
                                        {paused ? (
                                            <Play color="#fff" size={32} fill="#fff" style={{ marginLeft: 3 }} />
                                        ) : (
                                            <Pause color="#fff" size={32} fill="#fff" />
                                        )}
                                    </Pressable>
                                </Animated.View>
                            )}
                        </View>

                        {/* 3. Bottom Controls */}
                        <View style={styles.bottomArea}>
                            {/* Material 3 Expressive Slider */}
                            <View
                                style={styles.progressContainer}
                                onStartShouldSetResponder={() => true}
                                onMoveShouldSetResponder={() => true}
                                onResponderGrant={(e) => {
                                    setIsSeeking(true);
                                    const { pageX } = e.nativeEvent;
                                    const percentage = Math.max(0, Math.min(1, pageX / width));
                                    const targetPos = (stableDuration || progress.duration) * percentage;
                                    // Seek expects seconds
                                    videoRef.current?.seek(targetPos);
                                    resetControlsTimer();
                                    setProgress(p => ({ ...p, position: targetPos }));
                                }}
                                onResponderMove={(e) => {
                                    const { pageX } = e.nativeEvent;
                                    const percentage = Math.max(0, Math.min(1, pageX / width));
                                    const targetPos = (stableDuration || progress.duration) * percentage;
                                    // Seek expects seconds
                                    videoRef.current?.seek(targetPos);
                                    resetControlsTimer();
                                    setProgress(p => ({ ...p, position: targetPos }));
                                }}
                                onResponderRelease={() => {
                                    // Allow a small delay for the video to catch up before re-enabling progress updates
                                    setTimeout(() => setIsSeeking(false), 500);
                                }}
                            >
                                {(() => {
                                    // Pre-compute safe percentage values
                                    const duration = stableDuration || progress.duration || 1;
                                    const rawPercent = (progress.position / duration) * 100;
                                    const percent = Math.max(0, Math.min(100, rawPercent));
                                    const fillWidth = Math.max(0, percent - 0.8);
                                    const inactiveLeft = Math.min(100, percent + 0.8);

                                    return (
                                        <View style={styles.progressBackground}>
                                            {/* Active Track with Gap */}
                                            <View
                                                style={[
                                                    styles.progressFill,
                                                    {
                                                        backgroundColor: theme.colors.primary,
                                                        width: `${fillWidth}%`
                                                    }
                                                ]}
                                            />
                                            {/* Inactive Track with Gap */}
                                            <View
                                                style={[
                                                    styles.progressInactive,
                                                    {
                                                        left: `${inactiveLeft}%`,
                                                        right: 0
                                                    }
                                                ]}
                                            />
                                            {/* Expressive Thumb (Vertical Handle) */}
                                            <View
                                                style={[
                                                    styles.progressThumb,
                                                    {
                                                        left: `${percent}%`,
                                                        backgroundColor: '#fff'
                                                    }
                                                ]}
                                            />
                                        </View>
                                    );
                                })()}
                            </View>

                            {/* Control Pills Row */}
                            <View style={styles.controlsRow}>
                                {/* Time Pill - Simple View */}
                                <View style={styles.timePill}>
                                    <Text style={styles.timeText}>
                                        {formatTime(progress.position)}
                                    </Text>
                                    <Text style={[styles.timeText, { opacity: 0.5, marginHorizontal: 4 }]}>
                                        /
                                    </Text>
                                    <Text style={styles.timeText}>
                                        {formatTime(stableDuration || progress.duration)}
                                    </Text>
                                </View>

                                {/* Actions Pill - Simple View */}
                                <View style={styles.actionsPill}>
                                    {[
                                        { icon: Headphones, key: 'audio' },
                                        { icon: Languages, key: 'subtitles' },
                                        { icon: Layers, key: 'streams' },
                                        { icon: Settings, key: 'settings' },
                                        { icon: Info, key: 'info' }
                                    ].map((item, i) => (
                                        <Pressable
                                            key={i}
                                            style={styles.actionIconBtn}
                                            onPress={() => {
                                                setActiveTab(item.key as ActiveTab);
                                                // resetControlsTimer handled by effect
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
            {!isPipMode && (
                <SideSheet
                    isVisible={activeTab !== 'none'}
                    onClose={() => {
                        setActiveTab('none');
                        if (pendingEpisode) {
                            setPendingEpisode(null);
                        }
                    }}
                    title={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                >
                    <View style={{ flex: 1 }}>
                        {activeTab === 'audio' && (
                            <AudioTab
                                tracks={audioTracks}
                                selectedTrackId={selectedAudioId}
                                onSelectTrack={(track) => {
                                    setSelectedAudioId(Number(track.id));
                                    if (!useExoPlayer) videoRef.current?.setAudioTrack?.(Number(track.id));
                                    setActiveTab('none');
                                }}
                            />
                        )}
                        {activeTab === 'subtitles' && (
                            <SubtitlesTab
                                delay={subtitleDelay}
                                onUpdateDelay={setSubtitleDelay}
                            />
                        )}
                        {activeTab === 'settings' && (
                            <SettingsTab
                                playbackSpeed={playbackRate}
                                onSelectSpeed={setPlaybackRate}
                                resizeMode={resizeMode}
                                onSelectResizeMode={setResizeMode}
                            />
                        )}
                        {activeTab === 'streams' && (
                            <StreamsTab
                                streams={availableStreams}
                                currentStreamUrl={activeStream?.url || url}
                                isLoading={streamsLoading}
                                onSelectStream={(stream) => {
                                    console.log('Switching to stream:', stream);

                                    // Episode selection flow: selecting an episode opens streams; picking a stream navigates.
                                    if (pendingEpisode) {
                                        const nextTitle = enriched?.title || (meta as any)?.name || title || 'Video';
                                        const epName = pendingEpisode.episodeTitle || '';
                                        const nextEpisodeTitle = `S${pendingEpisode.season}:E${pendingEpisode.episode}${epName ? ` - ${epName}` : ''}`;

                                        const params: any = {
                                            id: pendingEpisode.videoId,
                                            type: 'series',
                                            url: (stream as any).url || '',
                                            title: nextTitle,
                                            episodeTitle: nextEpisodeTitle,
                                        };

                                        const artwork = enriched?.poster || (meta as any)?.poster || poster;
                                        if (artwork) params.poster = artwork;

                                        if ((stream as any).infoHash) {
                                            params.infoHash = (stream as any).infoHash;
                                            if ((stream as any).fileIdx !== undefined) params.fileIdx = String((stream as any).fileIdx);
                                        }

                                        if ((stream as any).behaviorHints?.headers) {
                                            params.headers = JSON.stringify((stream as any).behaviorHints.headers);
                                        }

                                        if (availableStreams?.length > 0) {
                                            params.streams = JSON.stringify(availableStreams);
                                        }

                                        setActiveTab('none');
                                        setPendingEpisode(null);
                                        router.replace({ pathname: '/player', params });
                                        return;
                                    }

                                    // Quality switching flow: in-place switch, keep playback position.
                                    setResumePosition(progress.position);

                                    if ((stream as any).behaviorHints?.headers) {
                                        setHeaders((stream as any).behaviorHints.headers);
                                    } else {
                                        setHeaders(undefined);
                                    }

                                    setActiveStream(stream);
                                    setActiveTab('none');
                                }}
                            />
                        )}
                        {activeTab === 'info' && (
                            <InfoTab
                                meta={Object.keys(enriched).length > 0 ? enriched : (meta || {})}
                                seasonEpisodes={seasonEpisodes}
                                activeSeason={activeSeason}
                                onSeasonChange={setActiveSeason}
                                currentEpisodeId={String(id).split(':')[2]}
                                onSelectEpisode={(ep) => {
                                    console.log('[Player] Selected episode:', ep);

                                    const seasonNum = activeSeason;
                                    const episodeNum = Number(ep?.episode ?? ep?.number ?? ep?.episodeNumber);
                                    if (!baseId || !seasonNum || !episodeNum) return;

                                    const videoId = `${baseId}:${seasonNum}:${episodeNum}`;

                                    // If user taps the currently-playing episode, treat it as a stream switch (no navigation).
                                    if (videoId === id) {
                                        setPendingEpisode(null);
                                        setActiveTab('streams');
                                        loadStreamsFor(type, id);
                                        return;
                                    }

                                    setPendingEpisode({
                                        videoId,
                                        season: seasonNum,
                                        episode: episodeNum,
                                        episodeTitle: ep?.name || ep?.title,
                                    });

                                    setActiveTab('streams');
                                    loadStreamsFor('series', videoId);
                                }}
                                colors={colors}
                            />
                        )}
                    </View>
                </SideSheet>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerLoading: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
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
        paddingHorizontal: Platform.OS === 'ios' ? 48 : 32, // Accommodate safe area/notches
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
        gap: 8, // Reduced gap as requested
    },
    progressContainer: {
        height: 44,
        justifyContent: 'center',
        // No negative margins - keep within the overlay padding
    },
    progressBackground: {
        height: 10, // Thicker expressive track
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
        borderTopRightRadius: 2, // Less rounded next to handle
        borderBottomRightRadius: 2, // Less rounded next to handle
    },
    progressInactive: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderTopLeftRadius: 2, // Less rounded next to handle
        borderBottomLeftRadius: 2, // Less rounded next to handle
        borderTopRightRadius: 5,
        borderBottomRightRadius: 5,
    },
    progressThumb: {
        position: 'absolute',
        top: -8, // Center 26px handle on 10px track
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
});
