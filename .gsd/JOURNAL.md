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
- **2026-01-22**: Integrated OMDB support to `RatingsSection`. It now fetches and displays ratings from IMDb, Rotten Tomatoes, and Metacritic if an OMDB API key is provided in Settings > Metadata.
- **2026-01-22**: Increased thickness of `RatingsSection` pills by increasing padding to 16px.
- **2026-01-22**: Removed the generic "arrow up right" icon from rating pills for a cleaner look.
- **2026-01-22**: Imported official SVG logos for Rotten Tomatoes and Metacritic from `Crispy-webui`, replacing the generic star icons and colored circles.
- **2026-01-22**: Increased size of imported rating logos to 28px to match existing badges.
- **2026-01-22**: Fixed `RatingsSection`, `CastSection`, `CommentsSection`, and `EpisodesSection` layout to allow horizontal scrolling to the screen edge while maintaining proper content alignment.
- **2026-01-22**: Implemented performance optimizations: integrated color extraction into the data-fetching hook, added shimmer skeletons for secondary data, and fixed the native `LoadingIndicator` scaling and exposure. Rendering is now "instant" and flash-free.
- **2026-01-23**: Resolved `TypeError: requireNativeView is not a function` by reverting to `requireNativeViewManager` and explicitly naming native views in `CrispyNativeCoreModule.kt`. This also fixed the secondary `ReferenceError: LoadingIndicator doesn't exist` in `HeroSection.tsx`.
- **2026-01-24**: Fixed Android bundling error caused by incorrect `TraktContext` import path in `src/app/_layout.tsx`. Updated path to `@/src/features/trakt/context/TraktContext` to align with the new directory structure.
- **2026-01-24**: Resolved `subtitleParser` resolution error in `src/app/player.tsx`. Reorganized player feature by creating `src/features/player/utils/` and `src/features/player/hooks/`, moving `subtitleParser.ts` and `usePlayerControls.ts` accordingly. Conducted a global import audit and found no further legacy references.
- **2026-01-24**: Fixed `SyntaxError` in `MetaDetailsSkeleton.tsx` (missing parenthesis) and `ReferenceError` in `CommentsSection.tsx` (missing `useCallback` import).
- **2026-01-24**: Fixed `SyntaxError` in `MetaDetailsSkeleton.tsx` (missing parenthesis) and `ReferenceError` in `CommentsSection.tsx` (missing `useCallback` import).
- **2026-01-24**: Completely rewrote `TraktService.ts` based on the `NuvioStreaming` codebase. This robust rewrite eliminates the "10 fixes and still failing" loop by implementing a strict Singleton pattern, request queueing to prevent parallel auth calls, and direct storage management. It also correctly integrates with `crispy-native`'s multi-user system via `StorageService` namespacing.
- **2026-01-24**: Implemented **Supabase Cloud Sync** (Production Grade). Added `profiles.sql` schema and created `SyncService.tsx` component. The service utilizes atomic, debounced updates (2s) to synchronize user settings, addons, and auth state to the cloud. Integrated into the global `AuthProvider` in `_layout.tsx`, ensuring seamless background sync for all authenticated users.
- **2026-01-24**: Resolved critical `RangeError` (Stack Overflow) in `TraktService` caused by a naming collision. Also restored missing `oauthDeviceCode` and `oauthToken` methods which were lost during the rewrite, fixing the "Failed to initialize Trakt auth" error in the Settings screen.
- **2026-01-24**: Redesigned "Continue Watching" cards on the Home screen to match `Crispy-webui` aesthetics.
    - Updated `TraktService` to normalize episode-specific metadata (Show Title, Season, Episode).
    - Redesigned `CatalogCard` for landscape layout with backdrop images and centered logo overlays.
    - Enhanced metadata display with formatted titles (`Show / S1E1: Title`) and a consolidated `Year • Genre` row.
    - Improved progress bar positioning for landscape cards.
- **2026-01-24**: Fixed a critical naming collision in `TraktService` that caused "Continue (sundefined eundefined)" labels. Renamed the normalized numeric `episode` field to `episodeNumber` to prevent overwriting the Trakt `episode` object. Updated types and components to match.

## 2026-01-26: Production-Grade Torrent Fix
- **Action**: Optimized native torrent core for resilience and performance.
- **Rationale**: User reported "infinite loading" and seek instability. Referenced `crispy-android` for best practices.
- **Details**:
    - **TorrentService**: Added HTTP fallback trackers; implemented `priorityWindows` piece tracking and tiered deadlines (Instant vs Buffer); implemented `resetPieceDeadline` on seek to optimize bandwidth.
    - **MPV Config**: Set modern Chrome User-Agent; disabled SSL verification for trackers; increased demuxer cache to 100MB and cache timeout to 60s.
    - **Lifecycle**: Added `performStartupCleanup` to wipe ephemeral data on startup.
- **Outcome**: Torrent playback is faster to start, more resilient to network restrictions, and highly stable during seeks.

## 2026-01-26: Responsive Hero Section
- **Action**: Implemented production-grade responsive height and layout logic for the Home screen hero.
- **Rationale**: The hero section was too tall on tablets/landscape, pushing content off-screen.
- **Details**:
    - **Calculated Height**: Moved from fixed `0.7` aspect ratio to a conditional system (`0.7` mobile, `1.2` tablet portrait, `2.2` tablet landscape).
    - **Safety Clamping**: Enforced a `maxHeight` of 55% of the viewport on tablets.
    - **Layout Constraint**: Constrained content `maxWidth` to 600px on tablets to preserve readability on ultra-wide screens.
    - **Stability**: Synchronized the `HeroCarousel` skeleton calculations with the new responsive hook to eliminate layout shifts.
- **Outcome**: Improved "above the fold" visibility for "Continue Watching" and results rows on tablets, creating a more balanced and professional layout across all device types.

## 2026-01-26: Torrent Debugging (Logging)
- **Action**: Injected verbose logging across the entire native torrent stack.
- **Rationale**: Torrenting still reported as failing. Need granular visibility into libtorrent alerts and HTTP server flow.
- **Details**:
    - **TorrentService**: Logged `ADD_TORRENT`, `METADATA_RECEIVED`, `TRACKER_REPLY`, `PEER_CONNECT`, and errors.
    - **CrispyServer**: Logged incoming HTTP requests and detailed status of the 30s header-wait loop.
    - **Bridge**: Logged `resolveStream` and `handleSeek` calls from JavaScript.
- **Goal**: Identify if failures are due to peer connectivity, metadata timeouts, or bridge communication errors.
