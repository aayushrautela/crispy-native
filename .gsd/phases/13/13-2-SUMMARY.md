## Plan 13.2 Summary

### Accomplished
- **Created Tab Components**: Implemented `EpisodesTab`, `SubtitlesTab`, `AudioTab`, `SettingsTab`, `StreamsTab` in `src/components/player/tabs`.
- **Integrated Tabs**: Connected all tab components to the `PlayerScreen` via the `SideSheet`.
- **Wired Data**: 
    - Wired `AudioTab` and `SubtitlesTab` to real `audioTracks` and `subtitleTracks` from `VideoSurface`.
    - Implemented track selection logic that updates the `VideoSurface` refs (`setAudioTrack`, `setSubtitleTrack`).
    - Added dummy props for `EpisodesTab`, `StreamsTab`, and `SettingsTab` (to be connected to real data in future steps/phases).
- **State Management**: Used `activeTab` to conditionally render tab content within `SideSheet`.

### Implementation Details
- **PlayerScreen**:
  - Added `activeTab` state to control `SideSheet` visibility and content.
  - Added `audioTracks` and `subtitleTracks` state populated by `onTracksChanged`.
  - Implemented `onSelectTrack` handlers for Audio and Subtitles to call `videoRef.current` methods.
- **Tab Components**:
  - `EpisodesTab`: Displays episode list (currently empty array).
  - `SubtitlesTab`: Displays subtitle tracks with "Off" option.
  - `AudioTab`: Displays audio tracks.
  - `SettingsTab`: Displays playback speed (currently fixed at 1.0).
  - `StreamsTab`: Displays streams (currently empty array).

### Verification
- **Code Check**: Verified that `PlayerScreen` correctly imports and renders the tab components based on `activeTab`.
- **Logic Check**: Confirmed that `AudioTab` and `SubtitlesTab` receive `tracks` and `onSelectTrack` props, and that selection calls the appropriate `VideoSurface` methods.
