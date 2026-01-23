# ROADMAP: Trailer Autoplay Feature

## Phase 1: Data & Services 🏗️ [DONE]
- [x] Update `TMDBService.ts` to include `videos` in enriched metadata.
- [x] Create `TrailerService.ts` for extraction backend communication.
- [x] Verify extraction logic with a test YouTube key.

## Phase 2: Player Component 📺 [DONE]
- [x] Create `TrailerPlayer.tsx` using `react-native-video`.
- [x] Style the player to match the Hero card dimensions and overlay logic.
- [x] Implement mute/autoplay controls.

## Phase 3: UI Orchestration & Autoplay 🎬 [DONE]
- [x] Integrate `TrailerPlayer` into `HeroSection.tsx`.
- [x] Implement the autoplay delay and fade transition logic.
- [x] Ensure parallax effects apply to the video player.

## Phase 4: Verification ✅ [ ]
- [ ] Test on multiple movies/shows with varying trailer availability.
- [ ] Verify behavior when the external service is offline or returns an error.
