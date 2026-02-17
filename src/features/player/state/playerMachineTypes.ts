import type { Stream } from '@/src/features/player/types/streams';

export type { Stream };

export type PlayerStatus =
    | 'idle'
    | 'booting_torrent'
    | 'polling_localhost'
    | 'loading_media'
    | 'playing'
    | 'paused'
    | 'buffering'
    | 'error'
    | 'recovering';

export interface PlayerState {
    status: PlayerStatus;
    engine: 'exo' | 'vlc';
    stream: Stream | null;
    resolvedUrl: string | null;
    pollingUrl: string | null;
    error: string | null;
    fatalError: boolean;
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
    | { type: 'PLAYBACK_READY' }
    | { type: 'PLAYBACK_BUFFERING' }
    | { type: 'PLAYBACK_PAUSED' }
    | { type: 'PLAYBACK_ENDED' }
    | { type: 'ERROR'; error: string; fatal?: boolean }
    | { type: 'RECOVER_WITH_VLC' }
    | { type: 'USER_STOP' }
    | { type: 'RESET' };

export const initialPlayerState: PlayerState = {
    status: 'idle',
    engine: 'exo',
    stream: null,
    resolvedUrl: null,
    pollingUrl: null,
    error: null,
    fatalError: false,
    meta: null,
};
