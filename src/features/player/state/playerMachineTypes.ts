import type { Stream } from '@/src/features/player/types/streams';

export type { Stream };

export type PlayerPhase =
    | 'idle'
    | 'booting_torrent'
    | 'polling_localhost'
    | 'loading_media'
    | 'buffering'
    | 'seeking'
    | 'ready'
    | 'ended'
    | 'error'
    | 'recovering';

export type PlayerIntent = 'play' | 'pause';

export interface PlayerObservedState {
    isPlaying: boolean;
    isBuffering: boolean;
    hasLoaded: boolean;
    firstFrameRendered: boolean;
}

export interface PendingSetPausedCommand {
    value: boolean;
    version: number;
}

export interface PlayerState {
    phase: PlayerPhase;
    intent: PlayerIntent;
    engine: 'exo' | 'vlc';
    stream: Stream | null;
    resolvedUrl: string | null;
    pollingUrl: string | null;
    error: string | null;
    fatalError: boolean;
    observed: PlayerObservedState;
    pending: {
        setPaused: PendingSetPausedCommand | null;
    };
    meta: {
        title: string;
        subtitle: string;
        artworkUrl?: string;
        contentId: string;
    } | null;
}

export type PlayerAction =
    | { type: 'LOAD_STREAM'; stream: Stream; engine?: 'exo' | 'vlc'; meta?: PlayerState['meta'] }
    | { type: 'TORRENT_ENGINE_STARTED'; url: string }
    | { type: 'LOCALHOST_READY' }
    | { type: 'MEDIA_LOADING_STARTED' }
    | { type: 'USER_INTENT_PLAY' }
    | { type: 'USER_INTENT_PAUSE' }
    | { type: 'USER_SEEK' }
    | { type: 'NATIVE_LOAD' }
    | { type: 'NATIVE_FIRST_FRAME' }
    | { type: 'NATIVE_BUFFERING'; buffering: boolean }
    | { type: 'NATIVE_IS_PLAYING'; isPlaying: boolean }
    | { type: 'PLAYBACK_ENDED' }
    | { type: 'ERROR'; error: string; fatal?: boolean }
    | { type: 'RECOVER_WITH_VLC' }
    | { type: 'USER_STOP' }
    | { type: 'RESET' };

export const initialPlayerState: PlayerState = {
    phase: 'idle',
    intent: 'play',
    engine: 'exo',
    stream: null,
    resolvedUrl: null,
    pollingUrl: null,
    error: null,
    fatalError: false,
    observed: {
        isPlaying: false,
        isBuffering: false,
        hasLoaded: false,
        firstFrameRendered: false,
    },
    pending: {
        setPaused: null,
    },
    meta: null,
};
