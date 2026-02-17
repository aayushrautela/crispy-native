# Meta + Artwork Standardization Plan (Trakt -> Media Core)

## Goal

Make media metadata + artwork consistent across the app by:

- Treating `@crispy-streaming/media-core@^0.4.0` as the single source of truth for Trakt normalization (IDs + images).
- Restoring Trakt posters everywhere (Library, Trakt Top Picks, Watchlist/Collection/Watched/History/Rated).
- Standardizing Continue Watching cards to prefer episode stills, with safe fallbacks.
- Restricting TMDB enrichment so it only fills what we actually want (Continue Watching: logo/backdrop/details) and never overrides Trakt posters (and never invents posters when Trakt has none).

Non-goals:

- Redesigning UI layouts.
- Adding SIMKL yet (this plan leaves extension points).

## Current State (Observed)

- App depends on published `@crispy-streaming/media-core` (now `0.4.0` is available).
- `crispy-media-core@0.4.0` fixes the Trakt episode ID merge bug by keeping episode items show-scoped at top-level (`ids` and canonical `id`), and exposes an episode still as `images.thumbnail`.
- App currently:
  - Projects only `poster/backdrop/logo` from `normalizeTraktItem()` inside `src/core/services/TraktService.ts`.
  - Does not carry any `thumbnail` field through to UI.
  - Uses `useTraktEnrichment()` only in Continue Watching cards; library/top-picks are pure (no enrichment).
- Posters are missing across all Trakt surfaces.

## Standard Data Model (App-Level)

Extend the preview item model to explicitly support episode stills:

- `MetaPreview` gains `thumbnail?: string`.
- Semantics:
  - `poster`: primary poster art (2:3, grid).
  - `backdrop`: show/movie backdrop (16:9).
  - `logo`: title logo overlay (used primarily on landscape cards).
  - `thumbnail`: episode still/screenshot (Continue Watching landscape preference).

## Artwork Selection Rules

### Library / Catalog Cards

- No enrichment.
- Poster cards use `poster` only.
- Landscape cards use `backdrop || poster`.
- If `poster` is missing: keep blank/placeholder (no TMDB fallback).

### Continue Watching Cards (Landscape)

- Image priority: `thumbnail || backdrop || poster`.
- If all are missing: keep blank/placeholder.
- Logo overlay: show when `logo` exists (do not require TMDB).

## Trakt Fetch Policy

Trakt is responsible for list artwork. For list endpoints, we only need images:

- Use `extended=images` for Trakt sync/list endpoints.
- We accept reduced list metadata; meta/detail views already rely on TMDB.

This specifically targets restoring posters by ensuring the payload includes `*.images.*` reliably.

## TMDB Enrichment Policy (Only Where Needed)

Scope: `useTraktEnrichment()` (currently Continue Watching only).

Rules:

- Never override `poster` (Trakt poster is canonical).
- Never fill missing `poster` (keep blank).
- Prefer to fill:
  - `logo` (when missing)
  - `backdrop` (when missing)
  - optional details: `description`, `year`, `rating`, etc. (if desired for CW)
- Episode-specific TMDB call (`getEpisodeDetails`) is allowed only for extra details + stills if/when we want it. With media-core `images.thumbnail`, we can skip TMDB episode stills entirely unless we explicitly want TMDB text fields.

Perf/logging:

- Avoid TMDB calls when the card already has what it needs (e.g., CW has `thumbnail` and `logo` and `backdrop`).
- Treat TMDB misses as normal (and dedupe noisy logs) if any remain.

## Implementation Plan (Phased)

### Phase 1 — Upgrade + Restore Trakt Posters

1) Bump app dependency:

- Update `package.json` to `"@crispy-streaming/media-core": "^0.4.0"`.
- Run install.

2) Standardize Trakt list calls to `extended=images`:

- In `src/core/services/TraktService.ts`, change GET list endpoints that currently use `extended=images,full` or `extended=full,images` to `extended=images`.
  - Watchlist, Collection, Watched (movies/shows), History, Ratings (GET), Recommendations.
- Keep endpoints that already use `extended=images` as-is (Continue Watching).

Expected outcome:

- `normalizeTraktItem()` sees `images.poster` again; `item.poster` becomes populated for library and top picks.

### Phase 2 — Pass Through Episode Thumbnails

1) Type + projection:

- Add `thumbnail?: string` to `src/core/types/stremio.ts` (`MetaPreview`).
- In `src/core/services/TraktService.ts` `normalize(...)`, project `thumbnail` from media-core:
  - `thumbnail = core.images.thumbnail` (if present).

2) Continue Watching UI:

- Update `src/features/home/components/ContinueWatchingCard.tsx` (landscape mode) to select:
  - `thumbnail || backdrop || poster`.

Expected outcome:

- CW shows episode stills (when available) without any TMDB enrichment.

### Phase 3 — Enrichment: Limit Overrides + Reduce Calls

In `src/hooks/useTraktEnrichment.ts`:

- Change merge policy so `poster` (and `thumbnail`) are never overridden.
- Only use TMDB to fill missing `logo` and missing `backdrop` (and optionally text fields).
- Adjust “skip TMDB” heuristic:
  - Skip when we already have the fields CW needs for display.

Expected outcome:

- CW cards look consistent with Trakt posters across the app; TMDB adds only the extras.

### Phase 4 — Verification + Guardrails

1) Manual checks (dev build):

- Home: Continue Watching row shows episode stills when available.
- Home: Trakt Top Picks shows posters.
- Library:
  - Watchlist/Collection/Watched/Continue/Rated show posters.
- Meta screen:
  - “Continue” state still picks correct episode.
- No more TMDB `/tv/<episodeId>` 404 spam (should be fixed by media-core 0.4.0).

2) Automated checks:

- `npx tsc -p tsconfig.json --noEmit`
- `npm run lint`

## Risks / Open Questions

1) Trakt API behavior:

- If `extended=images` still fails to return images for some endpoints, we may need to verify headers and response shape and adjust parsing accordingly.

2) Recommendations normalization:

- `getMixedRecommendations()` currently injects a `type` string before normalization. If Trakt returns direct show/movie objects, ensure media-core interprets the injected `type` correctly and does not change behavior.

3) Caching keys:

- Media-core 0.4.0 episode IDs include a `:<season>:<episode>` suffix on canonical IDs.
- `EnrichmentCache.getKey()` currently uses strict IDs verbatim; for episodes this could mean episode-specific cache entries.
- This is likely fine because CW dedupes to one entry per show, but we can revisit if we later cache show-level enrichment separately.

## Approval Gate

Once you approve this plan, I will implement Phase 1 first (restore posters), then Phase 2 (episode thumbnails in CW), then Phase 3 (enrichment policy).
