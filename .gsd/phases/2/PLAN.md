# Phase 2 Plan: Addon Engine & Provider Layer

## Objective
Implement a robust Stremio-compatible addon engine and provider layer that aggregates media catalogs and streaming links, supporting both HTTP and torrent protocols via a native Android server.

## Dependencies
- [ ] jlibtorrent (Native)
- [ ] NanoHTTPD (Native)
- [ ] `axios` (JS)
- [ ] `zustand` (State)

## Task Breakdown

### 2.1 Native Foundation (Android)
- [ ] **2.1.1** Port `CrispyServer.kt` to React Native Native Module (`CrispyServerModule`).
- [ ] **2.1.2** Port `TorrentService.kt` to React Native as a Foreground Service.
- [ ] **2.1.3** Implement `resolveStream` native method to bridge JS to `CrispyServer`.
- [ ] **2.1.4** Add jlibtorrent and NanoHTTPD dependencies to `android/app/build.gradle`.

### 2.2 Core Addon Logic (JS)
- [x] Create `StremioAddonService.ts` for manifest, catalog, and stream fetching.
- [x] Create `AddonStore` (Zustand) for persistent addon management.

### 2.3 Provider Layer
- [x] Implement `ProviderStore` to aggregate results from multiple enabled addons.
- [x] Add ID-based deduplication for catalog metadata.
- [x] Implement metadata fetching (Meta Details) with fallback to TMDB for enrichment.

### 2.4 Verification
- [x] Verify catalog listing with Cinemeta.
- [x] Verify stream resolution with Torrentio.
- [x] Verify native proxy CORS bypass.
- [x] Verify sequential download in torrent engine.

## Risks & Mitigations
- **Port Conflicts**: If 11470 is occupied, the native module will retry on an alternative port and notify JS.
- **Battery Optimization**: The Torrent service must be a Foreground Service to prevent background termination.
