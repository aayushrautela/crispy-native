import { useEffect, useReducer, useRef } from 'react';
import ImageColors from 'react-native-image-colors';
import { TMDBMeta, TMDBService } from '../../../core/services/TMDBService';
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

export type MetaColorSource = 'backdrop' | 'poster' | 'logo' | 'default';

export interface MetaColorExtraction {
    source: MetaColorSource;
    imageUrl?: string;
    platform?: string;
    swatches: Record<string, string>;
    seedKey?: string;
    seedColor?: string;
    accepted: boolean;
    rejectionReason?: string;
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
    colorExtraction: MetaColorExtraction | null;
    isLoading: boolean;
    error: any | null;
}

type MetaAggregatorAction =
    | { type: 'FETCH_START' }
    | {
        type: 'FETCH_SUCCESS';
        payload: {
            meta: any;
            enriched: Partial<TMDBMeta>;
            seasonEpisodes: any[];
            colors: MetaPalette;
            colorExtraction: MetaColorExtraction | null;
        }
    }
    | { type: 'FETCH_ERROR'; payload: any }
    | { type: 'UPDATE_SEASON'; payload: any[] };

const initialState: MetaAggregatorState = {
    meta: null,
    enriched: {},
    seasonEpisodes: [],
    colors: defaultPalette,
    colorExtraction: null,
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
                colorExtraction: action.payload.colorExtraction,
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
    const lastFetchKey = useRef<string | null>(null);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Main data fetch: TMDB only
    useEffect(() => {
        if (!id || !type) return;

        const fetchKey = `${type}:${id}`;
        if (lastFetchKey.current === fetchKey) return;
        lastFetchKey.current = fetchKey;
        prevActiveSeason.current = activeSeason;

        const isValidHex = (value: string | undefined): value is string => {
            if (!value) return false;
            return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
        };

        const isGoodMaterialSeed = (hex: string) => {
            const luma = getLuminance(hex);
            // Prefer mid-tone source colors for Material You seeding.
            // Too-dark seeds tend to produce dull/near-neutral schemes.
            return isFinite(luma) && luma >= 60 && luma <= 220;
        };

        const pickSeed = (platform: string | undefined, swatches: Record<string, string>) => {
            const candidates = platform === 'ios'
                ? ['primary', 'detail', 'secondary', 'background']
                : ['vibrant', 'darkVibrant', 'lightVibrant', 'dominant', 'average', 'lightMuted', 'muted', 'darkMuted'];

            for (const key of candidates) {
                const color = swatches[key];
                if (isValidHex(color) && isGoodMaterialSeed(color)) {
                    return { key, color };
                }
            }

            // Return the first valid candidate (even if rejected) for debug purposes
            for (const key of candidates) {
                const color = swatches[key];
                if (isValidHex(color)) {
                    return { key, color };
                }
            }

            return null;
        };

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
                const posterUrl = enrichedData.poster;
                let palette = defaultPalette;

                let colorExtraction: MetaColorExtraction | null = null;

                const extractFromUrl = async (url: string) => {
                    try {
                        const result = await ImageColors.getColors(url, {
                            fallback: '#121212',
                            cache: true,
                            key: url,
                        });

                        const platform = result.platform;

                        if (platform === 'android') {
                            const swatches: Record<string, string> = {};
                            const keys = ['dominant', 'average', 'vibrant', 'darkVibrant', 'lightVibrant', 'muted', 'darkMuted', 'lightMuted'] as const;
                            for (const k of keys) {
                                const v = (result as any)[k];
                                if (typeof v === 'string' && isValidHex(v)) swatches[k] = v;
                            }

                            const mapped: MetaPalette = {
                                primary: (result as any).darkMuted || (result as any).darkVibrant || '#121212',
                                secondary: (result as any).average || '#1E1E1E',
                                vibrant: (result as any).vibrant || (result as any).dominant || '#90CAF9',
                                dominant: (result as any).dominant || '#121212',
                                lightVibrant: (result as any).lightVibrant || (result as any).vibrant || '#90CAF9',
                                darkMuted: (result as any).darkMuted || (result as any).darkVibrant || '#1E1E1E',
                                lightMuted: (result as any).lightMuted || (result as any).lightVibrant || '#90CAF9',
                            };

                            return { platform, swatches, palette: mapped };
                        }

                        if (platform === 'ios') {
                            const swatches: Record<string, string> = {};
                            const keys = ['background', 'primary', 'secondary', 'detail'] as const;
                            for (const k of keys) {
                                const v = (result as any)[k];
                                if (typeof v === 'string' && isValidHex(v)) swatches[k] = v;
                            }

                            const mapped: MetaPalette = {
                                primary: (result as any).background || '#121212',
                                secondary: (result as any).secondary || (result as any).background || '#1E1E1E',
                                vibrant: (result as any).primary || (result as any).detail || '#90CAF9',
                                dominant: (result as any).background || '#121212',
                                lightVibrant: (result as any).primary || (result as any).detail || '#90CAF9',
                                darkMuted: (result as any).background || '#1E1E1E',
                                lightMuted: (result as any).secondary || (result as any).detail || '#90CAF9',
                            };

                            return { platform, swatches, palette: mapped };
                        }
                    } catch (e) {
                        console.warn('[useMetaAggregator] Extraction logic crash for:', url, e);
                    }
                    return null;
                };

                // Material You: pick ONE source image and ONE seed color.
                // Priority order is artwork-first (backdrop -> poster), with logo as last resort.
                const sources: { source: MetaColorSource; url: string | null }[] = [
                    { source: 'backdrop', url: backdropUrl || null },
                    { source: 'poster', url: posterUrl || null },
                    { source: 'logo', url: logoUrl || null },
                ];

                for (const src of sources) {
                    if (!src.url) continue;

                    const extracted = await extractFromUrl(src.url);
                    if (!extracted) continue;

                    const seed = pickSeed(extracted.platform, extracted.swatches);
                    const attempt: MetaColorExtraction = {
                        source: src.source,
                        imageUrl: src.url,
                        platform: extracted.platform,
                        swatches: extracted.swatches,
                        seedKey: seed?.key,
                        seedColor: seed?.color,
                        accepted: false,
                    };

                    // Keep the first successful extraction for debug, even if we later fall back.
                    if (!colorExtraction) {
                        colorExtraction = attempt;
                    }

                    if (seed?.color && isGoodMaterialSeed(seed.color)) {
                        attempt.accepted = true;
                        colorExtraction = attempt;
                        palette = extracted.palette;
                        break;
                    }

                    attempt.rejectionReason = seed?.color
                        ? 'seed_rejected_luminance'
                        : 'no_seed_candidate';
                }

                if (!colorExtraction) {
                    colorExtraction = {
                        source: 'default',
                        swatches: {},
                        accepted: false,
                        rejectionReason: 'no_extraction',
                    };
                }

                // If we didn't accept a seed, keep the page on the default palette.
                if (!colorExtraction.accepted) {
                    palette = defaultPalette;
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
                            colorExtraction,
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
    }, [id, type, activeSeason]);

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
