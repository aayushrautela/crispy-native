---
phase: 14
plan: 2
wave: 1
---

# Plan 14.2: Media3 Player Wrapper & PiP Support

## Objective
Standardize the player architecture by wrapping MPV in a Media3 `BasePlayer` and implementing native Picture-in-Picture logic.

## Context
- .gsd/phases/14/RESEARCH.md
- modules/crispy-native-core/android/src/main/java/aayush/crispy/core/CrispyVideoView.kt

## Tasks

<task type="auto">
  <name>Implement Media3 BasePlayer Wrapper</name>
  <files>
    <file>/home/aayush/Downloads/crispy-native/modules/crispy-native-core/android/src/main/java/aayush/crispy/core/CrispyVideoView.kt</file>
  </files>
  <action>
    - Refactor `CrispyVideoView` to implement `androidx.media3.common.BasePlayer`.
    - Map MPV properties (pause, time-pos, duration) to `getPlayWhenReady`, `getCurrentPosition`, `getDuration`.
    - Implement `seekTo` by calling `MPVLib.command`.
    - Emit Media3 events (onPlaybackStateChanged, onIsPlayingChanged) based on MPV property changes.
  </action>
  <verify>Verify that basic playback controls still work via the new BasePlayer interface.</verify>
  <done>Player state is correctly synchronized with Media3 listener callbacks.</done>
</task>

<task type="auto">
  <name>Enable Picture-in-Picture (PiP)</name>
  <files>
    <file>/home/aayush/Downloads/crispy-native/modules/crispy-native-core/android/src/main/java/aayush/crispy/core/CrispyVideoView.kt</file>
  </files>
  <action>
    - Add a `enterPiP()` method to the Expo module.
    - Use `(context as Activity).enterPictureInPictureMode(PictureInPictureParams.Builder().build())`.
    - Implement PiP lifecycle listeners to adjust UI (hide controls) when entering PiP.
    - Ensure MPV continues playing in the PiP window.
  </action>
  <verify>Trigger enterPiP from JS and confirm the app enters small window mode on Android.</verify>
  <done>App successfully transitions to PiP mode with functional video playback.</done>
</task>

## Success Criteria
- [ ] `CrispyVideoView` is a valid Media3 `Player`.
- [ ] PiP mode is triggerable and stable.
