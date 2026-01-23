---
phase: 5
plan: 1
wave: 1
---

# Plan 5.1: Trakt Service Extension

## Objective
Extend `TraktService` to support write operations (add/remove/rate) for watchlist, history, and collection, matching `Crispy-webui` capabilities.

## Context
- .gsd/SPEC.md
- src/core/api/TraktService.ts
- src/core/api/trakt-types.ts

## Tasks

<task type="auto">
  <name>Update Trakt Types</name>
  <files>src/core/api/trakt-types.ts</files>
  <action>
    Add necessary interfaces for Sync API payloads and responses:
    - `TraktSyncResponse` (added, deleted, existing)
    - `TraktSyncPayload` (movies, shows, episodes with ids)
    - `TraktRatingPayload`
  </action>
  <verify>grep "TraktSyncResponse" src/core/api/trakt-types.ts</verify>
  <done>Types exist and match Trakt API definitions.</done>
</task>

<task type="auto">
  <name>Implement Write Methods</name>
  <files>src/core/api/TraktService.ts</files>
  <action>
    Implement static methods for:
    - `addToWatchlist`, `removeFromWatchlist`
    - `addToHistory` (mark watched), `removeFromHistory`
    - `addToCollection`, `removeFromCollection`
    - `addRating`, `removeRating`
    
    Ensure correct payload formatting (handling TMDB/IMDB IDs).
  </action>
  <verify>grep "addToWatchlist" src/core/api/TraktService.ts</verify>
  <done>Methods allow performing all required user actions via API.</done>
</task>

## Success Criteria
- [ ] `TraktService` has all methods required for the features.
- [ ] Types compile without errors.
