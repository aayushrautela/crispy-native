---
phase: 13
plan: 2
wave: 1
---

# Plan 13.2: Tab Content Implementation

## Objective
Implement the specific content for each side tab (Info, Subtitles, Audio, Settings) and wire them into the `SideSheet` within `PlayerScreen`.

## Context
- .gsd/DECISIONS.md
- src/app/player.tsx
- src/components/player/tabs/*

## Tasks

<task type="auto">
  <name>Create Tab Components</name>
  <files>
    src/components/player/tabs/EpisodesTab.tsx
    src/components/player/tabs/SubtitlesTab.tsx
    src/components/player/tabs/AudioTab.tsx
    src/components/player/tabs/SettingsTab.tsx
    src/components/player/tabs/StreamsTab.tsx
  </files>
  <action>
    Create a component for each tab.
    - `EpisodesTab`: Display list of episodes (mock or pass data props). Focus on UI layout (list).
    - `SubtitlesTab`: Display subtitle options (embedded/external). Pass `selectedSubtitle` and `onSelectSubtitle` props.
    - `AudioTab`: Display audio tracks. Pass `selectedAudio` and `onSelectAudio` props.
    - `SettingsTab`: Playback speed, quality (if applicable), server selection.
    - `StreamsTab`: List available streams (reuse logic from `StreamSelector` if possible, or adapt).
    - Styling: Use `Typography` and `cdk` components. Match Material Expressive.
  </action>
  <verify>Files exist.</verify>
  <done>All 5 tab components created with basic UI structure.</done>
</task>

<task type="auto">
  <name>Connect Tabs to Player</name>
  <files>src/app/player.tsx</files>
  <action>
    Render the appropriate tab component inside the `SideSheet` logic.
    - Switch based on `activeTab`.
    - Pass necessary props (even if dummy for now, e.g., `episodes={[]}` or `currentEpisode={...}`).
    - Ensure title of `SideSheet` updates based on active tab.
  </action>
  <verify>Check `renderContent` or switch logic in `PlayerScreen`.</verify>
  <done>Tabs are rendered inside the SideSheet.</done>
</task>

## Success Criteria
- [ ] All tab components implementation files exist.
- [ ] Switching `activeTab` shows the correct content.
