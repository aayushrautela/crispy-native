# SPEC: Trakt Integration & UI Enhancements

Status: FINALIZED

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
