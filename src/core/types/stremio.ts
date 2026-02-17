export interface MetaPreview {
    id: string;
    type: string;
    name: string;
    poster?: string;
    posterShape?: 'poster' | 'landscape' | 'square';
    description?: string;
    backdrop?: string;
    thumbnail?: string;
    releaseInfo?: string;
    progressPercent?: number;
    episodeTitle?: string;
    showTitle?: string;
    season?: number;
    episodeNumber?: number;
    airDate?: string;
    logo?: string;
    genres?: string[];
    rating?: string;
    imdbRating?: string;
    numericRating?: number;
    ids?: {
        trakt?: number;
        imdb?: string;
        tmdb?: number;
        slug?: string;
    };
}

export interface CatalogResponse {
    metas: MetaPreview[];
}

export interface ResourceResponse<T> {
    [key: string]: T;
}
