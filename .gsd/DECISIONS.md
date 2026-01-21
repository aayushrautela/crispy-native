## Phase 13 Decisions

**Date:** 2026-01-20

### Scope
- **Tabs**: Info (Episodes), Subtitles, Stream Selection, Audio Track, Settings (Playback speed/quality).
- **Position**: Right-side sheet.
- **Triggers**: Existing bottom-right buttons in the video player.

### Approach
- **Chose**: Custom implementation using `react-native-reanimated` (similar to existing BottomSheet logic but for side).
- **Rationale**: User requested to use "whatever we are already using for bottom sheet" principles (Reanimated), but adapted for side. High performance (no blur) is a priority. "Native" drawer is preferred over basic Modal.
- **Performance**: No blur effects to ensure 4K playback stability.

### Dependencies
- None from Phase 12.

### Constraints
- **Gestures**: Player has no gestures, so no conflict issues.
