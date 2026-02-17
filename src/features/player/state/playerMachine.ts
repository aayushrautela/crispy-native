import { PlayerState, PlayerAction, initialPlayerState } from './playerMachineTypes';
import { isMagnetUrl } from '../utils/streamUtils';

export * from './playerMachineTypes';

function nextSetPausedVersion(state: PlayerState): number {
    return (state.pending.setPaused?.version ?? 0) + 1;
}

function queueSetPaused(state: PlayerState, value: boolean) {
    return {
        value,
        version: nextSetPausedVersion(state),
    };
}

function shouldPreserveLoadingPhase(phase: PlayerState['phase']): boolean {
    return (
        phase === 'booting_torrent'
        || phase === 'polling_localhost'
        || phase === 'loading_media'
        || phase === 'error'
        || phase === 'recovering'
        || phase === 'ended'
    );
}

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
    switch (action.type) {
        case 'LOAD_STREAM': {
            const { stream, engine, meta } = action;
            const isTorrent = !!stream.infoHash || isMagnetUrl(stream.url);
            const resolvedUrl = isTorrent ? null : (stream.url || null);

            return {
                ...state,
                phase: isTorrent ? 'booting_torrent' : 'loading_media',
                intent: 'play',
                stream,
                engine: engine || state.engine,
                meta: meta || state.meta,
                resolvedUrl,
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
            };
        }

        case 'TORRENT_ENGINE_STARTED':
            if (state.phase !== 'booting_torrent') return state;
            return {
                ...state,
                phase: 'polling_localhost',
                pollingUrl: action.url,
            };

        case 'LOCALHOST_READY':
            if (state.phase !== 'polling_localhost') return state;
            return {
                ...state,
                phase: 'loading_media',
                resolvedUrl: state.pollingUrl,
            };

        case 'MEDIA_LOADING_STARTED':
            return {
                ...state,
                phase: 'loading_media',
            };

        case 'USER_INTENT_PLAY':
            return {
                ...state,
                intent: 'play',
                pending: {
                    ...state.pending,
                    setPaused: queueSetPaused(state, false),
                },
            };

        case 'USER_INTENT_PAUSE':
            return {
                ...state,
                intent: 'pause',
                pending: {
                    ...state.pending,
                    setPaused: queueSetPaused(state, true),
                },
            };

        case 'USER_SEEK':
            if (state.phase === 'error' || state.phase === 'ended') return state;
            return {
                ...state,
                phase: 'seeking',
            };

        case 'NATIVE_LOAD': {
            const nextPhase = state.phase === 'loading_media' && !state.observed.isBuffering
                ? 'ready'
                : state.phase;
            return {
                ...state,
                phase: nextPhase,
                error: null,
                observed: {
                    ...state.observed,
                    hasLoaded: true,
                },
            };
        }

        case 'NATIVE_FIRST_FRAME':
            return {
                ...state,
                phase: state.phase === 'ended' || state.phase === 'error' ? state.phase : 'ready',
                error: null,
                observed: {
                    ...state.observed,
                    hasLoaded: true,
                    firstFrameRendered: true,
                },
            };

        case 'NATIVE_BUFFERING': {
            let phase = state.phase;
            if (action.buffering) {
                if (!shouldPreserveLoadingPhase(state.phase) && state.phase !== 'seeking') {
                    phase = state.intent === 'play' ? 'buffering' : 'ready';
                }
            } else {
                if (state.phase === 'buffering') {
                    phase = 'ready';
                }
                if (state.phase === 'seeking' && state.intent === 'pause') {
                    phase = 'ready';
                }
            }

            return {
                ...state,
                phase,
                observed: {
                    ...state.observed,
                    isBuffering: action.buffering,
                },
            };
        }

        case 'NATIVE_IS_PLAYING': {
            let phase = state.phase;
            if (action.isPlaying) {
                if (state.phase !== 'error' && state.phase !== 'ended') {
                    phase = 'ready';
                }
            } else if (!shouldPreserveLoadingPhase(state.phase)) {
                if (state.intent === 'pause') {
                    phase = 'ready';
                } else if (state.phase === 'seeking' || state.observed.isBuffering) {
                    phase = state.phase === 'seeking' ? 'seeking' : 'buffering';
                }
            }

            const shouldClearPending = !!state.pending.setPaused
                && ((state.pending.setPaused.value === false && action.isPlaying)
                    || (state.pending.setPaused.value === true && !action.isPlaying && state.intent === 'pause'));

            return {
                ...state,
                phase,
                observed: {
                    ...state.observed,
                    isPlaying: action.isPlaying,
                },
                pending: {
                    ...state.pending,
                    setPaused: shouldClearPending ? null : state.pending.setPaused,
                },
            };
        }

        case 'PLAYBACK_ENDED':
            return {
                ...state,
                phase: 'ended',
                observed: {
                    ...state.observed,
                    isPlaying: false,
                    isBuffering: false,
                },
                pending: {
                    ...state.pending,
                    setPaused: null,
                },
            };

        case 'ERROR': {
            const isCodecError = action.error.toLowerCase().includes('decoder') || action.error.toLowerCase().includes('codec');

            if (isCodecError && state.engine === 'exo') {
                return {
                    ...state,
                    phase: 'recovering',
                    intent: 'play',
                    engine: 'vlc',
                    error: `Codec error, switching to VLC...`,
                    fatalError: false,
                    pending: {
                        ...state.pending,
                        setPaused: null,
                    },
                };
            }

            return {
                ...state,
                phase: 'error',
                error: action.error,
                fatalError: action.fatal ?? true,
            };
        }

        case 'RECOVER_WITH_VLC':
            return {
                ...state,
                phase: 'loading_media',
                engine: 'vlc',
                error: null,
                intent: 'play',
                pending: {
                    ...state.pending,
                    setPaused: null,
                },
            };

        case 'USER_STOP':
        case 'RESET':
            return initialPlayerState;

        default:
            return state;
    }
}
