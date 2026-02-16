import { PlayerState, PlayerAction, initialPlayerState } from './playerMachineTypes';
import { isMagnetUrl } from '../utils/streamUtils';

export * from './playerMachineTypes';

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
    switch (action.type) {
        case 'LOAD_STREAM': {
            const { stream, engine, meta } = action;
            const isTorrent = !!stream.infoHash || isMagnetUrl(stream.url);
            const resolvedUrl = isTorrent ? null : (stream.url || null);

            return {
                ...state,
                status: isTorrent ? 'booting_torrent' : 'loading_media',
                stream,
                engine: engine || state.engine,
                meta: meta || state.meta,
                resolvedUrl,
                pollingUrl: null,
                error: null,
                fatalError: false,
            };
        }

        case 'TORRENT_ENGINE_STARTED':
            if (state.status !== 'booting_torrent') return state;
            return {
                ...state,
                status: 'polling_localhost',
                pollingUrl: action.url,
            };

        case 'LOCALHOST_READY':
            if (state.status !== 'polling_localhost') return state;
            return {
                ...state,
                status: 'loading_media',
                resolvedUrl: state.pollingUrl, // Confirm the URL is ready
            };

        case 'MEDIA_LOADING_STARTED':
            // Optional: can be used to track specific loading sub-states
            return state;

        case 'PLAYBACK_READY':
            return {
                ...state,
                status: 'playing',
                error: null,
            };

        case 'PLAYBACK_BUFFERING':
            return {
                ...state,
                status: 'buffering',
            };

        case 'PLAYBACK_PAUSED':
            return {
                ...state,
                status: 'paused',
            };
        
        case 'PLAYBACK_ENDED':
            return {
                ...state,
                status: 'idle',
            };

        case 'ERROR': {
            const isCodecError = action.error.toLowerCase().includes('decoder') || action.error.toLowerCase().includes('codec');
            
            // Auto-recovery: If we are on ExoPlayer and get a codec error, try VLC
            if (isCodecError && state.engine === 'exo') {
                return {
                    ...state,
                    status: 'recovering', // Intermediate state
                    engine: 'vlc',
                    error: `Codec error, switching to VLC...`,
                    fatalError: false,
                };
            }

            return {
                ...state,
                status: 'error',
                error: action.error,
                fatalError: action.fatal ?? true,
            };
        }

        case 'RECOVER_WITH_VLC':
            // Logic: Switch engine and re-attempt loading the SAME stream
            return {
                ...state,
                status: 'loading_media', // Go back to loading
                engine: 'vlc',
                error: null,
            };

        case 'USER_STOP':
        case 'RESET':
            return initialPlayerState;

        default:
            return state;
    }
}
