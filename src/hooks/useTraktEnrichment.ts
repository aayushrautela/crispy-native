import { useEffect, useRef, useState } from 'react';
import { EnrichmentCache } from '../core/services/EnrichmentCache';
import { TMDBService } from '../core/services/TMDBService';

export function useTraktEnrichment(item: any, skip: boolean = false) {
    // 1. Stable Key Generation
    // We compute this ONCE per render. It MUST be fast.
    const cacheKey = skip ? null : EnrichmentCache.getKey(item);

    // 2. Synchronous Initialization (The "Magic" Fix)
    // If we have data in memory, use it IMMEDIATELY.
    // This allows React to render the final state in the very first pass.
    const [enriched, setEnriched] = useState(() => {
        if (skip) return item;
        if (cacheKey && EnrichmentCache.has(cacheKey)) {
            return EnrichmentCache.get(cacheKey);
        }
        return item;
    });

    // Keep track of what we are currently showing to avoid thrashing
    const currentIdRef = useRef(cacheKey);

    useEffect(() => {
        // If the item prop changed completely, we need to reset or re-enrich
        const newKey = EnrichmentCache.getKey(item);

        if (newKey !== currentIdRef.current) {
            currentIdRef.current = newKey;
            // Check cache immediately for the new item
            if (newKey && EnrichmentCache.has(newKey)) {
                setEnriched(EnrichmentCache.get(newKey));
                return; // Done! No async needed.
            } else {
                setEnriched(item); // Reset to base state while we fetch
            }
        }

        if (!item || !newKey) return;

        // If we already possess the cached data in state, stop here.
        if (EnrichmentCache.has(newKey)) return;

        let mounted = true;

        const enrich = async () => {
            // PRODUCTION-GRADE GUARD: 
            // Skip expensive TMDB calls if we already have a nice poster and name.
            // Exceptions: We always want to enrich generic Items to get more metadata/logos if possible,
            // OR if it's a specific episode that needs an air date.
            const hasGoodMeta = !!(item.poster && item.name && item.logo);
            const needsEpisodeMeta = item.type === 'series' && item.season !== undefined && item.episodeNumber !== undefined;

            if (hasGoodMeta && !needsEpisodeMeta) {
                // cache what we have so we don't check again
                EnrichmentCache.set(newKey, item);
                return;
            }

            // Deduplicate requests using the Cache Service's promise map
            try {
                await EnrichmentCache.getOrFetch(newKey, async () => {

                    const ids = item.ids || {};
                    const idToUse = ids.tmdb ? `tmdb:${ids.tmdb}` : ids.imdb;

                    // Fallback to item.id if it looks like a valid ID string
                    const finalId = idToUse ||
                        ((typeof item.id === 'string' && (item.id.startsWith('tmdb:') || item.id.startsWith('tt'))) ? item.id : null);

                    if (!finalId) return null;

                    const type = item.type === 'movie' ? 'movie' : 'series';
                    const enrichedMeta = await TMDBService.getEnrichedMeta(finalId, type);

                    // Episode Logic
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
                            // ignore episode failures
                        }
                    }

                    if (enrichedMeta && Object.keys(enrichedMeta).length > 0) {
                        const finalResult = {
                            ...item,
                            ...episodeEnrichment,
                            name: enrichedMeta.title || item.name,
                            poster: enrichedMeta.poster || item.poster,
                            backdrop: enrichedMeta.backdrop || item.backdrop,
                            logo: enrichedMeta.logo || item.logo,
                            year: enrichedMeta.year || item.year,
                            description: enrichedMeta.description || item.description,
                            rating: enrichedMeta.rating || item.rating,
                        };

                        // Write to Cache
                        EnrichmentCache.set(newKey, finalResult);

                        // Only update state if still mounted and looking at the same item
                        if (mounted && currentIdRef.current === newKey) {
                            setEnriched(finalResult);
                        }
                        return finalResult;
                    }
                    return null;
                });
            } catch (e) {
                // Fail silently
            }
        };

        enrich();

        return () => {
            mounted = false;
        };
    }, [item, cacheKey]); // Rely on stable serialized key or item changes

    return enriched;
}
