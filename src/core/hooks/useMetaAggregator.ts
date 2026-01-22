import { useEffect, useReducer, useRef } from 'react';
import { TMDBMeta, TMDBService } from '../api/TMDBService';

interface MetaAggregatorState {
    meta: any | null;
    enriched: Partial<TMDBMeta>;
    seasonEpisodes: any[];
    isLoading: boolean;
    error: any | null;
}

type MetaAggregatorAction =
    | { type: 'FETCH_START' }
    | { type: 'FETCH_SUCCESS'; payload: { meta: any; enriched: Partial<TMDBMeta>; seasonEpisodes: any[] } }
    | { type: 'FETCH_ERROR'; payload: any }
    | { type: 'UPDATE_SEASON'; payload: any[] };

const initialState: MetaAggregatorState = {
    meta: null,
    enriched: {},
    seasonEpisodes: [],
    isLoading: true,
    error: null,
};

function reducer(state: MetaAggregatorState, action: MetaAggregatorAction): MetaAggregatorState {
    switch (action.type) {
        case 'FETCH_START':
            return { ...initialState, isLoading: true };
        case 'FETCH_SUCCESS':
            return {
                ...state,
                meta: action.payload.meta,
                enriched: action.payload.enriched,
                seasonEpisodes: action.payload.seasonEpisodes,
                isLoading: false,
            };
        case 'FETCH_ERROR':
            return { ...state, isLoading: false, error: action.payload };
        case 'UPDATE_SEASON':
            return { ...state, seasonEpisodes: action.payload };
        default:
            return state;
    }
}

export function useMetaAggregator(id: string, type: string, activeSeason: number = 1) {
    const [state, dispatch] = useReducer(reducer, initialState);
    const prevActiveSeason = useRef(activeSeason);
    const isMounted = useRef(true);
    const hasFetched = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Main data fetch: TMDB only
    useEffect(() => {
        if (!id || !type || hasFetched.current) return;
        hasFetched.current = true;

        async function aggregate() {
            dispatch({ type: 'FETCH_START' });
            try {
                // Fetch enriched data from TMDB - this is the ONLY source
                const enrichedData = await TMDBService.getEnrichedMeta(id, type as any);

                let episodes: any[] = [];
                const isSeries = type === 'series' || type === 'tv' || enrichedData.type === 'series';

                if (isSeries && enrichedData.tmdbId) {
                    episodes = await TMDBService.getSeasonEpisodes(enrichedData.tmdbId, activeSeason);
                }

                if (isMounted.current) {
                    dispatch({
                        type: 'FETCH_SUCCESS',
                        payload: {
                            meta: {
                                id: id,
                                type: type,
                                name: enrichedData.title,
                                poster: enrichedData.poster,
                                background: enrichedData.backdrop,
                                description: enrichedData.description,
                            },
                            enriched: enrichedData,
                            seasonEpisodes: episodes,
                        },
                    });
                }
            } catch (err) {
                console.error('[useMetaAggregator] Aggregation failed:', err);
                if (isMounted.current) {
                    dispatch({ type: 'FETCH_ERROR', payload: err });
                }
            }
        }

        aggregate();
    }, [id, type]);

    // Handle season changes separately to avoid refetching everything
    useEffect(() => {
        if (state.isLoading || activeSeason === prevActiveSeason.current) return;

        async function changeSeason() {
            if (state.enriched.tmdbId) {
                const episodes = await TMDBService.getSeasonEpisodes(state.enriched.tmdbId, activeSeason);
                if (isMounted.current) {
                    dispatch({ type: 'UPDATE_SEASON', payload: episodes });
                }
            }
            prevActiveSeason.current = activeSeason;
        }

        changeSeason();
    }, [activeSeason, state.enriched.tmdbId, state.isLoading]);

    return state;
}
