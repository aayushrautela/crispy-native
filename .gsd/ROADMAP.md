# ROADMAP: libmpv Crash Fix

## Phase 1: Configuration Fix 🛠️
- [ ] Create `plugins/withNdkFix.js` to force NDK version in top-level Gradle.
- [ ] Update `app.json` to include the new plugin.
- [ ] Update `withAndroidFixes.js` to refine `libc++_shared.so` packaging if needed.

## Phase 2: Verification ✅
- [ ] Run `npx expo prebuild` and verify `android/build.gradle`.
- [ ] Perform a clean build and verify app stability during video playback.
