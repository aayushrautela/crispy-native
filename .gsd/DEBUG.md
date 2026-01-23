# Debug Session: UnsatisfiedLinkError libmpv.so
## Symptom
App crashes with UnsatisfiedLinkError: dlopen failed: cannot locate symbol ... referenced by libmpv.so

**When:** App startup or video playback init
**Expected:** App runs and plays video
**Actual:** Crash with unsatisfied link error

## Resolution

**Root Cause:** libmpv.so required newer C++ symbols (NDK 26+) than the project was configured for.
**Fix:** Upgraded NDK to 26.1.10909125 and added pickFirst for libc++_shared.so.
**Verified:** Pending GitHub Actions build.

**Correction:** Switched to Expo Config Plugin because /android is gitignored.

**Correction 2:** Aligned NDK with Nuvio (r29). Kept pickFirst for conflict resolution.
