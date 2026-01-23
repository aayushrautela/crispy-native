# SPEC: Trailer Autoplay Feature

Status: FINALIZED

## Goal
Implement a YouTube trailer autoplay system on the Hero card of the movie/show details page, similar to the Nuvio app.

## Requirements
1. **Trailer Metadata**: Capture the first YouTube trailer from the TMDB API response.
2. **Direct Stream Extraction**: Use an external trailer service (configured via `EXPO_PUBLIC_TRAILER_SERVICE_URL`) to extract direct streaming links from YouTube keys.
3. **Autoplay Behavior**: 
    - Display the backdrop image initially.
    - After a short delay (e.g., 2 seconds), transition to the trailer video if available.
    - Video should be muted by default (as per user preference or common practice).
4. **Reliability**:
    - No XPrime fallback as requested.
    - If extraction fails or video errors, remain on the backdrop image.
5. **UI/UX**:
    - Smooth transitions (fade) between image and video.
    - Parallax support for the video player to match the current backdrop behavior.
6. **Platform Requirements**: `minSdkVersion` must be at least 29 to support `libmpv` and modern Android features (Android 10).

## Technical Details
- **Services**:
    - [MODIFY] `src/core/api/TMDBService.ts`: Map `videos` from TMDB response to the meta object.
    - [NEW] `src/core/api/TrailerService.ts`: Handle HTTP calls to the custom trailer extraction backend.
- **Components**:
    - [NEW] `src/components/video/TrailerPlayer.tsx`: A wrapper around `react-native-video` for hero trailers.
    - [MODIFY] `src/components/meta/HeroSection.tsx`: Orchestrate the autoplay logic and render the `TrailerPlayer`.

## Verification Criteria
- `TrailerService` returns a valid direct streaming URL for a given YouTube key.
- `HeroSection` correctly identifies a trailer from TMDB data.
- Video starts playing after the specified delay.
- Video is muted by default.
- UI transitions smoothly between backdrop and video.
