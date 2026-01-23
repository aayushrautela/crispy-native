# SPEC: libmpv UnsatisfiedLinkError Fix

Status: FINALIZED

## Goal
Resolve the `java.lang.UnsatisfiedLinkError` caused by a missing symbol `__from_chars_floating_point` in `libmpv.so`. This requires aligning the project's NDK version with the library's build environment (NDK r29).

## Requirements
1. **NDK Version Alignment**: The top-level `android/build.gradle` must use `ndkVersion = "29.0.14206865"`.
2. **Automated Configuration**: The fix must be implemented via an Expo Config Plugin to ensure persistence across `npx expo prebuild`.
3. **Packaging Integrity**: Ensure `libc++_shared.so` is correctly picked from the newer NDK libraries.

## Technical Details
- **Plugin**: `plugins/withNdkFix.js` targeting `withProjectBuildGradle`.
- **Target File**: `android/build.gradle`.
- **Injection Point**: `buildscript.ext` block.

## Verification Criteria
- `android/build.gradle` shows `ndkVersion = "29.0.14206865"` after prebuild.
- App launches without native crashing when loading `MPVLib`.
