
export type TraktConfig = {
    clientId: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
};

export type TraktDeviceCodeResponse = {
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
};

export type TraktTokenResponse = {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    created_at: number;
};

export interface TraktUser {
    username: string;
    name?: string;
    private: boolean;
    vip: boolean;
    joined_at: string;
    avatar?: string;
}

export type TraktMediaItem = {
    title: string;
    year?: number;
    ids: {
        trakt?: number;
        slug?: string;
        imdb?: string;
        tmdb?: number;
    };
    images?: TraktImages;
};

export interface TraktImages {
    fanart?: string[];
    poster?: string[];
    logo?: string[];
    clearart?: string[];
    banner?: string[];
    thumb?: string[];
}

export interface TraktPlaybackItem {
    progress: number;
    paused_at: string;
    id: number;
    type: 'movie' | 'episode';
    movie?: {
        title: string;
        year: number;
        ids: {
            trakt: number;
            slug: string;
            imdb: string;
            tmdb: number;
        };
        images?: TraktImages;
    };
    episode?: {
        season: number;
        number: number;
        title: string;
        ids: {
            trakt: number;
            tvdb?: number | null;
            imdb?: string | null;
            tmdb?: number | null;
        };
        images?: TraktImages;
    };
    show?: {
        title: string;
        year: number;
        ids: {
            trakt: number;
            slug: string;
            tvdb?: number | null;
            imdb: string;
            tmdb: number;
        };
        images?: TraktImages;
    };
    // Hydrated fields
    meta?: {
        name?: string;
        poster?: string;
        background?: string;
        logo?: string;
        genres?: string[];
        description?: string;
        airDate?: string;
        rating?: string;
        episodeTitle?: string;
    };
}
