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
                console.error(`[TrailerService] Axios error (${error.code}): ${error.message}`);
            } else {
                console.error(`[TrailerService] Unknown error:`, error);
            }
            return null;
        }
    }

    /**
     * Helper to find the first suitable trailer from TMDB videos array
     * @param videos - The results array from TMDB videos response
     * @returns string | null - The first YouTube trailer key or null
     */
    static getFirstTrailerKey(videos: any[]): string | null {
        if (!videos || !Array.isArray(videos)) return null;

        // Priority: Site must be YouTube, Type must be Trailer
        const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
            videos.find(v => v.site === 'YouTube' && v.type === 'Teaser');

        return trailer?.key || null;
    }
}

export default TrailerService;
