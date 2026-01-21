---
phase: 14
plan: 3
wave: 2
---

# Plan 14.3: Media Notifications & Metadata Binding

## Objective
Implement system-level media notifications with custom metadata and artwork, leveraging the Media3 integration from Plan 14.2.

## Context
- .gsd/phases/14/1-PLAN.md
- .gsd/phases/14/2-PLAN.md
- modules/crispy-native-core/android/src/main/java/aayush/crispy/core/CrispyVideoView.kt
- src/app/player.tsx

## Tasks

<task type="auto">
  <name>Implement PlayerNotificationManager</name>
  <files>
    <file>/home/aayush/Downloads/crispy-native/modules/crispy-native-core/android/src/main/java/aayush/crispy/core/CrispyVideoView.kt</file>
  </files>
  <action>
    - Initialize `PlayerNotificationManager` within `CrispyVideoView`.
    - Set up a unique notification channel for playback.
    - Bind the notification manager to our `BasePlayer` implementation.
    - Implement `MediaDescriptionAdapter` to supply metadata to the notification.
  </action>
  <verify>Check that a media notification appears in the Android tray when playback starts.</verify>
  <done>Media controls (Play/Pause/Seek) in the notification correctly control MPV.</done>
</task>

<task type="auto">
  <name>Bind Metadata Props from JS</name>
  <files>
    <file>/home/aayush/Downloads/crispy-native/modules/crispy-native-core/android/src/main/java/aayush/crispy/core/CrispyVideoView.kt</file>
    <file>/home/aayush/Downloads/crispy-native/src/app/player.tsx</file>
  </files>
  <action>
    - Add `metadata` prop to `CrispyVideoView` (title, subtitle, artworkUrl).
    - In `player.tsx`, construct the metadata object based on content type (Movie vs Episode).
    - Update the `MediaDescriptionAdapter` in Kotlin to use these props when building the notification.
    - Implement image loading (using `Coil` or similar) for the backdrop artwork.
  </action>
  <verify>Play an episode and confirm notification shows "Episode Name" as title and "Show Name" as subtext.</verify>
  <done>Notification metadata accurately reflects the current playing content.</done>
</task>

## Success Criteria
- [ ] Working media notification with playback controls.
- [ ] Correct metadata display (Title/Subtitle/Artwork).
- [ ] Notification stays in sync with playback state (Play/Pause).
