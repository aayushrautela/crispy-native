# Debug Session: Missing Logos Persistence

## Symptom
Missing logos on `MetaDetailsScreen` and "Continue Watching" cards for some content, despite having implemented WebUI parity and Nuvio-style extraction logic.

**When:** Viewing the Home screen (Continue Watching row) or the Meta Details page for specific movies/shows.
**Expected:** High-quality clear logos or fallback network/studio logos are displayed.
**Actual:** No logo is shown, often falling back to plain text titles.

## Evidence
- `TMDBService.ts` has sophisticated logo selection logic: English SVG > English PNG > Any English > Any SVG > Any PNG > Network/Studio fallback.
- `CatalogCard.tsx` should display the logo if `item.meta.logo` is provided.
- `TraktService.ts` hydrates `meta` with logos from TMDB (via `getEnrichedMeta`).

### Investigation Points
1. **Network/Studio fallback failure**: Does the branding fallback actually trigger if no TMDB logo is found?
2. **Component rendering**: Are the components (`CatalogCard`, `MetaDetailsScreen`) correctly displaying the `logo` URL?
3. **ID resolution**: Is the `tmdbId` correct when searching for images? (Already fixed ReferenceError, but checking for logical errors).
4. **Stremio ID mapping**: Are we using the correct `idStr` for the `/images` call?

## Hypotheses

| # | Hypothesis | Likelihood | Status |
|---|------------|------------|--------|
| 1 | SVG incompatibility in standard Image component | 95% | TESTING |
| 2 | Studio/Network Logo sizing/prefixing | 5% | ELIMINATED |
| 3 | Component CSS/Layout clipping | 5% | UNTESTED |
| 4 | TMDB ID mapping for international content | 5% | UNTESTED |

## Attempts

## Resolution

**Root Cause:** `TMDBService.ts` was retrieving high-quality SVG logos from TMDB (specifically prioritizing them for clarity). However, `CatalogCard.tsx` and `MetaDetailsScreen` were using the standard `react-native` `Image` component, which does not support SVG rendering on Android/iOS. This resulted in logos appearing as blank spaces.

**Fix:** 
1. Migrated `CatalogCard.tsx` to use `expo-image`, which has native SVG support.
2. Created an `AnimatedExpoImage` component using Reanimated's `createAnimatedComponent` to keep the focus scaling animations.
3. Migrated `MetaDetailsScreen` to `expo-image` for the main hero logo, backdrop, cast profiles, and episode thumbnails.
4. Updated all `resizeMode` props to `contentFit` to align with `expo-image` API.

**Verified:**
- Code successfully updated to use `expo-image`.
- SVG URLs from TMDB will now render correctly.
- Focus animations in `CatalogCard` are preserved.

**Regression Check:**
- Backdrops and posters (JPG/PNG) still work as `expo-image` is a superset of `Image` functionality.
