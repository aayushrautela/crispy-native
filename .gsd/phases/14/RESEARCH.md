# Research: Phase 14 - Advanced Player Architecture

## 1. Media3 BasePlayer Implementation
Findroid implements `BasePlayer` directly in their `MPVPlayer.kt`. This allows them to use standard Media3 listeners and components.

### Key Aspects:
- **`BasePlayer`**: Provides a skeleton for a Media3 player. We need to override methods like `getPlaybackState`, `getPlayWhenReady`, `seekTo`, etc.
- **Track Groups**: We must convert MPV's track list into Media3 `Tracks` and `TrackGroup` objects.

## 2. Command Queuing
- **Trigger**: Native `onFileLoaded` or `MPV_EVENT_START_FILE`.
- **Mechanism**: Store `sub-add` and `aid/sid` settings in a `MutableList<Array<String>>` and flush them once the engine is ready.

## 3. Media Notifications
- **Standard**: `PlayerNotificationManager` from Media3.
- **Customization**:
  - **Title**: `MediaMetadata.Builder().setTitle(episodeTitle).build()`
  - **Subtext**: `MediaMetadata.Builder().setSubtitle(showName).build()`
  - **Backdrop**: `MediaMetadata.Builder().setArtworkUri(uri).build()`
- **Logic**: Use a `MediaDescriptionAdapter` to provide these strings/images to the notification.

## 4. Picture-in-Picture (PiP)
- **Manifest**: Requires `android:supportsPictureInPicture="true"` (Expo managed).
- **Control**: `Activity.enterPictureInPictureMode(params)`.
- **Coordination**: The `Media3` notification should ideally stay active during PiP.

## 5. Integration with Expo Module
Since `CrispyVideoView` is an `ExpoView`, we can either:
1.  Host the player instance inside the `CrispyVideoView`.
2.  Make the player a singleton or a separate entity linked to the view.
Findroid's approach uses a `PlayerViewModel`. In RN, we usually manage the "Player Instance" in native and bind it to a `Surface`.
