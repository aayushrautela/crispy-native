# Plan: Fix Trakt Images + Stream Selection (Addon Streams)

This repo contains two moving parts:

- App: `crispy-native/` (Expo / React Native)
- Shared package: `crispy-media-core/` published as `@crispy-streaming/media-core` (currently consumed by the app)

The goal is to fix (1) broken Trakt images and (2) stream selection always showing "Try adding more addons...", then publish a new `@crispy-streaming/media-core` version and bump the app.

## Status (This Branch)

- Media core (`@crispy-streaming/media-core`): ready to publish `0.3.2`.
  - Trakt `/images/...` URLs now resolve against `https://walter.trakt.tv`.
  - Added `formatIdForIdPrefixes()` for Stremio addon `idPrefixes`.
  - Added vitest coverage in `crispy-media-core/test/**`.
- App (`crispy-native`): wired to the new helpers (requires publishing `0.3.2` before running a clean `npm install`).
  - Streams: `useStreams` formats IDs per addon manifest `idPrefixes` and respects `addon.enabled`.
  - Subtitles: `fetchAllSubtitles` formats IDs per addon manifest `idPrefixes`.
  - Trakt ratings: now requests `extended=full,images`.
  - Stream selector copy: now explains *why* no streams are shown.

## Goals

- Trakt-backed UI renders valid posters/backdrops/logos (no broken image URLs).
- Stream selection returns streams when a compatible stream addon is installed, and the empty-state message is accurate when it is not.
- Move the *small, reusable, pure* pieces into `@crispy-streaming/media-core` so other clients don't re-implement the same ID/image logic.

## Non-goals (for this pass)

- No UI redesign.
- No new addon discovery/search UX.
- No changes to `modules/crispy-native-core/**`.

## Root Causes (Before Fix)

### Trakt images are broken

- `@crispy-streaming/media-core` `normalizeTraktItem()` is responsible for producing `core.images.*`.
- In `crispy-media-core/src/trakt/normalize.ts`, `normalizeImageUrl()` previously rewrote **any** relative path starting with `/` to:
  - `https://image.tmdb.org/t/p/original<path>`
- Trakt "images" can be served by Walter/Trakt CDN and show up as relative paths like `/images/...`.
  - Those used to get rewritten to TMDB's host, producing invalid URLs.

Also:

- In the app `src/core/services/TraktService.ts`, most Trakt list endpoints use `extended=images`.
- Ratings endpoints currently don't request images (`/sync/ratings/movies` and `/sync/ratings/shows`), so even a perfect normalizer can't render images there.

### Stream selection always says to install more addons

- The empty-state copy is in `src/features/player/components/StreamSelector.tsx`.
- Stream fetching is in `src/features/player/hooks/useStreams.ts` and ultimately calls:
  - `src/core/services/AddonService.ts` -> `/stream/<type>/<id>.json`
- Default addons shipped in `src/core/stores/userStore.ts` are catalog + subtitles only (no stream addon).
  - So "no streams" is expected by default.
- Even when a stream addon is installed, the app previously passed internal strict IDs into addon endpoints:
  - `src/app/meta/[id].tsx` passes `strictBaseId` (e.g. `imdb:movie:tt...` / `tmdb:show:123`) and for episodes appends `:<season>:<episode>`.
- Many Stremio stream addons expect IDs based on their manifest `idPrefixes` (commonly `tt` or `tmdb:`), not `provider:kind:id`.
  - Previously we did not use `idPrefixes` when calling `/stream/...`.

## Plan

### Phase 1: Patch + Release `@crispy-streaming/media-core`

Target: ship a new npm version (suggested `0.3.2`).

#### 1) Fix Trakt image URL normalization

Files:

- `crispy-media-core/src/trakt/normalize.ts`

Change:

- Update `normalizeImageUrl()` to treat Walter/Trakt paths correctly.
- Rule set (ordered):
  - `http://` / `https://` -> return as-is
  - `//...` -> prefix `https:`
  - `/http...` -> prefix `https:` (existing behavior)
  - `/images/...` -> prefix `https://walter.trakt.tv`
  - otherwise if it starts with `/` -> keep existing TMDB behavior (`https://image.tmdb.org/t/p/original`)

Notes:

