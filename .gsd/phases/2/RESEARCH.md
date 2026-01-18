---
phase: 2
level: 2
researched_at: 2026-01-18
---

# Phase 2 Research: Addon Engine & Provider Layer

## Questions Investigated
1. How to implement the Stremio Addon V3 protocol in React Native?
2. How to handle CORS and proxying for external addons on Android?
3. How to aggregate results from multiple addons efficiently?
4. How to integrate the native torrent engine (jlibtorrent) with the React Native layer?

## Findings

### Stremio Addon Protocol (V3)
The protocol follows a standard structure:
- **Manifest**: `GET /manifest.json`
- **Catalog**: `GET /catalog/{type}/{id}/{extra}.json`
- **Streams**: `GET /stream/{type}/{id}.json`
- **Subtitles**: `GET /subtitles/{type}/{id}.json`

**Recommendation:** Implement a `StremioAddonService` in TypeScript that mimics the `StremioAddonApi.ts` found in `Crispy-webui`. Use `Promise.allSettled` for result aggregation.

### Native Proxy & Torrent Engine
The legacy Android app uses `NanoHTTPD` to run a local server (`127.0.0.1:11470`) for two purposes:
1. **Proxying**: Bypassing CORS for the WebUI/JS layer.
2. **Torrent Streaming**: Specifically serving jlibtorrent streams with `Range` request support to the video player (MPV).

**Recommendation:** For `crispy-native`, we should port `CrispyServer.kt` and `TorrentService.kt` to a **React Native Native Module**. This module will:
- Start the local NanoHTTPD server on app launch.
- Expose a `resolveStream` method to the JS layer.
- If the stream is a torrent (infoHash), the Native Module starts the `TorrentService` and returns the `localhost` URL.

### Data Deduplication
The WebUI implementation uses ID-based deduplication for catalog metadata (`metas`). We should follow this pattern in the `ProviderStore` (Zustand).

## Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Addon Fetching | JS Layer (TypeScript) | Flexible, easy to update, and mirrors `stremio-web` logic. |
| Proxy/Torrent | Native Module (Kotlin) | Required for `jlibtorrent` and `NanoHTTPD` performance and Android background service requirements. |
| Result Aggregation | Promise.allSettled | Non-blocking, handles partial failures gracefully. |

## Patterns to Follow
- **Direct-then-Proxy Strategy**: Try fetching directly first; if it fails (CORS), fall back to the local native proxy.
- **Sequential Priority**: Ensure `jlibtorrent` is configured for sequential downloading and header piece prioritization (pieces 0-2).
- **Ephemeral Playback**: Delete torrent data immediately after playback or on app exit.

## Dependencies Identified
| Package | Version | Purpose |
|---------|---------|---------|
| NanoHTTPD | 2.3.1 | Local HTTP server for proxy/streaming. |
| jlibtorrent | Latest | Torrent engine. |
| axios | ^1.13.2 | HTTP client for addon communication (JS). |

## Risks
- **Background Persistence**: Android may kill the local server/torrent service. **Mitigation**: Run as a Foreground Service with a persistent notification.
- **Port Conflicts**: Port 11470 might be used. **Mitigation**: Handle `BindException` and retry on a random port if necessary (notifying the JS layer).

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
