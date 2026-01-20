
# Phase 10: Trakt Integration

**Objective**: Port "Continue Watching" logic from WebUI 1:1 and implement basic Trakt Auth.

## User Review Required
> [!IMPORTANT]
> This phase includes a direct port of the complex `findNextEpisodeFromTMDB` and `processContinueWatching` logic from WebUI workers. This logic determines what shows up in the "Continue Watching" row.
 
## Proposed Changes

### Core Logic
#### [NEW] [TraktService.ts](file:///home/aayush/Downloads/crispy-native/src/core/api/TraktService.ts)
- Implement `TraktService` class mirroring WebUI `TraktClient`.
- Methods: `oauthDeviceCode`, `oauthToken`, `getContinueWatching`, `getPlayback`, `getWatched`.
- **Critical**: Port `findNextEpisodeFromTMDB` and `processContinueWatching` logic exactly as found in `src/worker/handlers/trakt.ts` (WebUI).

#### [MODIFY] [UserStore](file:///home/aayush/Downloads/crispy-native/src/core/stores/userStore.ts)
- Ensure `TraktAuth` interface is sufficient.
- Add actions for updating auth state (`updateTraktAuth`).

### UI Components
#### [NEW] [ContinueWatchingRow.tsx](file:///home/aayush/Downloads/crispy-native/src/components/home/ContinueWatchingRow.tsx)
- Horizontal list component (similar to `HeroCarousel` / `CatalogRow`).
- Uses `TraktService` to fetch data.
- Displays `ContentCard` items with progress bars (if available).

#### [MODIFY] [HomeScreen.tsx](file:///home/aayush/Downloads/crispy-native/src/app/(tabs)/index.tsx)
- Integrate `ContinueWatchingRow` below the Hero.
- Add refreshing logic `useFocusEffect` or similar to re-fetch when coming back to home.

#### [MODIFY] [SettingsScreen.tsx](file:///home/aayush/Downloads/crispy-native/src/app/(tabs)/settings.tsx)
- Add "Trakt" section with "Connect Account" button.
- Implement **Device Code Modal** or inline view to display the 8-digit code.
- Add "Disconnect" button if authenticated.

## Verification Plan

### Automated Tests
- None for this phase (logic is ported from validated WebUI).

### Manual Verification
1. **Auth**:
   - Go to Settings -> Connect Trakt.
   - Verify code displays and clipboard copy.
   - Auth on another device (trakt.tv/activate).
   - Verify success state in app (button changes to "Disconnect").

2. **Continue Watching**:
   - Play a movie on Trakt (via website or other app) -> pause at 50%.
   - Refresh Home Screen.
   - Verify movie appears in "Continue Watching".
   - Play an episode -> finish -> check if next episode appears (requires `findNextEpisode` logic).
   - Mark a movie as watched -> verify it DISAPPEARS (logic: filter < 80%).
