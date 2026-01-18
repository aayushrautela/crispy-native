# Phase 4 Research: Playback & Streaming

## Objective
Implement a high-performance video player using native MPV and a custom Material 3 Expressive UI.

## Technical Architecture

### 1. Native View (MPV)
- **Component**: `CrispyVideoView` (Native Android View).
- **Surface**: `android.view.SurfaceView` or `TextureView` for MPV rendering.
- **Bridge**: Expo Module View Definition.
- **Properties**:
  - `source`: URL (HTTP or local bridge).
  - `paused`: Boolean.
  - `position`: Number (ms).
- **Events**:
  - `onLoad`: Metadata ready (duration, dims).
  - `onProgress`: Buffering/Playback progress.
  - `onEnd`: Playback finished.

### 2. Torrent Bridge (Internal)
- Controlled via `CrispyNativeCoreModule`.
- `resolveStream(infoHash, fileIdx)` returns `127.0.0.1:11470/{hash}/{idx}`.
- **Why HTTP?**: Even though we are native, serving via a local HTTP bridge is superior for:
  - **Sequential Playback**: NanoHTTPD handles Range requests, allowing MPV to "think" it's streaming a full file while we prioritize pieces in the background.
  - **External Players**: Allows users to "Open in VLC" or other players with zero extra logic.
  - **Decoupling**: The player doesn't need to know about `jlibtorrent` internal file states.
- `on-demand`: Start server/torrenting only when `resolveStream` is called.

### 3. Player UI (React Native)
- **Layout**: Absolute overlay over the native MPV view.
- **Components**:
  - `PlayerControls`: Custom play/pause, seek bar, time display.
  - `GestureHandler`: Double-tap to seek, swipe for volume/brightness.
  - `Material 3 Styling`: Use `ExpressiveSurface` for control panels.

## Implementation Tasks

### Week 1: Native MPV Integration
- [ ] Implement `MpvPlayerView.kt` in `crispy-native-core`.
- [ ] Connect MPV commands to the view (play, pause, seek).
- [ ] Expose the view to Expo.

### Week 2: Stream Resolution
- [ ] Implement logic to detect stream type (HTTP vs Torrent).
- [ ] Hook up `resolveStream` to the Player's source property.
- [ ] Implement a "Buffering" overlay that reads from `/stats.json`.

### Week 3: Player UI & UX
- [ ] Build the M3 Expressive player control scheme.
- [ ] Implement landscape lock and aspect ratio controls.
- [ ] Finalize the "Now Playing" integration.

## Reference Patterns
- Old Android App: Using `mpv-lib` and `jlibtorrent` integration patterns.
- Stremio Protocol: Handling `catalog`, `meta`, and `stream` responses correctly.