- Keep this logic inside Trakt normalization (don't change TMDB normalization).
- Keep the output URLs absolute.

#### 2) Add regression tests for Trakt image normalization

Files:

- New: `crispy-media-core/test/trakt.normalize.test.ts`

Test cases:

- When Trakt image variant is `/images/...`, normalized output starts with `https://walter.trakt.tv/images/`.
- When it is `//walter.trakt.tv/images/...`, output starts with `https://walter.trakt.tv/images/`.
- When it is `/abcd.jpg` (TMDB-style), output starts with `https://image.tmdb.org/t/p/original/`.
- When it is already absolute, output remains unchanged.

#### 3) (Optional but recommended) Fix Trakt image typings to match reality

Files:

- `crispy-media-core/src/trakt/types.ts`

Current types treat `images.poster/logo/fanart/thumb` as arrays of variants.
In practice, they may appear as:

- array of variants
- single object variant
- string URL

Update the TS types to a union so downstream code doesn't fight the type system.

#### 4) Add an ID formatter for Stremio addon `idPrefixes`

Rationale:

- This is pure ID work and the app currently re-implements ID heuristics in multiple places.
- Moving this into media-core lets us keep a single, strict implementation.

Files:

- New: `crispy-media-core/src/ids/idPrefixes.ts` (name flexible)
- Update: `crispy-media-core/src/index.ts` to export it

Proposed API:

- `formatIdForIdPrefixes(input: string | number, mediaType: 'movie' | 'series', idPrefixes?: string[]): string | null`

Behavior:

- Parse with `parseMediaIdInput(input, { assumeNumeric: 'none' })` and preserve `:<season>:<episode>` when present.
- Generate candidates (when available):
  - imdb: `tt...` (prefix `tt`), `imdb:tt...` (prefix `imdb:`)
  - tmdb: `tmdb:<id>` (prefix `tmdb:`)
  - trakt: `trakt:<id>` (prefix `trakt:`)
  - tvdb/simkl similarly
- Choose the first candidate whose prefix matches the manifest `idPrefixes`.
- If no match and `idPrefixes` is empty/undefined, return a sensible default for addons:
  - Prefer imdb bare `tt...` when available, else `tmdb:<id>`, else `normalizeIdForKey(input)`.

Tests:

- New: `crispy-media-core/src/ids/idPrefixes.test.ts`

- Add coverage in `crispy-media-core/test/ids.test.ts` (or a dedicated `crispy-media-core/test/idPrefixes.test.ts`).
- Cover movie + series episode cases, ensuring suffix preservation.

#### 5) Version + publish

Files:

- `crispy-media-core/package.json` (bump version)
- `crispy-media-core/CHANGELOG.md` (add `0.3.2` entry)

Commands (from `crispy-media-core/`):

- `npm test`
- `npm run build`
- `npm publish`

### Phase 2: App fixes (consume new media-core)

#### 6) Bump dependency

Files:

- Root `package.json`: bump `@crispy-streaming/media-core` to the new version

Commands:

- `npm install`

#### 7) Ensure Trakt ratings endpoints request images

Files:

- `src/core/services/TraktService.ts`

Change:

- Update ratings fetches to include images:
  - `/sync/ratings/movies?extended=full,images`
  - `/sync/ratings/shows?extended=full,images`

Acceptance:

- Ratings UI now has `poster/backdrop` populated when available.

#### 8) Make stream fetching `idPrefixes`-aware

Files:

- `src/features/player/hooks/useStreams.ts`
- `src/core/services/AddonService.ts`

Changes:

- Respect addon enabled flags (align with subtitles logic): only use addons with `enabled !== false`.
- When selecting addons:
  - Require `stream` resource.
  - If resource entry is an object with `types`, skip addons that don't support the requested `type`.
- For each addon, compute the request id using the new media-core helper:
  - Extract `idPrefixes` from the manifest `stream` resource object when present.
  - `requestId = formatIdForIdPrefixes(id, type === 'movie' ? 'movie' : 'series', idPrefixes)`.
  - Fall back to the current `id` only if we cannot format.

Optional robustness:

- If a request returns zero streams and the addon declares multiple `idPrefixes`, consider trying the next best prefix once (cap attempts to avoid exploding requests).

Acceptance:

- With a common stream addon installed (e.g., Torrentio), streams appear for:
  - movies where we have an IMDb id
  - series episodes (season/episode suffix preserved)
  - TMDB-only items (`tmdb:<id>`)

#### 9) Apply the same ID formatting to external subtitles

Files:

- `src/features/player/overlay/PlayerOverlayRoot.tsx`
- `src/core/services/AddonService.ts`

Change:

- Wherever we call addon subtitle endpoints, format `contentId` using the addon's `subtitles` resource `idPrefixes` (same helper).

Acceptance:

- Subtitles show up for the same content where streams show up (when addons support it).

#### 10) Make StreamSelector empty-state accurate

Files:

- `src/features/player/components/StreamSelector.tsx`

Change:

- Replace the single "Try adding more addons..." message with conditional messaging:
  - If there are 0 enabled stream addons: "No stream addons enabled. Add one in Settings."
  - If stream addons exist but none returned streams: "No streams returned from your addons for this ID."
  - If manifests are still loading (missing manifests): keep "Searching..."

Acceptance:

- Users get the right next action (enable/add addons vs ID incompatibility vs genuinely no streams).

#### 11) Validation matrix

- Trakt:
  - Playback list (`/sync/playback`) images render.
  - Watchlist/collection/history images render.
  - Ratings images render.
- Streams:
  - Default install (no stream addons): correct empty-state copy.
  - With a stream addon installed:
    - `tt...` content returns streams.
    - `imdb:movie:tt...` internal ids are translated correctly.
    - `tmdb:movie:<id>` internal ids are translated to `tmdb:<id>`.
    - Episodes preserve `:<season>:<episode>`.

Commands:

- `npm run lint`
- `npx tsc -p tsconfig.json --noEmit`

## Notes / Future Cleanup (separate PR)

- Collapse app-local ID/key heuristics (`TraktContext.getItemKey`, `traktStore.buildIds`, `EnrichmentCache.getKey`, etc.) into media-core helpers so all list membership checks and cache keys stay consistent.
- Consider adding a pure `buildTraktScrobbleBody(...)` to media-core; app currently hand-builds these request bodies.
