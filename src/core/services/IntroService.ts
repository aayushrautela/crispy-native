import axios from 'axios';

const INTRODB_ENDPOINT = 'https://api.introdb.app/intro';

export interface IntroTimestamps {
    start: number; // in seconds
    end: number;   // in seconds
}

export class IntroService {
    static async getIntroTimestamps(imdbId: string, season: number, episode: number): Promise<IntroTimestamps | null> {
        if (!imdbId || !season || !episode) return null;

        try {
            const res = await axios.get(INTRODB_ENDPOINT, {
                params: {
                    imdb_id: imdbId,
                    season,
                    episode
                }
            });

            const data = res.data;
            
            if (data && typeof data.start_ms === 'number' && typeof data.end_ms === 'number') {
                return {
                    start: data.start_ms / 1000,
                    end: data.end_ms / 1000
                };
            }
            
            return null;
        } catch (e) {
            // It's normal to not have intro data for many shows
            console.log(`[IntroService] No intro data found for ${imdbId} S${season}E${episode}`);
            return null;
        }
    }
}
