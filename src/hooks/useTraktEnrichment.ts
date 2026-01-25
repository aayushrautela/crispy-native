import { useEffect, useState } from 'react';
import { TMDBService } from '../core/services/TMDBService';

export function useTraktEnrichment(item: any) {
    const [enriched, setEnriched] = useState(item);

    // Helper to extract ID
    const getStableId = (obj: any) => obj?.id || (obj?.movie?.ids?.trakt || obj?.show?.ids?.trakt || obj?.ids?.trakt);

    const stableId = getStableId(item);
    const internalId = getStableId(enriched);

    // PRODUCTION-GRADE RECYCLING FIX:
    // If the prop item differs from our internal state, use the prop item immediately.
    // This prevents the "flash of old content" while the effect is pending.
    const displayItem = (stableId !== internalId) ? item : enriched;

    useEffect(() => {
        let mounted = true;

        // Sync state if mismatched (Recycling happened)
        if (stableId !== internalId) {
            setEnriched(item);
        }

        const enrich = async () => {
            if (!item) return;

            // PRODUCTION-GRADE GUARD: Skip enrichment if we already have the essentials.
            // This prevents N+1 calls for Hydrated Trakt items or Stremio Addon items.
            // We only proceed if we are missing basic info OR if we need episode-level enrichment.
            const hasBasicMeta = !!(item.poster && item.name);
            const needsEpisodeMeta = item.type === 'series' && item.season !== undefined && item.episodeNumber !== undefined;

            if (hasBasicMeta && !needsEpisodeMeta) {
                return;
            }

            // Extract ID from augmented IDs object primarily
            const ids = item.ids || {};
            const idToUse = ids.tmdb ? `tmdb:${ids.tmdb}` : ids.imdb;

            if (!idToUse) {
                // FALLBACK: If we don't have IMDB/TMDB IDs, check if it's already a tmdb: or tt... id
                const fallbackId = (typeof item.id === 'string' && (item.id.startsWith('tmdb:') || item.id.startsWith('tt')))
                    ? item.id
                    : null;

                if (!fallbackId) return;
            }

            const type = item.type === 'movie' ? 'movie' : 'series';

            try {
                const enrichedMeta = await TMDBService.getEnrichedMeta(idToUse || '', type);

                let episodeEnrichment = {};
                if (type === 'series' && item.season !== undefined && item.episodeNumber !== undefined && enrichedMeta.tmdbId) {
                    try {
                        const epDetails = await TMDBService.getEpisodeDetails(enrichedMeta.tmdbId, item.season, item.episodeNumber);
                        if (epDetails) {
                            episodeEnrichment = {
                                airDate: epDetails.released,
                                episodeTitle: epDetails.name || item.episodeTitle
                            };
                        }
                    } catch (e) {
                        console.warn('[useTraktEnrichment] Episode enrichment failed', e);
                    }
                }

                if (mounted && enrichedMeta && Object.keys(enrichedMeta).length > 0) {
                    setEnriched({
                        ...item,
                        ...episodeEnrichment,
                        name: enrichedMeta.title || item.name,
                        poster: enrichedMeta.poster || item.poster,
                        backdrop: enrichedMeta.backdrop || item.backdrop,
                        logo: enrichedMeta.logo || item.logo,
                        year: enrichedMeta.year || item.year,
                        description: enrichedMeta.description || item.description,
                        rating: enrichedMeta.rating || item.rating,
                    });
                }
            } catch (e) {
                // Fail silently
            }
        };

        enrich();

        return () => {
            mounted = false;
        };
    }, [stableId]);

    return displayItem;
}
