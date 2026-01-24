import { useEffect, useState } from 'react';
import { TMDBService } from '../core/services/TMDBService';

export function useTraktEnrichment(item: any) {
    const [enriched, setEnriched] = useState(item);

    // Extract a stable ID for the effect dependency
    const stableId = item?.id || (item?.movie?.ids?.trakt || item?.show?.ids?.trakt || item?.ids?.trakt);

    useEffect(() => {
        let mounted = true;

        // Reset state whenever the item changes to avoid showing old data on recycled cards
        setEnriched(item);

        const enrich = async () => {
            if (!item) return;

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

    return enriched;
}
