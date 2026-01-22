## 2026-01-18: Reference Mapping

- **Action**: Added `Crispy-webui` and legacy Android `app` to the knowledge base.
- **Rationale**: User requested access to UI and legacy logic for development reference.
- **Details**: 
  - `Crispy-webui` mapped at `../Crispy-webui` (Vite, React 19, Tailwind 4).
  - Legacy Android mapped at `../app` (Kotlin, jlibtorrent, NanoHTTPD).
  - Updated `STACK.md` and `ARCHITECTURE.md` with these details.

## 2026-01-18: GitHub Workflow Repair

- **Action**: Modernized `android-build.yml`.
- **Rationale**: Needed a reliable way to compile Android APKs in CI as local resources are limited.
- **Details**:
  - Enforced JDK 21 and Gradle 9.1.0.
  - Switched to `assembleDebug` for guaranteed APK generation without release secrets.
  - Added robust caching via `setup-gradle` action.

## 2026-01-18: Phase 2 Completion & Architecture Refinement

- **Action**: Finalized Addon Engine and Provider Layer.
- **Rationale**: Core infrastructure for content discovery and torrent streaming is now in place.
- **Details**:
  - Implemented `crispy-native-core` module for torrent streaming.
  - Built `AddonService` and `ProviderStore` for Stremio addon integration.
  - **Key Change**: Based on user feedback, removed the "Direct-then-Proxy" logic. Realized that since we are running in a pure React Native environment, browser-level CORS restrictions are non-existent for native fetches. This simplified the `CrispyServer` to a pure streaming engine and `AddonService` to standard direct fetches.
- **Decision**: Keep the local server purely for torrent piece serving (required for MPV playback) but stop using it as an API proxy.

## 2026-01-20

### AI Insights & Settings Integration
- **Action**: Integrated user-configurable AI insights and OpenRouter key management.
- **Rationale**: Allow users to use their own AI keys and models for personalized meta insights.
- **Details**:
    - Aligned `useAiInsights` prompt and logic with the WebUI implementation.
    - Updated `UserStore` and `SettingsScreen` with MD3 Expressive UI for AI configuration.
    - Enhanced `ExpressiveButton` with native loading indicators.


## Session: Player Stability & UI Refinement (2026-01-21)
### Summary
Focused on resolving widespread player instability and refining the bottom sheet interaction model.
### Decisions
- Standardized all timing to Double (Seconds) to eliminate unit conversion bugs.
- Implemented 'Loading' guards on 'onEnd' to prevent premature player closure during stream switching.
- Refactored Bottom Sheets to use `BottomSheetFlatList` and dynamic sizing for a native MD3 feel.
- Established a global 70% screen height limit for all bottom sheets to maintain visual balance.
### Outcome
Player is stable, seeking is reliable, and UI interactions (especially stream selection) feel fast and native.
- **2026-01-22**: Refactored Meta Details actions. Replaced Like/Dislike with Rate button to simplify the UI as requested.
- **2026-01-22**: Implemented immediate performance fixes. Replaced  with  in  and memoized sub-components in  to reduce re-renders and improve scroll smoothness.
- **2026-01-22**: Implemented immediate performance fixes. Replaced `FlatList` with `@shopify/flash-list` in `CatalogRow` and memoized sub-components in `MetaDetailsScreen` to reduce re-renders and improve scroll smoothness.
- **2026-01-22**: Extended FlashList optimization to Discover and Library pages. Replaced  with  and optimized grid rendering for 60FPS performance.
- **2026-01-22**: Implemented production-grade UI performance optimizations. Modularized `MetaDetailsScreen` into memoized sub-components, consolidated data fetching with `useMetaAggregator`, implemented Skeleton UI for progressive reveal, and optimized catalog filtering with pre-parsed ratings.
- **2026-01-22**: Completed Trakt integration phase. Extended `TraktService` for comments, implemented `useTraktWatchState` and `useTraktComments` hooks, enhanced `HeroSection` with dynamic watch status and progress indicators, and added a production-grade `CommentsSection` with spoiler handling and detailed bottom sheet view.
- **2026-01-22**: Refined `HeroSection` UI by removing the progress bar from the "Watch Now" button per user feedback.
- **2026-01-22**: Adjusted watch state labels for shows to use episode info (e.g., `Continue (SX EX)`) instead of percentage resume, matching `Crispy-webui` logic.
- **2026-01-22**: Further refined labels to maintain `Resume from %` specifically for movies while keeping `Continue (SX EX)` for shows, ensuring distinct UX for each content type.
- **2026-01-22**: Refined `RatingsSection` badges to use a full pill shape (borderRadius 99) as requested.
- **2026-01-22**: Redesigned `CommentCard` to match `EpisodeCard` aesthetics (removed borders, matched background alpha, synchronized corner radius) and replaced emojis with Lucide icons for a more consistent MD3 look.
- **2026-01-22**: Standardized card border radius to 16px across `EpisodeCard` and `CommentCard` to match the project's catalog card standard.
- **2026-01-22**: Implemented dynamic runtime fetching in `TMDBService`. Movies use `runtime` and shows use `episode_run_time[0]`, formatted as `X hr Y min`. `HeroSection` now displays this dynamic data instead of a hardcoded placeholder.
- **2026-01-22**: Implemented smart color logic in `HeroSection` to dynamically switch the "Watch Now" button color. It defaults to `lightVibrant` but falls back to `lightMuted` if the `lightVibrant` color is determined to be too dark (luma < 60), ensuring optimal contrast with the black button text.
- **2026-01-22**: Redesigned "Watch Now" button in `HeroSection` to be thicker (68px) and feature a left-aligned icon inside a darker accent pill (60x40px), mimicking modern streaming platform aesthetics.
- **2026-01-22**: Added "Ends at [time]" subtext to the "Watch Now" button, calculated dynamically from `runtimeMinutes` (added to `TMDBService`) and current watch progress.
- **2026-01-22**: Increased thickness of `RatingsSection` pills by increasing padding to 16px.
