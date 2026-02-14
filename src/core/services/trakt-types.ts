import type { TraktSyncPlaybackItem } from '@crispy-streaming/media-core';

export type {
    TraktConfig,
    TraktDeviceCodeResponse,
    TraktTokenResponse,
    TraktUser,
    TraktMediaItem,
    TraktImages,
    TraktImageVariant,
    TraktWatchedMovie,
    TraktWatchedShow,
    TraktWatchlistItem,
    TraktCollectionItem,
    TraktRatingItem,
    TraktSyncPayload,
    TraktSyncResponse,
    TraktRatingPayload,
    TraktRecommendation,
    TraktContentComment,
    TraktUserStats,
} from '@crispy-streaming/media-core';

export interface TraktPlaybackItem extends TraktSyncPlaybackItem {
    // Hydrated fields (app-only)
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
