import { useEffect, useReducer, useRef } from 'react';
import ImageColors from 'react-native-image-colors';
import { TMDBMeta, TMDBService } from '../../../core/services/TMDBService';
import { StorageService } from '../../../core/storage';
import { getLuminance } from '../../../core/utils/colors';

export interface MetaPalette {
    primary: string;
    secondary: string;
    vibrant: string;
    dominant: string;
    lightVibrant: string;
    darkMuted: string;
    lightMuted: string;
}

const defaultPalette: MetaPalette = {
    primary: '#121212',
    secondary: '#1e1e1e',
    vibrant: '#90CAF9',
    dominant: '#121212',
    lightVibrant: '#90CAF9',
    darkMuted: '#1E1E1E',
    lightMuted: '#90CAF9'
};

interface MetaAggregatorState {
    meta: any | null;
    enriched: Partial<TMDBMeta>;
    seasonEpisodes: any[];
    colors: MetaPalette;
    isLoading: boolean;
    error: any | null;
}

type MetaAggregatorAction =
    | { type: 'FETCH_START' }
    | { type: 'FETCH_SUCCESS'; payload: { meta: any; enriched: Partial<TMDBMeta>; seasonEpisodes: any[]; colors: MetaPalette } }
    | { type: 'FETCH_ERROR'; payload: any }
    | { type: 'UPDATE_SEASON'; payload: any[] };

const initialState: MetaAggregatorState = {
    meta: null,
    enriched: {},
    seasonEpisodes: [],
    colors: defaultPalette,
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
                colors: action.payload.colors,
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

                // 4. Extract Colors (Smart Logo-First with Backdrop Fallback)
                const getLogoSource = () => {
                    const { logo } = enrichedData;
                    if (logo && !logo.toLowerCase().endsWith('.svg')) return logo;
                    return null;
                };

                const logoUrl = getLogoSource();
                const backdropUrl = enrichedData.backdrop;
                let palette = defaultPalette;

                const extractFromUrl = async (url: string) => {
                    try {
                        const result = await ImageColors.getColors(url, {
                            fallback: '#121212',
                            cache: true,
                            key: url,
                        });

                        if (result.platform === 'android') {
                            return {
                                primary: result.darkMuted || result.darkVibrant || '#121212',
                                secondary: result.average || '#1E1E1E',
                                vibrant: result.vibrant || result.dominant || '#90CAF9',
                                dominant: result.dominant || '#121212',
                                lightVibrant: result.lightVibrant || result.vibrant || '#90CAF9',
                                darkMuted: result.darkMuted || result.darkVibrant || '#1E1E1E',
                                lightMuted: result.lightMuted || result.lightVibrant || '#90CAF9',
                            };
                        }
                    } catch (e) {
                        console.warn('[useMetaAggregator] Extraction logic crash for:', url, e);
                    }
                    return null;
                };

                let bestPalette: MetaPalette | null = null;

                // Priority 1: Logo
                if (logoUrl) {
                    const logoPalette = await extractFromUrl(logoUrl);
                    if (logoPalette) {
                        const luma = getLuminance(logoPalette.vibrant);
                        const isNeutral = luma < 25 || luma > 230;

                        if (!isNeutral) {
                            bestPalette = logoPalette;
                        }
                    }
                }

                // Priority 2: Backdrop (Fallback if logo is missing or too neutral)
                if (!bestPalette && backdropUrl) {
                    bestPalette = await extractFromUrl(backdropUrl);
                }

                if (bestPalette) {
                    palette = bestPalette;
                    // Cache the final picked palette for this specific content
                    const colorCacheKey = `palette_${id}_${type}`;
                    StorageService.setGlobal(colorCacheKey as any, palette);
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
                            colors: palette,
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
