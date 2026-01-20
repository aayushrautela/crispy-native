---
phase: 13
plan: 1
wave: 1
---

# Plan 13.1: SideSheet Core & Player Integration

## Objective
Implement the `SideSheet` core component using `react-native-reanimated` without blur effects for high performance. Integrate this component into `PlayerScreen` and wire up the control buttons to toggle the side tabs.

## Context
- .gsd/SPEC.md
- .gsd/DECISIONS.md
- src/app/player.tsx
- src/cdk/components/BottomSheet.tsx (Reference for theming)

## Tasks

<task type="auto">
  <name>Create SideSheet Component</name>
  <files>src/cdk/components/SideSheet.tsx</files>
  <action>
    Create a reusable `SideSheet` component using Reanimated.
    - Props: `isVisible`, `onClose`, `title`, `children`, `width` (default ~40-50%).
    - Animation: Slide in from Right (`SlideInRight`, `SlideOutRight`).
    - Backdrop: A simple dimmed view (`rgba(0,0,0,0.5)`) that closes the sheet on press.
    - **Performance**: Ensure NO BLUR is used.
    - Styling: Use `ExpressiveSurface` or standard View with theme colors.
  </action>
  <verify>View file content to ensure no `BlurView` is imported and Reanimated is used.</verify>
  <done>Component exists and exports correctly.</done>
</task>

<task type="auto">
  <name>Integrate SideSheet into PlayerScreen</name>
  <files>src/app/player.tsx</files>
  <action>
    Update `PlayerScreen` to manage tab state.
    - Add state: `activeTab` of type `'none' | 'audio' | 'subtitles' | 'streams' | 'settings' | 'info'`.
    - Update `controlsTimer` logic: When a tab is open, do NOT hide controls (or handle z-index such that tab is above).
    - Render `SideSheet` at the end of the `container` (top z-index).
    - Pass `isVisible={activeTab !== 'none'}`.
    - Implement `onClose` to set `activeTab` to `'none'`.
    - Update the `actionsPill` button handlers to set the corresponding `activeTab`.
  </action>
  <verify>Check `activeTab` state logic in `PlayerScreen`.</verify>
  <done>SideSheet renders conditionally based on state.</done>
</task>

## Success Criteria
- [ ] `SideSheet` component created in CDK.
- [ ] `PlayerScreen` contains logic to open/close the side sheet.
- [ ] Tapping action buttons triggers the sheet (visually checked in next phase).
