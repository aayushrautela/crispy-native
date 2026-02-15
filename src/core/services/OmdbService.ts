import { useUserStore } from '@/src/core/stores/userStore';
import { toImdbIdForExternalLookup } from '../ids/mediaIds';

export interface OmdbRating {
    Source: string;
    Value: string;
}

export interface OmdbData {
    Ratings?: OmdbRating[];
    Metascore?: string;
    imdbRating?: string;
    imdbVotes?: string;
    Type?: string;
    Response: string;
    Error?: string;
}

export class OmdbService {
    static async getData(imdbId: string): Promise<OmdbData | null> {
        const key = useUserStore.getState().settings.omdbKey;
        if (!key || !imdbId) return null;

        try {
            // OMDb only supports IMDb IDs (tt...). Accept strict ids and episode-suffixed ids.
            const cleanId =
                toImdbIdForExternalLookup(imdbId, 'movie') ||
                toImdbIdForExternalLookup(imdbId, 'series') ||
                (imdbId.startsWith('tt') ? imdbId : null);
            if (!cleanId || !cleanId.startsWith('tt')) return null;

            const response = await fetch(`https://www.omdbapi.com/?i=${cleanId}&apikey=${key}`);
            if (!response.ok) return null;

            const data = await response.json();
            if (data.Response === 'False') return null;

            return data;
        } catch (e) {
            console.error('[OmdbService] Failed to fetch data', e);
            return null;
        }
    }
}
