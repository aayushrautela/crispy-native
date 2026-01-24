# ROADMAP: Feature Implementation

## Phase 1: Trailer Autoplay - Data & Services 🏗️ [DONE]
- [x] Update `TMDBService.ts` to include `videos` in enriched metadata.
- [x] Create `TrailerService.ts` for extraction backend communication.
- [x] Verify extraction logic with a test YouTube key.

## Phase 2: Trailer Autoplay - Player Component 📺 [DONE]
- [x] Create `TrailerPlayer.tsx` using `react-native-video`.
- [x] Style the player to match the Hero card dimensions and overlay logic.
- [x] Implement mute/autoplay controls.

## Phase 3: Trailer Autoplay - UI Orchestration 🎬 [DONE]
- [x] Integrate `TrailerPlayer` into `HeroSection.tsx`.
- [x] Implement the autoplay delay and fade transition logic.
- [x] Ensure parallax effects apply to the video player.

## Phase 4: Trailer Autoplay - Verification ✅ [DONE]
- [x] Test on multiple movies/shows with varying trailer availability.
- [x] Verify behavior when the external service is offline or returns an error.

---

## Phase 5: Trakt Logic & Core 🧠 [ ]
- [ ] Update `TraktService` with `add`/`remove`/`rate` API methods.
- [ ] Create `TraktContext` (or update Store) to handle user state (Watchlist, Collection, Ratings).
- [ ] Implement optimistic updates and state syncing logic (port from `Crispy-webui`).

## Phase 6: Details Page UI 🎨 [ ]
- [ ] Add "My List" button to `HeroSection` (with toggle state).
- [ ] Add "Rate" button and `RatingModal` component.
- [ ] Ensure buttons match `Crispy-webui` styling.

## Phase 7: Catalog & Interactions 👆 [ ]
- [ ] Create `BottomSheet` component for card options.
- [ ] Update `CatalogCard` to handle `onLongPress`.
- [ ] Connect Bottom Sheet actions to `TraktContext` methods.

## Phase 8: Trakt Verification ✅ [ ]
- [ ] Verify adding/removing items updates UI immediately.
- [ ] Verify persistence across app restarts (via Store).
- [ ] Test long-press on various card sizes/device types.

## Phase 9: Media & PiP Stability ✅ [DONE]
- [x] Pass correct metadata to native player.
- [x] Implement Home swipe auto-PiP.
- [x] Implement "Keep Screen On" logic.

## Phase 10: Performance Optimization ✅ [DONE]
- [x] Memoize TraktContext.
- [x] useCallback for MetaDetails handlers.

## Phase 15: Architecture Refactor 🏗️ [/]
- [ ] Refactor Directory Structure (Feature-First).
- [ ] Decouple Trakt/TMDB Services.
- [ ] Migrate to TanStack Query & Zustand.
- [ ] Consolidate UI Kit into `src/core/ui`.
