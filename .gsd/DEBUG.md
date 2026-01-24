# Debug Session: Trakt Context & Sync Issues

## Symptoms
1. `TypeError: _coreServicesTraktService.TraktService.getContinueWatching is not a function` in `TraktContext.tsx`.
2. `Trakt API Error: 405` for `/sync/collection/movies,shows?extended=full`.
3. Addons not persisting across app restarts.

## Hypotheses
| # | Hypothesis | Likelihood | Status |
|---|------------|------------|--------|
| 1 | `TraktService` missing static proxy methods called by `TraktContext` | 100% | FIXED |
| 2 | Trakt API endpoint `/sync/collection/movies,shows` does not support multiple types or comma syntax | 100% | FIXED (Split requests) |
| 3 | `SyncService` overwrites local addon state with empty cloud state on initial load | 80% | INVESTIGATING (Standardized Trakt to Global) |
| 4 | `TraktContext` calls `getWatched()` which is missing from `TraktService` | 100% | FIXED |
| 5 | `ReferenceError: Property 'useAuth' doesn't exist` in `SettingsSubpage.tsx` | 100% | FIXED (Consolidated relative imports) |
| 6 | Trakt data normalization mismatch (`access_token` vs `accessToken`) | 100% | FIXED |
| 7 | `ReferenceError: Property 'Filter' doesn't exist` in `CatalogScreen` | 100% | FIXED |

## Resolution: CatalogScreen Crash
**Root Cause:** Missing imports for `ArrowLeft`, `ChevronDown`, `Filter`, and `Star` from `lucide-react-native`.
**Fix:** Added the missing imports to [src/app/catalog/[id].tsx](file:///home/aayush/Downloads/crispy-native/src/app/catalog/[id].tsx).
**Verified:** Confirmed all icons used in the file are now correctly imported.

## Plan
1. Fix `TraktService` static methods to match `TraktContext` calls.
2. Investigate/Fix Trakt API endpoint for collection.
3. Improve `SyncService` hydration logic to prevent data loss.
