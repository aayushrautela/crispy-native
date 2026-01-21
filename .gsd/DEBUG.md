# Debug Session: Playback Duration Display

## Symptom
Playback time shows "0:00/0:01" or similar tiny values.

## Resolution

**Root Cause:**
Incorrect assumption that `react-native-video` and MPV report time in **milliseconds**. They actually report in **seconds**. Dividing by 1000 converted a 3600-second movie into 3.6, hence "0:01".

**Fix:**
-   Removed `/1000` divisions in `onProgress` and `onLoad` in `player.tsx`.
-   Removed `*1000` multiplier in the `videoRef.seek()` call (since seek also expects seconds).

**Verified:**
-   Code review confirms correct unit handling.
