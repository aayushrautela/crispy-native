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
- [ ] **2.2.1** Create `StremioAddonService.ts` for manifest, catalog, and stream fetching.
- [ ] **2.2.2** Implement Direct-then-Proxy logic for CORS bypass using the native proxy.
- [ ] **2.2.3** Create `AddonStore` (Zustand) for persistent addon management and enabled/disabled state.

### 2.3 Provider Layer
- [ ] **2.3.1** Implement `ProviderStore` to aggregate results from multiple enabled addons.
- [ ] **2.3.2** Add ID-based deduplication for catalog metadata.
- [ ] **2.3.3** Implement metadata fetching (Meta Details) with fallback to TMDB for enrichment.

### 2.4 Verification
- [ ] **2.4.1** Verify catalog listing with Cinemeta.
- [ ] **2.4.2** Verify stream resolution for a public torrent.
- [ ] **2.4.3** Verify proxy fallback by disabling direct fetch and checking proxy logs.

## Risks & Mitigations
- **Port Conflicts**: If 11470 is occupied, the native module will retry on an alternative port and notify JS.
- **Battery Optimization**: The Torrent service must be a Foreground Service to prevent background termination.
