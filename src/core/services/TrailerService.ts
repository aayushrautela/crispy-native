import axios from 'axios';

export interface TrailerData {
    url: string;
    title?: string;
    year?: string;
}

export class TrailerService {
    private static readonly BASE_URL = process.env.EXPO_PUBLIC_TRAILER_SERVICE_URL || 'http://localhost:3001';
    private static readonly TRAILER_PATH = '/trailer';
    private static readonly TIMEOUT = 15000; // 15 seconds

    /**
     * Extracts the direct streaming URL for a YouTube video key
     * @param youtubeKey - The YouTube video ID (e.g., 'O-b2VfmmbyA')
     * @param title - Optional title for logging/caching on the server
     * @param year - Optional year for logging/caching on the server
     * @returns Promise<string | null> - Direct streaming URL or null if failed
     * @deprecated Use YouTubeTrailer component with the key directly instead of extracting stream
     */
    static async getTrailerFromYouTubeKey(youtubeKey: string, title?: string, year?: string): Promise<string | null> {
        try {
            const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeKey}`;

            const params = new URLSearchParams();
            params.append('youtube_url', youtubeUrl);
            if (title) params.append('title', title);
            if (year) params.append('year', year);

            const url = `${this.BASE_URL}${this.TRAILER_PATH}?${params.toString()}`;
            console.log(`[TrailerService] Fetching direct stream from: ${url}`);

            const response = await axios.get(url, {
                timeout: this.TIMEOUT,
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (response.status !== 200 || !response.data?.url) {
                console.warn(`[TrailerService] Failed to get trailer: ${response.status}`, response.data);
                return null;
            }

            return response.data.url;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.warn(`[TrailerService] Axios error (${error.code}): ${error.message}`);
            } else {
                console.warn(`[TrailerService] Unknown error:`, error);
            }
            return null;
        }
    }

    /**
     * Helper to find the best suitable trailer from TMDB videos array
     * Prioritizes Official YouTube Trailers
     * @param videos - The results array from TMDB videos response
     * @returns string | null - The best YouTube trailer key or null
     */
    static getFirstTrailerKey(videos: any[]): string | null {
        if (!videos || !Array.isArray(videos)) return null;

        // Filter for YouTube videos
        const youtubeVideos = videos.filter(v => v.site === 'YouTube');

        if (youtubeVideos.length === 0) return null;

        // 1. Look for Trailers
        const trailers = youtubeVideos.filter(v => v.type === 'Trailer');

        if (trailers.length > 0) {
            // Sort: Official ones first
            trailers.sort((a, b) => {
                if (a.official === b.official) return 0;
                return a.official ? -1 : 1;
            });
            return trailers[0].key;
        }

        // 2. Fallback to Teasers
        const teasers = youtubeVideos.filter(v => v.type === 'Teaser');
        if (teasers.length > 0) {
            teasers.sort((a, b) => {
                if (a.official === b.official) return 0;
                return a.official ? -1 : 1;
            });
            return teasers[0].key;
        }

        // 3. Fallback to any YouTube video (Clip, Featurette, etc) if really desperate, 
        // but maybe better to show nothing than a random clip? 
        // Let's stick to Trailers/Teasers for high quality experience.
        return null;
    }
}

export default TrailerService;
