# ROADMAP.md

> **Current Phase**: Phase 3: Discover Page - Hero Carousel
> **Milestone**: v1.0 Alpha

## Phase 1: CDK Standardization & Refactor
**Status**: ✅ COMPLETED
**Objective**: Fix mismatches in the Core Design Kit. Standardize tokens, rounding, and interaction states for MD3 Expressive.

## Phase 2: Configuration & Environment
**Status**: ✅ COMPLETED (Updated 2026-01-20)
**Objective**: Ensure all external keys are correctly managed. Added AI/OpenRouter configuration.

## Phase 3: Discover Page - Hero Carousel
**Status**: ✅ COMPLETED
**Objective**: 1:1 layout copy of `HeroMobile.tsx` using native CDK.
- [ ] Implement `HeroCarousel` with snap-paging.
- [ ] Implement `HeroSlide` with backdrop, logo, and metadata alignment.

## Phase 4: Discover Page - Catalog Rows
**Status**: ⬜ Not Started
**Objective**: 1:1 layout copy of `CatalogRow.tsx` and `ContentRow.tsx`.
- [x] Implement `CatalogRow` with lazy-loading logic.
- [x] Align `MetaCard` styling with WebUI version (rounded-xl, scale effects).
- [x] **Meta Details Enhancements**: Clickable episodes & review bottom sheets.

## Phase 5: Shell & Layout Alignment
**Status**: ⬜ Not Started
**Objective**: Align Tab Bar and Navigation Rail with Crispy-webui specs.

## Phase 6: Sync & Search (Gap Closure)
**Status**: ⬜ Not Started
**Objective**: Implement functional 1:1 copies of Search and Library pages.

## Phase 7: Playback (Deferred)
**Status**: ⬜ Not Started
**Objective**: Clean up and verify the video player.

---

## Phase 8: Performance Optimization
**Status**: ✅ COMPLETED
**Objective**: Optimize the application for 60+ FPS rendering and minimize `VirtualizedList` update lag.
**Depends on**: Phase 4, Phase 6

**Tasks**:
- [ ] TBD (run /plan 8 to create)

**Verification**:
- [ ] Profiler trace showing < 16ms frame times during scroll.

## Phase 9: Infinite Catalog Scroll
**Status**: 🚧 IN_PROGRESS
**Objective**: Implement horizontal lazy-loading for catalog rows on Home/Discover.
- [ ] Refactor `useCatalog` to `useInfiniteQuery`.
- [ ] Implement `skip` pagination in `AddonService`.
- [ ] Update `CatalogRow` with `onEndReached` logic.

## Phase 10: Trakt Integration
**Status**: ✅ COMPLETED
**Objective**: Port Trakt implementation from `Crispy-webui`, adapting it for `crispy-native`.
**Depends on**: Phase 9

**Tasks**:
- [ ] TBD (run /plan 10 to create)

**Verification**:
- [ ] TBD

## Phase 11: Settings UI Redesign
**Status**: 🚧 IN_PROGRESS (Updated 2026-01-20)
**Objective**: Refactor Settings into a menu-based navigation hub with subpages, matching `crispy-webui` mobile.
- [x] Implement `SettingsItem` and `SettingsGroup` CDK components.
- [x] Refactor `(tabs)/settings.tsx` to a menu hub.
- [x] Implement subpages for Account, Addons, Player, and Support.
- [ ] Refine headers with scroll-to-hide behavior (Matching Search/Discover).

## Phase 12: Android 16 UI Polish
**Status**: 🚧 IN_PROGRESS
**Objective**: Redesign Settings UI to match Android 16 visuals (Big Cards, Circular Icons, Expressive Switches).
- [ ] Create `ExpressiveSwitch` component.
- [ ] Update `SettingsGroup` to use card style with margins.
- [ ] Update `SettingsItem` to use circular icons and dividers.

## Phase 13: Player Side Tabs
**Status**: ⬜ Not Started
**Objective**: Implement side tabs in the video player, similar to `crispy-webui` mobile player in look and functionality.
**Depends on**: Phase 12

**Tasks**:
- [ ] TBD (run /plan 13 to create)

**Verification**:
- [ ] TBD
