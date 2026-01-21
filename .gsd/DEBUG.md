# Debug Session: Player Instability

## Symptoms
1. **Seeking closes player**: Seeking sometimes triggers `router.back()` (likely via `onEnd`).
2. **Delayed Start**: Players sometimes don't start playing.
3. **Crashes during track selection**: Crashes when switching audio/subtitles.

## Hypotheses
1. `onEnd` is triggered prematurely during seeks if buffer is empty or `eof-reached` is observed too early.
2. `seek` and `track selection` methods in `CrispyNativeCoreModule.kt` lack proper null/type safety or are called on uninitialized native state.
3. Race conditions between `setSource`, `setHeaders`, and MPV initialization.
