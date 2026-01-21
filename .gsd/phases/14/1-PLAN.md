---
phase: 14
plan: 1
wave: 1
---

# Plan 14.1: Command Queuing & Load Optimization

## Objective
Enhance the reliability of initial loading by implementing a command queue to prevent "Player Not Ready" errors when adding external subtitles during transitions.

## Context
- .gsd/ROADMAP.md (Phase 14)
- crispy-native-core/android/src/main/java/aayush/crispy/core/CrispyVideoView.kt

## Tasks

<task type="auto">
  <name>Implement Command Queuing</name>
  <files>
    <file>/home/aayush/Downloads/crispy-native/modules/crispy-native-core/android/src/main/java/aayush/crispy/core/CrispyVideoView.kt</file>
  </files>
  <action>
    - Add a `pendingCommands: MutableList<Array<String>>` to `CrispyVideoView`.
    - Refactor `addExternalSubtitle` to check if the file is loaded. If not, push to `pendingCommands`.
    - Flush `pendingCommands` in the `onFileLoaded` event handler.
    - Ensure duplicate URLs are still tracked via `addedExternalSubUrls`.
  </action>
  <verify>Check that sub-add calls during file transition are delayed until start-file event.</verify>
  <done>External subtitles added before/during load are correctly activated after playback starts.</done>
</task>

## Success Criteria
- [ ] No more "Player Not Ready" errors when adding external subtitles during transitions.
- [ ] External subtitles added before media load are successfully injected once the engine is ready.
