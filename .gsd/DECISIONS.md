## Phase 1: Foundation & Identity

**Date:** 2026-01-18

### Design System: Material You Expressive
- **Approach**: Implement a dynamic theme provider that supports:
    - Android System Accents (Dynamic Color).
    - "Crispy" Curated Palette (Fallback/Override).
    - AMOLED Black toggle.
- **Shapes**: Adopt M3 Expressive corner scale (Large: 20dp, XL: 32dp, XXL: 48dp).
- **Navigation**: 
    - Mobile: Bottom Tab navigation (following webui mobile layout).
    - Tablet: Multi-column side navigation (following webui desktop layout).
    - TV: Custom layout (Phase 5).

### Authentication & Access
- **Decision**: 
    - **Guest Mode**: Allowed on Mobile and Tablet for discovery/browsing.
    - **Enforced Login**: Required on TV to enable sync-first architecture (no local management on TV).
- **Structure**: Root guard in `_layout.tsx` using `(auth)` and `(tabs)` route groups.

### Accessibility & Interaction
- **D-Pad**: All Phase 1 UI components (Buttons, Inputs, Tab items) MUST be focus-aware from the start to support TV/Remote navigation natively.
- **Animations**: Use `react-native-reanimated` for fluid transitions. Expansion/Zoom style for detail transitions.

## Phase 4: Playback & Streaming

**Date:** 2026-01-18

### Video Player Architecture
- **Engine**: Native MPV implementation via `crispy-native-core`.
- **Reason**: Performance, codec support, and consistent behavior with established desktop/mobile patterns.
- **UI**: Custom Material 3 Expressive player controls built in React Native, overlaying the native MPV view.

### Streaming Strategy
- **Torrent Bridge**: On-demand execution. The `jlibtorrent` server starts when a torrent stream is requested and shutdowns/pauses when not in use to save resources.
- **Protocol**: Local HTTP bridge (`127.0.0.1:11470`) with full Range request support for seeking.
- **Buffering**: Implement aggressive prioritization for video headers and metadata.

## Phase 10: Trakt Integration

**Date:** 2026-01-19

### Scope
- **Priority**: "Continue Watching" cards on Home Screen.
- **Features**: 
    - Auth (minimal viable UI).
    - Sync (manual/app-open for now).
    - Algorithm: 1:1 port of WebUI's "Continue Watching" logic.

### Approach
- **Architecture**: `TraktService` class in `src/core/api`, mirroring `TraktClient` but adapted for React Native storage.
- **Auth**: Basic Device Code flow.
- **UI**: New "Continue Watching" row component for Home Screen.

### Constraints
- Must match WebUI "Continue Watching" algorithm exactly (Sort recency -> Dedup -> Filter < 80%).
