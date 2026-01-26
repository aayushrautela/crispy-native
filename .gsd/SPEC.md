# SPEC: Trakt Integration & UI Enhancements

Status: FINALIZED (Performance Optimized)

## Goal
Implement comprehensive Trakt user interactions (Library management, Rating, Watch status) and enhance the UI with actionable buttons on the Details page and a Bottom Sheet menu for Catalog cards, matching the `Crispy-webui` logic and visual style.

## Requirements

### 1. Trakt Service & Logic
- **API Extension**: Extend `TraktService` to support write operations:
    - Add/Remove from Watchlist.
    - Add/Remove from Collection (Library).
    - Mark as Watched/Unwatched (History).
    - Rate/Unrate content (Movies, Shows, Episodes).
- **State Management**: Implement a `TraktContext` (or extend existing stores) to handle:
    - user's library state (`watchlist`, `collection`, `watched`, `ratings`).
    - Optimistic updates for immediate UI feedback.
    - Syncing logic (background refresh after action).

### 2. Details Page UI
- **Action Buttons**: Add new interactive buttons to the Hero/Details section:
    - **My List**: Toggle presence in Watchlist.
    - **Rate**: Open a rating modal/dialog to rate the content (1-10 stars).
    - **Watched**: (Optional/Contextual) Toggle watched status or show progress.
- **Visuals**: Match `Crispy-webui` styling (Google-like buttons, clean icons).

### 3. Catalog UI (Long Press)
- **Interaction**: Add `onLongPress` handler to `CatalogCard`.
- **Bottom Sheet**: Show a native-style Bottom Sheet on long press with options:
    - Add to / Remove from Library (Collection).
    - Add to / Remove from Watchlist.
    - Mark as Watched / Unwatched.
    - Rate resource.
    - View Details.

### 4. Technical Constraints
- **Logic Source**: Port logic from `Crispy-webui` (`useTraktIntegration.ts`, `TraktContext.tsx`).
- **UI Source**: Reference `Crispy-webui` mobile layout and `MetaDetailsDesktop`.
- **Platform**: React Native (Expo). Ensure styles work on Android/iOS.

## Verification Criteria
- **Service**: Can successfully call Trakt API to add/remove/rate.
- **Details Page**: Buttons correctly reflect current state (e.g., "In List" vs "My List") and toggle state.
- **Catalog**: Long press opens Bottom Sheet. Menu items work and update state.
- **Optimism**: UI updates immediately before API response.

## 5. Media & PiP Stability (Phase 9)
- **Media Notifications**: Must show title, episode/artist, and artwork correctly.
- **Auto-PiP**: App must enter PiP mode automatically on home swipe (backgrounding while playing).
- **PiP Visuals**: PiP window must respect video aspect ratio (16:9) and hide all UI controls/overlays.
- **Screen Management**: Device must not sleep while video is playing (Keep Screen On).

## 6. Auth UI Redesign (Phase 17)
- **Visual Style**: Follow Material 3 Expressive design system.
- **Components**:
    - Use `Screen` with `gradient` background.
    - Use `ExpressiveSurface` with high rounding (`3xl`) for the form.
    - Use `Typography` for all text (MD3 variants).
    - Use `ExpressiveButton` for all actions.
- **Layout**: Center aligned, edge-to-edge padding on mobile, maximum width on tablets.
- **Interactions**: Smooth transitions between Login and Sign Up states using `react-native-reanimated`.

## 7. Production-Grade Performance Optimization
- **Service-Level Hydration**: `TraktService` must fetch images using `?extended=images` to avoid N+1 requests to TMDB.
- **Dumb Card Pattern**: `CatalogCard` must be passive in list views, skipping enrichment hooks if a poster already exists.
- **State Atomicity**: Migrate monolithic Trakt context to **Zustand** with selectors to prevent global re-renders.
- **Concurrency Gates**: Implement a request queue for enrichment to protect the React Native bridge from congestion.

## 8. Torrent Workflow Optimization (Production Grade)
- **Goal**: Resolve "infinite loading" and seeking instability in native torrent playback.
- **Trackers**: Add HTTP/HTTPS fallback trackers for UDP-restricted networks.
- **Buffering**: Implement tiered piece prioritization (Instant vs Buffer tiers).
- **Seek Management**: Implement priority windows and piece deadline resetting to stop downloading irrelevant data after a seek.
- **Player Resilience**: Configure standard User-Agents, disable SSL verification for trackers, and tune demuxer cache (100MB buffer).
- **Persistence**: Ensure ephemeral playback by wiping the download directory on app startup and after playback.
## 9. Tablet Landscape Redesign (Production Grade)
- **Goal**: Optimize the Movie/Show details screen for tablet landscape orientation using a split-pane cinematic layout.
- **Layout Logic**:
    - Trigger: `isTablet && isLandscape` from `useResponsive`.
    - Component: `SplitHeroLayout`.
    - **Left Pane (60%)**: Media Visuals.
        - Contains `HeroBackdrop` (Image/YouTubeTrailer).
        - Contains `TrailerButton` (positioned within visual context).
        - Transition: Horizontal `LinearGradient` on the right edge (Right edge fade).
    - **Right Pane (40%)**: Meta & Actions.
        - Contains Logo/Title (Top-Left aligned).
        - Contains Metadata (Rating, Year, Runtime).
        - Contains Description (Plot summary, non-centered).
        - Contains `ActionStack` (Watch Button + Trakt Action Row: Watchlist, Collection, Watched, Rate).
- **Body Content**:
    - Remains full-width starting from `RatingsSection`.
    - Optional: `maxWidth` constraint for readability.
- **Performance**:
    - Use `Composition Pattern` to avoid massive if/else in render blocks.
    - Leverage `memo` for split-pane sub-components.
