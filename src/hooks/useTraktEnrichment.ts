import { useEffect, useRef, useState } from 'react';
import { EnrichmentCache } from '../core/services/EnrichmentCache';
import { TMDBService } from '../core/services/TMDBService';
import { toStrictMediaId } from '../core/ids/mediaIds';

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
            // Skip TMDB when Continue Watching already has display-ready visuals.
            const hasDisplayImage = !!(item.thumbnail || item.backdrop || item.poster);
            const hasLogo = !!item.logo;
            const needsEpisodeMeta =
                item.type === 'series' &&
                item.season !== undefined &&
                item.episodeNumber !== undefined &&
                (!item.airDate || !item.episodeTitle);

            if (hasDisplayImage && hasLogo && !needsEpisodeMeta) {
                // cache what we have so we don't check again
                EnrichmentCache.set(newKey, item);
                return;
            }

            // Deduplicate requests using the Cache Service's promise map
            try {
                await EnrichmentCache.getOrFetch(newKey, async () => {

                    const ids = item.ids || {};
                    const candidateId =
                        ids.tmdb
                            ? `tmdb:${ids.tmdb}`
                            : ids.imdb
                                ? `imdb:${ids.imdb}`
                                : ids.trakt
                                    ? `trakt:${ids.trakt}`
                                    : item.id;

                    const type = item.type === 'movie' ? 'movie' : 'series';
                    const finalId = candidateId ? toStrictMediaId(candidateId, type) : null;

                    if (!finalId) return null;
                    const enrichedMeta = await TMDBService.getEnrichedMeta(finalId, type);

                    // Episode Logic
                    let episodeEnrichment = {};
                    if (
                        type === 'series' &&
                        item.season !== undefined &&
                        item.episodeNumber !== undefined &&
                        enrichedMeta.tmdbId &&
                        (!item.airDate || !item.episodeTitle)
                    ) {
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
                            name: item.name || enrichedMeta.title,
                            poster: item.poster,
                            thumbnail: item.thumbnail,
                            backdrop: item.backdrop || enrichedMeta.backdrop,
                            logo: item.logo || enrichedMeta.logo,
                            year: item.year || enrichedMeta.year,
                            description: item.description || enrichedMeta.description,
                            rating: item.rating || enrichedMeta.rating,
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
