# ROADMAP.md

> **Current Phase**: Phase 4: Playback & Streaming
> **Milestone**: v1.0 Alpha

## Must-Haves (from SPEC)
- [ ] Native Material You UI components
- [ ] Addon resolution and catalog browsing
- [ ] Cloud Sync via Supabase
- [ ] Production-grade video player
- [ ] D-Pad support for TV

## Phases

### Phase 1: Foundation & Identity
**Status**: ✅ Completed
**Objective**: Establish the core architecture, design system (M3 Expressive + AMOLED), and authentication flow (including Guest Mode).
**Requirements**: REQ-01, REQ-03, REQ-09, REQ-11, REQ-12 (Guest Mode Layout), REQ-13 (AMOLED Theme)

### Phase 3: Catalog Explorer UI
**Status**: ✅ Completed
**Objective**: Build dynamic catalog browsing, meta views, and addon management.
**Requirements**: REQ-05, REQ-06

### Phase 4: Playback & Streaming
**Status**: ⬜ Not Started
**Objective**: Build the video player and integrate stream resolution (HTTP/Torrents).
**Requirements**: REQ-07, REQ-08

### Phase 5: Sync & Personalization
**Status**: ⬜ Not Started
**Objective**: Implement cross-device sync and Trakt.tv integration.
**Requirements**: REQ-04

### Phase 6: Leanback Experience (TV)
**Status**: ⬜ Not Started
**Objective**: Optimize layouts and navigation for TV and D-Pad interaction.
**Requirements**: REQ-02, REQ-10

### Phase 7: Polish & Performance
**Status**: ⬜ Not Started
**Objective**: Final performance tuning, animation refinement, and bug fixing.

### Phase 8: Audit & UI Alignment (Gap Closure)
**Status**: ⬜ In Progress
**Objective**: Fix regressions from Phase 4 and align UI with `crispy-webui` mobile.

**Gaps to Close:**
- [x] Fix syntax errors (`Pressable`) in `[id].tsx`
- [x] Fix module evaluation crash in `player.tsx`
- [ ] Align Home Page with WebUI aesthetics
- [ ] Refactor Discover Tab for better content organization
- [ ] Fix and Polish Search functionality
- [ ] Resolve Native View Manager warnings (Verify bridge naming)
