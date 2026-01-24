import { useUserStore } from '../stores/userStore';

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
            // Strict check: OMDb only supports IMDb IDs (tt...)
            // If we get "12345" or "tmdb:12345", it's invalid for OMDb lookup
            const cleanId = imdbId.split(':')[0]; // Remove :1:1 etc
            if (!cleanId.startsWith('tt')) return null;

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
