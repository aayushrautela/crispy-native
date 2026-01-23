---
phase: 5
plan: 2
wave: 1
---

# Plan 5.2: Trakt Context & State

## Objective
Create `TraktContext` to manage library state, provide global access to Trakt data, and handle optimistic updates for a responsive UI.

## Context
- src/core/context/TraktContext.tsx (New)
- src/core/api/TraktService.ts

## Tasks

<task type="auto">
  <name>Create TraktContext</name>
  <files>src/core/context/TraktContext.tsx</files>
  <action>
    Create a context implementation porting `useTraktIntegration` logic:
    - State: `watchedMovies`, `watchedShows`, `watchlist`, `ratings`, `collection`.
    - Methods: `isAuthenticated` check, `loadAllCollections`.
    - Helper sets: `watchedIds`, `watchlistIds` for O(1) checks.
    - Hooks: `markAsWatched`, `rateContent` with optimistic state updates.
    - Integration: Uses `TraktService` for API calls.
  </action>
  <verify>grep "TraktContext" src/core/context/TraktContext.tsx</verify>
  <done>Context provides complete Trakt integration logic including optimistic updates.</done>
</task>

<task type="auto">
  <name>Export Library Data</name>
  <files>src/core/context/TraktContext.tsx</files>
  <action>
    Ensure the context exports helper functions used by UI:
    - `isMovieWatched(id)`
    - `isEpisodeWatched(id, s, e)`
    - `isInWatchlist(id)`
    - `getUserRating(id)`
    - `getWatchState(id)`
  </action>
  <verify>grep "getWatchState" src/core/context/TraktContext.tsx</verify>
  <done>UI components can query state easily.</done>
</task>

## Success Criteria
- [ ] `TraktContext` manages all library state.
- [ ] Optimistic updates ensure instant UI response.
